// Принимает уже надиктованный (не через сайт, а нативным "Dictate Text" в Shortcuts на
// iPhone) текст и превращает его в задачи расписания — умным ИИ-разбором (см.
// api/_lib/parseTasksAI.js, используется и здесь, и в api/parse-voice.js для голосового
// ввода внутри самого приложения, чтобы логика не расходилась в двух местах). Если ИИ
// недоступен — parseTasksSmart сама откатывается на разбор по правилам.
//
// Проверка личности — не через Telegram initData (Shortcuts не может его получить, это
// не браузер внутри Telegram), а через личный токен из api/voice-token.js. Успешный запрос
// дописывает задачи в то же хранилище, что и обычная синхронизация расписания (api/reminders.js),
// и приложение подхватит их при следующем открытии (см. pullReminders в webapp/src/reminderSync.js).
// Дополнительно шлёт подтверждение в чат с ботом — обратная связь на телефон сразу же,
// не дожидаясь, пока откроется само приложение.

import { redis } from "./_lib/redis.js";
import { parseTasksSmart } from "./_lib/parseTasksAI.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const MAX_SCHEDULE_ITEMS = 50;
const MAX_TEXT_LENGTH = 2000;

async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error("sendMessage (voice-capture) failed", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const { token, text } = req.body || {};

  if (!token || typeof token !== "string") {
    res.status(401).json({ error: "missing_token" });
    return;
  }
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "empty_text" });
    return;
  }

  const chatId = await redis.get(`voicekey:token:${token}`);
  if (!chatId) {
    res.status(401).json({ error: "invalid_token" });
    return;
  }

  const clippedText = text.slice(0, MAX_TEXT_LENGTH);
  const parsedTasks = await parseTasksSmart(clippedText);

  const existing = (await redis.get(`reminders:${chatId}`)) || {
    chatId: String(chatId),
    schedule: [],
    timezone: "UTC",
    remindersWanted: false,
  };

  const newItems = parsedTasks.map((task, i) => ({
    id: `voice-capture-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    time: task.time,
    title: task.title,
  }));

  const mergedSchedule = [...(existing.schedule || []), ...newItems]
    .slice(-MAX_SCHEDULE_ITEMS)
    .sort((a, b) => a.time.localeCompare(b.time));

  await redis.set(`reminders:${chatId}`, {
    ...existing,
    chatId: String(chatId),
    schedule: mergedSchedule,
    updatedAt: Date.now(),
  });

  if (existing.remindersWanted) {
    await redis.sadd("reminders:index", String(chatId));
  }

  const summary = newItems.map((t) => `${t.time} — ${t.title}`).join("\n");
  await sendTelegramMessage(
    chatId,
    newItems.length > 1
      ? `🎙️ Добавлено с Action Button:\n${summary}`
      : `🎙️ Добавлено с Action Button: ${newItems[0]?.title || ""} (${newItems[0]?.time || ""})`
  );

  res.status(200).json({ ok: true, added: newItems.length });
}
