// Общий клиент для вызова Claude (Anthropic API) с сервера — используется и для
// умного разбора надиктованного текста (parseTasksAI.js), и для ИИ-тренера в
// "Диете" (api/diet-coach.js).
//
// Ключ ANTHROPIC_API_KEY нужно завести на https://console.anthropic.com/ и вписать
// в переменные окружения проекта на Vercel (Project Settings → Environment Variables).
// Без ключа callClaude выбрасывает ошибку — все вызывающие места обязаны ловить её
// и откатываться на обычную, не-ИИ логику (см. комментарии в parseTasksAI.js и
// diet-coach.js), чтобы приложение не ломалось, пока ключ не добавлен или недоступен.

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_TIMEOUT_MS = 12000;

// Модели можно поменять переменными окружения, если названия ниже устареют —
// поэтому строка модели нигде не захардкожена по всему проекту, только тут.
export const FAST_MODEL = process.env.AI_MODEL_FAST || "claude-3-5-haiku-20241022";
export const SMART_MODEL = process.env.AI_MODEL_SMART || "claude-sonnet-4-5-20250929";

export class AIUnavailableError extends Error {}

// system/user — обычные строки. Возвращает текст ответа (первый text-блок).
// Бросает AIUnavailableError, если ключа нет, был таймаут, или Anthropic вернул ошибку —
// вызывающий код в этом случае должен откатиться на не-ИИ логику, а не падать сам.
export async function callClaude({ system, user, model = FAST_MODEL, maxTokens = 1024, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AIUnavailableError("ANTHROPIC_API_KEY не задан");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new AIUnavailableError(`Anthropic API ${resp.status}: ${body.slice(0, 300)}`);
    }

    const data = await resp.json();
    const text = data?.content?.find((b) => b.type === "text")?.text;
    if (!text) throw new AIUnavailableError("Пустой ответ от модели");
    return text;
  } catch (err) {
    if (err?.name === "AbortError") throw new AIUnavailableError("Таймаут запроса к ИИ");
    if (err instanceof AIUnavailableError) throw err;
    throw new AIUnavailableError(err?.message || "Не удалось связаться с ИИ");
  } finally {
    clearTimeout(timer);
  }
}

// Модель иногда оборачивает JSON в ```json ... ``` или добавляет текст вокруг —
// вытаскиваем самый большой { ... } или [ ... ] блок и парсим его.
export function extractJson(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // ищем первую { или [ и последнюю парную } или ]
  }
  const firstObj = trimmed.indexOf("{");
  const firstArr = trimmed.indexOf("[");
  let start = -1;
  let endChar = "}";
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr;
    endChar = "]";
  } else if (firstObj !== -1) {
    start = firstObj;
    endChar = "}";
  }
  if (start === -1) throw new Error("В ответе нет JSON");
  const end = trimmed.lastIndexOf(endChar);
  if (end === -1 || end <= start) throw new Error("В ответе нет корректного JSON");
  return JSON.parse(trimmed.slice(start, end + 1));
}
