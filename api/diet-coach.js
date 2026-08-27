// ИИ-тренер для вкладки "Диета": получает профиль человека и уже посчитанный по
// формуле план (калории/БЖУ, см. computeDietPlan в webapp/src/screens/Diet.jsx) и
// просит модель написать живой персональный разбор — мотивацию, принципы питания,
// текст про тренировки и конкретные идеи блюд под предпочтения. Клиент кэширует
// результат сам (diet.aiPlan в сторе) и вызывает этот эндпоинт только по кнопке
// "Обновить план", а не на каждый рендер — чтобы не тратить деньги впустую.
//
// Если ИИ недоступен/ответил не тем — возвращаем ok:false, и экран показывает
// обычные статические рекомендации (buildNutritionPrinciples/buildWorkoutPrinciple),
// которые как были в коде, так и остались как надёжный запасной вариант.

import { redis } from "./_lib/redis.js";
import { verifyInitData } from "./_lib/telegramAuth.js";
import { callClaude, extractJson, SMART_MODEL, AIUnavailableError } from "./_lib/ai.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const COOLDOWN_SEC = 15; // защита от случайных повторных тапов по кнопке — не от ИИ-лимитов как таковых

const ACTIVITY_LABELS = {
  sedentary: "малоподвижный образ жизни, почти нет спорта",
  light: "лёгкая активность, тренировки 1–3 раза в неделю",
  moderate: "средняя активность, тренировки 3–5 раз в неделю",
  active: "высокая активность, тренировки 6–7 раз в неделю",
  very_active: "очень высокая активность, физический труд + тренировки",
};
const GOAL_LABELS = { lose: "похудеть", maintain: "поддерживать вес", gain: "набрать мышечную массу" };
const PREFERENCE_LABELS = {
  vegetarian: "вегетарианство",
  vegan: "веганство",
  no_gluten: "без глютена",
  no_dairy: "без лактозы/молочных продуктов",
  budget: "ограниченный бюджет на еду",
  quick_meals: "минимум времени на готовку",
};

const SYSTEM_PROMPT = `Ты — опытный, тёплый и мотивирующий фитнес-тренер и нутрициолог. Тебе присылают профиль человека
и уже посчитанные по формуле цифры (калории, БЖУ) — твоя задача не пересчитывать их, а на их основе написать
живой, персональный, конкретный разбор, будто ты реальный тренер, который внимательно изучил анкету этого
человека. Обращайся на "ты". Никакой воды, общих фраз "просто ешьте меньше" — только конкретика под ЕГО данные,
ограничения и цель. Не давай медицинских советов и не рекомендуй ничего опасного (экстремальный дефицит калорий,
голодание и т.п.).

Ответь СТРОГО JSON-объектом такой формы, без пояснений вокруг:
{
  "motivation": "2-3 мотивирующих, тёплых предложения лично под этого человека и его цель",
  "nutrition": ["конкретный принцип питания 1", "принцип 2", "..."],
  "workout": "связный абзац про тренировки: частота, тип, интенсивность — под его уровень активности и цель",
  "mealIdeas": ["конкретная идея приёма пищи или перекуса с ориентировочными БЖУ/ккал, уважающая его предпочтения", "..."]
}
"nutrition" — 4-6 пунктов. "mealIdeas" — 5-6 пунктов, каждый — реальное блюдо/сочетание продуктов, а не общий принцип.`;

function buildUserPrompt(profile, plan) {
  const prefs = (profile.preferences || []).map((p) => PREFERENCE_LABELS[p]).filter(Boolean);
  return JSON.stringify({
    пол: profile.gender === "female" ? "женский" : "мужской",
    возраст: profile.age,
    рост_см: profile.heightCm,
    текущий_вес_кг: profile.weightKg,
    желаемый_вес_кг: profile.goalWeightKg || null,
    цель: GOAL_LABELS[profile.goalType] || "поддерживать вес",
    активность: ACTIVITY_LABELS[profile.activityLevel] || ACTIVITY_LABELS.moderate,
    пищевые_предпочтения: prefs.length ? prefs : "без особых ограничений",
    целевая_калорийность_ккал: plan.target,
    белки_г: plan.proteinG,
    жиры_г: plan.fatG,
    углеводы_г: plan.carbsG,
  });
}

function clampStr(s, max) {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

function sanitizePlan(raw) {
  if (!raw || typeof raw !== "object") return null;

  const motivation = clampStr(raw.motivation, 500);
  const workout = clampStr(raw.workout, 900);
  const nutrition = Array.isArray(raw.nutrition)
    ? raw.nutrition.map((s) => clampStr(s, 300)).filter(Boolean).slice(0, 6)
    : [];
  const mealIdeas = Array.isArray(raw.mealIdeas)
    ? raw.mealIdeas.map((s) => clampStr(s, 300)).filter(Boolean).slice(0, 6)
    : [];

  if (!motivation || !workout || nutrition.length === 0 || mealIdeas.length === 0) return null;
  return { motivation, workout, nutrition, mealIdeas };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  if (!BOT_TOKEN) {
    console.error("Не задан BOT_TOKEN — не могу проверить initData.");
    res.status(500).json({ error: "server_misconfigured" });
    return;
  }

  const { initData, profile, plan } = req.body || {};
  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) {
    res.status(401).json({ error: "invalid_init_data" });
    return;
  }
  if (!profile || !plan || typeof plan.target !== "number") {
    res.status(400).json({ error: "bad_request" });
    return;
  }

  const chatId = String(user.id);
  const cooldownKey = `dietai:cooldown:${chatId}`;
  const onCooldown = await redis.get(cooldownKey);
  if (onCooldown) {
    res.status(429).json({ ok: false, error: "too_soon" });
    return;
  }
  await redis.set(cooldownKey, "1", { ex: COOLDOWN_SEC });

  try {
    const response = await callClaude({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(profile, plan),
      model: SMART_MODEL,
      maxTokens: 1400,
      timeoutMs: 20000,
    });
    const parsed = extractJson(response);
    const sanitized = sanitizePlan(parsed);
    if (!sanitized) throw new Error("Модель вернула не то, что нужно");

    res.status(200).json({ ok: true, plan: sanitized });
  } catch (err) {
    if (!(err instanceof AIUnavailableError)) {
      console.error("diet-coach: не удалось получить план от ИИ", err);
    }
    res.status(200).json({ ok: false, error: "ai_unavailable" });
  }
}
