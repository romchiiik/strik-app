// POST — принимает от фронтенда актуальное расписание и сохраняет его в Redis:
//   1) чтобы крон (api/cron-reminders.js) знал, кому и когда напоминать;
//   2) чтобы то же расписание можно было забрать обратно (GET) — это нужно, например,
//      после того как задачи добавлены "снаружи" через api/voice-capture.js (надиктовано
//      через Action Button на айфоне), и фронтенду нужно их подхватить при следующем открытии.
//
// Важно: даже если человек выключил напоминания (remindersWanted=false), само расписание
// не удаляется — просто chatId убирается из индекса, который проверяет крон. Раньше тут был
// redis.del(...), что стирало и только что надиктованные задачи при следующей синхронизации
// с выключенными напоминаниями — теперь так не сделает.

import { redis } from "./_lib/redis.js";
import { verifyInitData } from "./_lib/telegramAuth.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const MAX_SCHEDULE_ITEMS = 50;

async function handleGet(req, res) {
  const initData = typeof req.query?.initData === "string" ? req.query.initData : "";
  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) {
    res.status(401).json({ error: "invalid_init_data" });
    return;
  }

  const chatId = String(user.id);
  const data = await redis.get(`reminders:${chatId}`);

  res.status(200).json({
    ok: true,
    schedule: data?.schedule || [],
    timezone: data?.timezone || null,
    remindersWanted: Boolean(data?.remindersWanted),
  });
}

async function handlePost(req, res) {
  const { initData, schedule, timezone, remindersWanted } = req.body || {};

  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) {
    res.status(401).json({ error: "invalid_init_data" });
    return;
  }

  const chatId = String(user.id);
  const wantsReminders = Boolean(remindersWanted);

  const cleanSchedule = Array.isArray(schedule)
    ? schedule
        .filter((item) => item && typeof item.time === "string" && typeof item.title === "string" && item.id)
        .slice(0, MAX_SCHEDULE_ITEMS)
        .map((item) => ({
          id: String(item.id),
          time: item.time,
          title: String(item.title).slice(0, 200),
          icon: typeof item.icon === "string" ? item.icon : undefined,
        }))
    : [];

  await redis.set(`reminders:${chatId}`, {
    chatId,
    schedule: cleanSchedule,
    timezone: typeof timezone === "string" && timezone ? timezone : "UTC",
    remindersWanted: wantsReminders,
    updatedAt: Date.now(),
  });

  if (wantsReminders && cleanSchedule.length > 0) {
    await redis.sadd("reminders:index", chatId);
  } else {
    await redis.srem("reminders:index", chatId);
  }

  res.status(200).json({ ok: true, stored: true, count: cleanSchedule.length });
}

export default async function handler(req, res) {
  if (!BOT_TOKEN) {
    console.error("Не задан BOT_TOKEN — не могу проверить initData.");
    res.status(500).json({ error: "server_misconfigured" });
    return;
  }

  if (req.method === "GET") {
    await handleGet(req, res);
    return;
  }

  if (req.method === "POST") {
    await handlePost(req, res);
    return;
  }

  res.status(405).json({ error: "method_not_allowed" });
}
