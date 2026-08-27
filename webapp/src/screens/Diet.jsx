// Вкладка "Диета": человек один раз вводит рост/возраст/пол/активность/цель по весу
// и отмечает пищевые предпочтения — приложение считает целевые калории и БЖУ по
// стандартной формуле (Mifflin-St Jeor), это неизменный, надёжный фундамент.
//
// Сверху на эти цифры можно "включить" ИИ-тренера (api/diet-coach.js): по кнопке —
// не автоматически на каждое изменение поля, чтобы не жечь деньги впустую — модель
// пишет живой персональный разбор (мотивация/принципы питания/тренировки/идеи блюд)
// под конкретный профиль. Пока ИИ не запрошен или недоступен, показываются обычные
// статические рекомендации (buildNutritionPrinciples/buildWorkoutPrinciple) — экран
// никогда не остаётся пустым и не ломается без ключа ИИ на сервере.
//
// Плюс — история веса (diet.weightLog, пишется автоматически при каждом SET_WEIGHT,
// см. state/store.jsx) с простым графиком прогресса.

import { useMemo, useState } from "react";
import { useStore } from "../state/store.jsx";
import { haptic } from "../telegram.js";
import { getInitData } from "../reminderSync.js";
import { FlameIcon, ChevronRightIcon, InfoIcon } from "../icons.jsx";

const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "Малоподвижный", hint: "Сидячая работа, почти нет спорта", factor: 1.2 },
  { id: "light", label: "Лёгкая активность", hint: "Тренировки 1–3 раза в неделю", factor: 1.375 },
  { id: "moderate", label: "Средняя активность", hint: "Тренировки 3–5 раз в неделю", factor: 1.55 },
  { id: "active", label: "Высокая активность", hint: "Тренировки 6–7 раз в неделю", factor: 1.725 },
  { id: "very_active", label: "Очень высокая", hint: "Физическая работа + тренировки", factor: 1.9 },
];

const GOAL_TYPES = [
  { id: "lose", label: "Похудеть" },
  { id: "maintain", label: "Поддерживать вес" },
  { id: "gain", label: "Набрать массу" },
];

const PREFERENCE_OPTIONS = [
  { id: "vegetarian", label: "Вегетарианство" },
  { id: "vegan", label: "Веганство" },
  { id: "no_gluten", label: "Без глютена" },
  { id: "no_dairy", label: "Без лактозы" },
  { id: "budget", label: "Ограниченный бюджет" },
  { id: "quick_meals", label: "Минимум готовки" },
];

function promptNumber(current, label, { min, max } = {}) {
  const raw = window.prompt(label, current != null ? String(current) : "");
  if (raw === null) return undefined; // отмена
  const num = Number(raw);
  if (!raw.trim() || !Number.isFinite(num)) return undefined;
  if (min !== undefined && num < min) return undefined;
  if (max !== undefined && num > max) return undefined;
  return Math.round(num);
}

// Формула Mifflin-St Jeor — общепринятый способ прикидочно оценить базовый обмен
// (BMR) по весу/росту/возрасту/полу. Дальше BMR умножается на коэффициент активности
// (TDEE), и от TDEE считается целевая калорийность под цель.
function computeDietPlan({ weightKg, heightCm, age, gender, activityLevel, goalType, goalWeightKg }) {
  if (!weightKg || !heightCm || !age) return null;

  const factor = ACTIVITY_LEVELS.find((a) => a.id === activityLevel)?.factor || 1.375;
  const bmr =
    gender === "female"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const tdee = bmr * factor;

  let target = tdee;
  if (goalType === "lose") {
    // Умеренный дефицит ~20% — темп похудения без разрушения мышц и метаболизма.
    // Ограничиваем "полом" по калориям, чтобы приложение не подталкивало к
    // нездорово низкому рациону, даже если формула формально насчитала меньше.
    target = tdee * 0.8;
    const floor = gender === "female" ? 1200 : 1500;
    target = Math.max(target, floor);
  } else if (goalType === "gain") {
    target = tdee * 1.12;
  }

  const proteinPerKg = goalType === "lose" ? 2.0 : goalType === "gain" ? 1.8 : 1.6;
  const proteinG = Math.round(proteinPerKg * weightKg);
  const fatG = Math.round(0.9 * weightKg);
  const proteinCals = proteinG * 4;
  const fatCals = fatG * 9;
  const carbsCals = Math.max(0, target - proteinCals - fatCals);
  const carbsG = Math.round(carbsCals / 4);

  let weeksEstimate = null;
  if (goalWeightKg && goalType !== "maintain") {
    const diffKg = Math.abs(weightKg - goalWeightKg);
    const weeklyDelta = Math.abs(tdee - target) * 7;
    if (diffKg > 0.5 && weeklyDelta > 50) {
      // 1 кг жировой массы ≈ 7700 ккал — грубая, но общепринятая оценка.
      weeksEstimate = Math.ceil((diffKg * 7700) / weeklyDelta);
    }
  }

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target: Math.round(target),
    proteinG,
    fatG,
    carbsG,
    weeksEstimate,
  };
}

function buildNutritionPrinciples(goalType, preferences) {
  const parts = [];

  if (goalType === "lose") {
    parts.push(
      "В каждый приём пищи старайся добавлять источник белка (яйца, курица, рыба, творог, бобовые) — так проще сохранить мышцы при дефиците калорий и дольше не голодать."
    );
    parts.push("Заполняй примерно половину тарелки овощами или зеленью — они дают объём и клетчатку почти без калорий.");
  } else if (goalType === "gain") {
    parts.push(
      "Ешь регулярно, 3–5 раз в день, и не пропускай приёмы пищи — при наборе массы важно стабильно закрывать дневную норму калорий, а не «догонять» одним большим ужином."
    );
    parts.push("Держи белок в каждом приёме пищи (мясо, рыба, яйца, творог, бобовые) — он идёт на восстановление и рост мышц.");
  } else {
    parts.push(
      "Собирай тарелку из белка, сложных углеводов (крупы, цельнозерновой хлеб, картофель) и овощей — это самый простой способ держать питание сбалансированным без подсчёта каждого грамма."
    );
  }

  parts.push(
    "Пей воду в течение дня и старайся ограничивать сладкие напитки и сильно переработанные продукты — они калорийны, но плохо насыщают."
  );
  parts.push(
    "Сон 7–9 часов важен не меньше еды: при недосыпе гормоны голода и насыщения работают против тебя, и любую цель по питанию держать становится сложнее."
  );

  if (preferences.includes("vegetarian") || preferences.includes("vegan")) {
    const dairyPart = preferences.includes("vegan") ? "" : ", яиц и молочных продуктов";
    parts.push(`Белок бери из бобовых, тофу, темпе, чечевицы${dairyPart} — комбинируй разные источники в течение дня, чтобы получить полный набор аминокислот.`);
  }
  if (preferences.includes("no_gluten")) {
    parts.push("Вместо пшеницы — рис, гречка, киноа, картофель: они дают углеводы без глютена.");
  }
  if (preferences.includes("no_dairy")) {
    parts.push("Молочные продукты замени растительным молоком и следи за кальцием — его много в зелени, кунжуте и обогащённых растительных напитках.");
  }
  if (preferences.includes("budget")) {
    parts.push("Недорогие источники белка — яйца, куриные бёдра, консервированная рыба, чечевица и другие бобовые; замороженные и сезонные овощи дешевле свежих не по сезону.");
  }
  if (preferences.includes("quick_meals")) {
    parts.push("Готовь заготовки на несколько дней вперёд (крупы, курица, овощи), а быстрые приёмы пищи собирай из простых сочетаний: йогурт с фруктами, яйца с овощами, консервы с крупой.");
  }

  return parts;
}

function buildWorkoutPrinciple(goalType) {
  if (goalType === "lose") {
    return "Для похудения хорошо работает связка: 2–3 кардиотренировки в неделю (бег, велосипед, плавание — можно логировать во вкладке «Спорт») по 30–45 минут, плюс 2 силовые тренировки, чтобы при дефиците калорий терять в основном жир, а не мышцы. Больше ходи пешком в течение дня — это тоже расход калорий, который часто недооценивают.";
  }
  if (goalType === "gain") {
    return "Для набора массы приоритет — силовые тренировки 3–4 раза в неделю с постепенным увеличением рабочих весов, кардио можно оставить лёгким, 1–2 раза в неделю, для здоровья сердца. Рост мышц требует и стабильного профицита калорий, и восстановления — не нагружай одну и ту же группу мышц два дня подряд.";
  }
  return "Для поддержания формы достаточно 3–4 тренировок в неделю в любом формате, который нравится и который получается выполнять регулярно, — регулярность важнее идеальной программы. Смешивай кардио и силовые, чтобы держать и выносливость, и мышцы.";
}

// Отпечаток входных данных, под которые сгенерирован план ИИ-тренера — как только
// что-то из этого поменялось, кэш в diet.aiPlan считается устаревшим (см. Diet()).
function computeInputsHash(profile) {
  return JSON.stringify([
    profile.weightKg,
    profile.heightCm,
    profile.age,
    profile.gender,
    profile.activityLevel,
    profile.goalType,
    profile.goalWeightKg,
    [...profile.preferences].sort(),
  ]);
}

// Простой инлайн-график веса — без библиотек, ломаная линия по точкам weightLog.
// Меньше двух точек рисовать нечего — просто подсказка, что график появится сам.
function WeightSparkline({ entries, goalWeightKg, accent }) {
  if (!entries || entries.length < 2) {
    return (
      <span className="faint" style={{ fontSize: 12, lineHeight: 1.5 }}>
        Записывай вес время от времени — здесь появится график прогресса.
      </span>
    );
  }

  const width = 100; // проценты — растягивается вместе с карточкой через viewBox
  const height = 40;
  const padX = 4;
  const padY = 6;

  const weights = entries.map((e) => e.weightKg);
  const values = goalWeightKg ? [...weights, goalWeightKg] : weights;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = entries.map((e, i) => {
    const x = padX + (i / (entries.length - 1)) * (width - padX * 2);
    const y = padY + (1 - (e.weightKg - min) / span) * (height - padY * 2);
    return { x, y };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const goalY = goalWeightKg != null ? padY + (1 - (goalWeightKg - min) / span) * (height - padY * 2) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 64 }} preserveAspectRatio="none">
        {goalY != null && (
          <line x1={0} y1={goalY} x2={width} y2={goalY} stroke="var(--icon-dim)" strokeWidth="0.6" strokeDasharray="2,2" />
        )}
        <path d={path} fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.4" fill={accent} />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="faint" style={{ fontSize: 10.5 }}>{formatLogDate(entries[0].date)}</span>
        <span className="faint" style={{ fontSize: 10.5 }}>{formatLogDate(entries[entries.length - 1].date)}</span>
      </div>
    </div>
  );
}

function formatLogDate(dateKey) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function Diet() {
  const { state, dispatch } = useStore();
  const { settings, diet } = state;
  const accent = settings.accent;

  const setHeight = () => {
    const v = promptNumber(diet.heightCm, "Рост (см):", { min: 100, max: 230 });
    if (v !== undefined) dispatch({ type: "SET_DIET_FIELD", field: "heightCm", value: v });
  };
  const setAge = () => {
    const v = promptNumber(diet.age, "Возраст (полных лет):", { min: 14, max: 100 });
    if (v !== undefined) dispatch({ type: "SET_DIET_FIELD", field: "age", value: v });
  };
  const setWeight = () => {
    const v = promptNumber(settings.weightKg, "Текущий вес (кг):", { min: 30, max: 300 });
    if (v !== undefined) dispatch({ type: "SET_WEIGHT", weightKg: v });
  };
  const setGoalWeight = () => {
    const v = promptNumber(diet.goalWeightKg, "Желаемый вес (кг):", { min: 30, max: 300 });
    if (v !== undefined) dispatch({ type: "SET_DIET_FIELD", field: "goalWeightKg", value: v });
  };

  const toggleGender = () => {
    haptic("light");
    dispatch({ type: "SET_DIET_FIELD", field: "gender", value: diet.gender === "male" ? "female" : "male" });
  };

  const cycleActivity = () => {
    haptic("light");
    const idx = ACTIVITY_LEVELS.findIndex((a) => a.id === diet.activityLevel);
    const next = ACTIVITY_LEVELS[(idx + 1) % ACTIVITY_LEVELS.length];
    dispatch({ type: "SET_DIET_FIELD", field: "activityLevel", value: next.id });
  };

  const cycleGoalType = () => {
    haptic("light");
    const idx = GOAL_TYPES.findIndex((g) => g.id === diet.goalType);
    const next = GOAL_TYPES[(idx + 1) % GOAL_TYPES.length];
    dispatch({ type: "SET_DIET_FIELD", field: "goalType", value: next.id });
  };

  const togglePreference = (id) => {
    haptic("light");
    dispatch({ type: "TOGGLE_DIET_PREFERENCE", pref: id });
  };

  const activity = ACTIVITY_LEVELS.find((a) => a.id === diet.activityLevel) || ACTIVITY_LEVELS[1];
  const goalTypeLabel = GOAL_TYPES.find((g) => g.id === diet.goalType)?.label || "Похудеть";

  const plan = useMemo(
    () =>
      computeDietPlan({
        weightKg: settings.weightKg,
        heightCm: diet.heightCm,
        age: diet.age,
        gender: diet.gender,
        activityLevel: diet.activityLevel,
        goalType: diet.goalType,
        goalWeightKg: diet.goalWeightKg,
      }),
    [settings.weightKg, diet.heightCm, diet.age, diet.gender, diet.activityLevel, diet.goalType, diet.goalWeightKg]
  );

  const principles = useMemo(() => buildNutritionPrinciples(diet.goalType, diet.preferences), [diet.goalType, diet.preferences]);
  const workoutText = useMemo(() => buildWorkoutPrinciple(diet.goalType), [diet.goalType]);

  // Отпечаток текущего профиля — как только он меняется, кэшированный план ИИ-тренера
  // считается устаревшим (см. hasFreshAiPlan/isStaleAiPlan ниже), и экран предлагает
  // обновить его заново, а не молча показывает разбор под старые цифры.
  const inputsHash = useMemo(
    () =>
      computeInputsHash({
        weightKg: settings.weightKg,
        heightCm: diet.heightCm,
        age: diet.age,
        gender: diet.gender,
        activityLevel: diet.activityLevel,
        goalType: diet.goalType,
        goalWeightKg: diet.goalWeightKg,
        preferences: diet.preferences,
      }),
    [settings.weightKg, diet.heightCm, diet.age, diet.gender, diet.activityLevel, diet.goalType, diet.goalWeightKg, diet.preferences]
  );

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const hasFreshAiPlan = Boolean(diet.aiPlan && diet.aiPlan.forHash === inputsHash);
  const isStaleAiPlan = Boolean(diet.aiPlan && diet.aiPlan.forHash !== inputsHash);

  // По кнопке (не автоматически!) просим сервер сгенерировать живой персональный разбор —
  // сервер сам откатится на ok:false, если ИИ недоступен, тогда просто оставляем статику.
  const requestAiPlan = async () => {
    if (!plan) return;
    const initData = getInitData();
    if (!initData) {
      setAiError("ИИ-тренер работает только внутри Telegram — открой приложение через бота.");
      return;
    }

    haptic("light");
    setAiLoading(true);
    setAiError(null);
    try {
      const resp = await fetch("/api/diet-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          profile: {
            gender: diet.gender,
            age: diet.age,
            heightCm: diet.heightCm,
            weightKg: settings.weightKg,
            goalWeightKg: diet.goalWeightKg,
            goalType: diet.goalType,
            activityLevel: diet.activityLevel,
            preferences: diet.preferences,
          },
          plan: { target: plan.target, proteinG: plan.proteinG, fatG: plan.fatG, carbsG: plan.carbsG },
        }),
      });

      if (resp.status === 429) {
        setAiError("Подожди немного и попробуй ещё раз.");
        return;
      }
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok) {
        setAiError("Не получилось получить план от ИИ-тренера — попробуй чуть позже.");
        return;
      }

      dispatch({ type: "SET_DIET_AI_PLAN", plan: { ...data.plan, forHash: inputsHash, generatedAt: Date.now() } });
      haptic("success");
    } catch {
      setAiError("Нет связи с сервером — проверь интернет и попробуй снова.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="screen">
      <div style={{ padding: "22px 20px 6px 20px", flex: "0 0 auto" }}>
        <span style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.3px" }}>Диета</span>
      </div>

      <div className="scroll">
        <div style={{ padding: "16px 20px 8px 20px", fontSize: 13, fontWeight: 600 }} className="faint">
          О ТЕБЕ
        </div>
        <div className="card" style={{ margin: "0 20px" }}>
          <Row label="Пол" value={diet.gender === "female" ? "Женский" : "Мужской"} onClick={toggleGender} noDivider />
          <Row label="Возраст" value={diet.age ? `${diet.age} лет` : "указать"} onClick={setAge} />
          <Row label="Рост" value={diet.heightCm ? `${diet.heightCm} см` : "указать"} onClick={setHeight} />
          <Row label="Текущий вес" value={`${settings.weightKg} кг`} onClick={setWeight} />
          <Row label="Активность" value={activity.label} onClick={cycleActivity} />
          <div style={{ padding: "0 16px 12px 16px" }}>
            <span className="faint" style={{ fontSize: 11.5 }}>{activity.hint}</span>
          </div>
        </div>

        <div style={{ padding: "22px 20px 8px 20px", fontSize: 13, fontWeight: 600 }} className="faint">
          ЦЕЛЬ
        </div>
        <div className="card" style={{ margin: "0 20px" }}>
          <Row label="Тип цели" value={goalTypeLabel} onClick={cycleGoalType} noDivider={diet.goalType === "maintain"} />
          {diet.goalType !== "maintain" && (
            <Row label="Желаемый вес" value={diet.goalWeightKg ? `${diet.goalWeightKg} кг` : "указать"} onClick={setGoalWeight} />
          )}
        </div>

        <div style={{ padding: "22px 20px 8px 20px", fontSize: 13, fontWeight: 600 }} className="faint">
          ПРЕДПОЧТЕНИЯ В ПИТАНИИ
        </div>
        <div className="card" style={{ margin: "0 20px", padding: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PREFERENCE_OPTIONS.map((opt) => {
              const active = diet.preferences.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => togglePreference(opt.id)}
                  style={{
                    border: "none",
                    borderRadius: 16,
                    padding: "8px 13px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    background: active ? accent : "var(--card-2)",
                    color: active ? "var(--on-accent)" : "var(--text)",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {!plan && (
          <div className="card" style={{ margin: "22px 20px 40px 20px", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>Заполни рост и возраст</span>
            <span className="faint" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Как только укажешь рост и возраст выше, здесь появится расчёт калорий, БЖУ и рекомендации по питанию и тренировкам под твою цель.
            </span>
          </div>
        )}

        {plan && (
          <>
            <div style={{ padding: "22px 20px 8px 20px", fontSize: 13, fontWeight: 600 }} className="faint">
              ТВОЙ РАСЧЁТ
            </div>

            <div style={{ margin: "0 20px" }}>
              <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: accent, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <FlameIcon style={{ width: 20, height: 20, color: "var(--on-accent)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 26, fontWeight: 700 }}>{plan.target} ккал</span>
                  <span className="faint" style={{ fontSize: 12.5 }}>целевая калорийность в день</span>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, padding: "10px 20px 0 20px" }}>
              <div className="card-2" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 17, fontWeight: 700 }}>{plan.proteinG} г</span>
                <span className="faint" style={{ fontSize: 11 }}>белки</span>
              </div>
              <div className="card-2" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 17, fontWeight: 700 }}>{plan.fatG} г</span>
                <span className="faint" style={{ fontSize: 11 }}>жиры</span>
              </div>
              <div className="card-2" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 17, fontWeight: 700 }}>{plan.carbsG} г</span>
                <span className="faint" style={{ fontSize: 11 }}>углеводы</span>
              </div>
            </div>

            <div style={{ padding: "10px 20px 0 20px" }}>
              <span className="faint" style={{ fontSize: 11.5 }}>
                Базовый обмен (BMR): {plan.bmr} ккал · расход с учётом активности (TDEE): {plan.tdee} ккал
                {plan.weeksEstimate ? ` · ориентировочно ≈ ${plan.weeksEstimate} нед. до цели по весу` : ""}
              </span>
            </div>

            <div style={{ padding: "22px 20px 8px 20px", fontSize: 13, fontWeight: 600 }} className="faint">
              ПРОГРЕСС
            </div>
            <div className="card" style={{ margin: "0 20px", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <WeightSparkline entries={diet.weightLog} goalWeightKg={diet.goalWeightKg} accent={accent} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span className="faint" style={{ fontSize: 12, lineHeight: 1.4 }}>
                  {diet.goalWeightKg
                    ? `До цели: ${Math.abs(settings.weightKg - diet.goalWeightKg)} кг`
                    : "Укажи желаемый вес в цели, чтобы видеть, сколько осталось"}
                </span>
                <button
                  onClick={setWeight}
                  style={{ flex: "0 0 auto", background: "var(--card-2)", border: "none", borderRadius: 10, padding: "9px 13px", fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}
                >
                  Записать вес
                </button>
              </div>
            </div>

            <div style={{ padding: "22px 20px 8px 20px", fontSize: 13, fontWeight: 600 }} className="faint">
              ИИ-ТРЕНЕР
            </div>
            <div className="card" style={{ margin: "0 20px", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {hasFreshAiPlan ? (
                <>
                  <span style={{ fontSize: 13.5, lineHeight: 1.6, fontStyle: "italic" }}>{diet.aiPlan.motivation}</span>
                  <button
                    onClick={requestAiPlan}
                    disabled={aiLoading}
                    style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: accent, fontSize: 12.5, fontWeight: 600 }}
                  >
                    {aiLoading ? "Обновляю…" : "Пересчитать план заново"}
                  </button>
                </>
              ) : (
                <>
                  <span className="faint" style={{ fontSize: 13, lineHeight: 1.5 }}>
                    {isStaleAiPlan
                      ? "Профиль изменился с прошлого раза — обнови персональный план у ИИ-тренера."
                      : "Получи живой персональный разбор питания, тренировок и конкретные идеи блюд под именно твои цифры — как будто с настоящим тренером."}
                  </span>
                  <button
                    onClick={requestAiPlan}
                    disabled={aiLoading}
                    style={{ background: accent, color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 600, fontSize: 14, opacity: aiLoading ? 0.7 : 1 }}
                  >
                    {aiLoading ? "Спрашиваю у ИИ-тренера…" : "🔥 Получить план от ИИ-тренера"}
                  </button>
                </>
              )}
              {aiError && <span style={{ fontSize: 11.5, color: "var(--bad)", lineHeight: 1.4 }}>{aiError}</span>}
            </div>

            <div style={{ padding: "20px 20px 8px 20px", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              Питание
              {hasFreshAiPlan && <AiBadge accent={accent} />}
            </div>
            <div className="card" style={{ margin: "0 20px", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {(hasFreshAiPlan ? diet.aiPlan.nutrition : principles).map((p, i) => (
                <span key={i} style={{ fontSize: 13.5, lineHeight: 1.5 }}>{p}</span>
              ))}
            </div>

            {hasFreshAiPlan && (
              <>
                <div style={{ padding: "20px 20px 8px 20px", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  Идеи блюд
                  <AiBadge accent={accent} />
                </div>
                <div className="card" style={{ margin: "0 20px", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  {diet.aiPlan.mealIdeas.map((m, i) => (
                    <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 13, marginTop: 1, flex: "0 0 auto" }}>🍽️</span>
                      <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>{m}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ padding: "20px 20px 8px 20px", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              Тренировки
              {hasFreshAiPlan && <AiBadge accent={accent} />}
            </div>
            <div className="card" style={{ margin: "0 20px", padding: 16 }}>
              <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>{hasFreshAiPlan ? diet.aiPlan.workout : workoutText}</span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "18px 20px 40px 20px" }}>
              <InfoIcon style={{ width: 14, height: 14, color: "var(--icon-dim)", marginTop: 1, flex: "0 0 auto" }} />
              <span className="faint" style={{ fontSize: 11, lineHeight: 1.5 }}>
                Это ориентировочный расчёт по стандартной формуле (Mifflin-St Jeor), а не медицинская рекомендация.
                Если есть хронические заболевания, ты беременна или кормишь грудью, либо было расстройство пищевого
                поведения — обсуди питание и нагрузки с врачом или диетологом, прежде чем что-то менять.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AiBadge({ accent }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: accent, background: "var(--card-2)", padding: "2px 7px", borderRadius: 8, letterSpacing: "0.02em" }}>
      ИИ
    </span>
  );
}

function Row({ label, value, onClick, noDivider }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", minHeight: 44,
        borderTop: noDivider ? "none" : "1px solid var(--card-border)", cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ flex: "1 1 auto", fontSize: 14.5 }}>{label}</span>
      {value && <span className="faint" style={{ fontSize: 13.5 }}>{value}</span>}
      {onClick && <ChevronRightIcon style={{ width: 16, height: 16, color: "var(--icon-dim)" }} />}
    </div>
  );
}
