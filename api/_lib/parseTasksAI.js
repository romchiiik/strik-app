// Умный разбор надиктованной фразы: вместо того чтобы искать ключевые слова по
// регуляркам (как делает webapp/src/voiceParser.js), просим настоящую модель
// вычленить суть — даже если человек наговорил "воды" вокруг главной мысли.
// Используется и из api/parse-voice.js (голос внутри приложения), и из
// api/voice-capture.js (Action Button на айфоне) — единая точка, чтобы разбор
// не расходился между двумя входами.
//
// Если ключа нет, или модель недоступна/ответила не тем, чем нужно — тихо
// откатываемся на parseVoiceTasks (обычные правила). Голосовой ввод не должен
// ломаться из-за проблем с ИИ.

import { callClaude, extractJson, FAST_MODEL, AIUnavailableError } from "./ai.js";
import { parseVoiceTasks } from "../../webapp/src/voiceParser.js";

const ALLOWED_ICONS = new Set(["run", "meditation", "briefcase", "moon", "sun"]);
const MAX_TASKS = 10;

const SYSTEM_PROMPT = `Ты — ассистент, который превращает надиктованную русскую речь в список задач расписания на день.
Человек может говорить длинно, сбивчиво, с "водой" — словами-паразитами, отступлениями, повторами. Твоя задача — понять
главную мысль и вытащить из неё РЕАЛЬНЫЕ действия/задачи, а не пересказывать всё подряд.

Правила:
- Игнорируй слова-паразиты и воду ("короче", "блин", "как бы", "в общем", "ну вот", "типа" и т.п.) — их не должно быть в title.
- Если в фразе несколько разных дел — верни несколько задач. Если одно дело сказано длинно — верни одну задачу с коротким title.
- title — короткая, ясная формулировка дела (2-6 слов), с большой буквы, без лишних слов и без кавычек.
- Если время явно названо (цифрами или словами вроде "в семь утра", "в 19:30") — верни его в поле time как "ЧЧ:ММ" (24-часовой формат).
- Если названа только часть дня без точного времени — используй: утро → "09:00", обед/день → "13:00", вечер → "19:00",
  перед сном → "22:30", ночь → "23:00".
- Если времени и части дня вообще нет — верни time: null (сервер сам подставит свободный слот).
- icon — одно из: "run" (спорt/бег/зал/тренировка), "meditation" (медитация/дыхательные практики), "briefcase" (работа/встречи/дедлайны),
  "moon" (сон), "sun" (всё остальное). Если не уверен — "sun".

Ответь СТРОГО JSON-массивом без каких-либо пояснений вокруг, вот так:
[{"title":"Позвонить маме","time":null,"icon":"sun"},{"title":"Пробежка","time":"07:00","icon":"run"}]
Если в тексте вообще нет ничего похожего на задачу/дело — верни пустой массив [].`;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isValidTime(t) {
  return typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

function sanitizeAiTasks(raw) {
  if (!Array.isArray(raw)) return null;

  const tasks = [];
  let autoSlotHour = 9;

  for (const item of raw.slice(0, MAX_TASKS)) {
    const title = typeof item?.title === "string" ? item.title.trim().slice(0, 120) : "";
    if (!title) continue;

    let time = isValidTime(item?.time) ? item.time : null;
    if (!time) {
      time = `${pad2(Math.min(21, autoSlotHour))}:00`;
      autoSlotHour += 2;
    }

    const icon = ALLOWED_ICONS.has(item?.icon) ? item.icon : "sun";
    tasks.push({ title, time, icon });
  }

  return tasks;
}

export async function parseTasksSmart(rawText) {
  const text = (rawText || "").trim();
  if (!text) return [];

  try {
    const response = await callClaude({
      system: SYSTEM_PROMPT,
      user: text,
      model: FAST_MODEL,
      maxTokens: 800,
      timeoutMs: 9000,
    });
    const parsed = extractJson(response);
    const sanitized = sanitizeAiTasks(parsed);
    if (sanitized && sanitized.length > 0) return sanitized;
    if (Array.isArray(parsed) && parsed.length === 0) return []; // ИИ осознанно решил, что задач нет
    throw new Error("Пустой/некорректный список задач от ИИ");
  } catch (err) {
    if (!(err instanceof AIUnavailableError)) {
      console.error("parseTasksSmart: ИИ вернул неразбираемый ответ, откат на правила", err);
    }
    return parseVoiceTasks(text);
  }
}
