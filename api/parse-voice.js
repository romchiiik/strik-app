// Эндпоинт для голосового ввода ВНУТРИ приложения (webapp/src/screens/Today.jsx,
// распознавание речи браузером через Web Speech API). Ключ ANTHROPIC_API_KEY не может
// жить в клиентском коде (это публичный бандл), поэтому сам ИИ-разбор всегда идёт
// через сервер — и отсюда (initData), и из api/voice-capture.js (Action Button, токен).
//
// Проверка — обычная initData, как и в api/reminders.js: запрос идёт из уже открытого
// внутри Telegram мини-аппа, так что initData всегда под рукой.

import { verifyInitData } from "./_lib/telegramAuth.js";
import { parseTasksSmart } from "./_lib/parseTasksAI.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const MAX_TEXT_LENGTH = 2000;

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

  const { initData, text } = req.body || {};
  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) {
    res.status(401).json({ error: "invalid_init_data" });
    return;
  }

  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "empty_text" });
    return;
  }

  const tasks = await parseTasksSmart(text.slice(0, MAX_TEXT_LENGTH));
  res.status(200).json({ ok: true, tasks });
}
