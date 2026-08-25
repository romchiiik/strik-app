// Принимает от фронтенда актуальное расписание пользователя и сохраняет его в Redis,
// чтобы отдельный крон (api/cron-reminders.js, дёргается снаружи каждые ~5 минут)
// мог позже разослать напоминания в нужное время — сама эта функция ничего не шлёт,
// она только запоминает, что и когда напомнить.

import { redis } from "./_lib/redis.js";
import { verifyInitData } from "./_lib/telegramAuth.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const MAX_SCHEDULE_ITEMS = 50;

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

  const { initData, schedule, timezone, remindersWanted } = req.body || {};

  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) {
    res.status(401).json({ error: "invalid_init_data" });
    return;
  }

  const chatId = String(user.id);

  if (!remindersWanted || !Array.isArray(schedule) || schedule.length === 0) {
    // Напоминания выключены или расписание пустое — убираем пользователя из индекса,
    // чтобы крон его не проверял и точно ничего не слал.
    await redis.srem("reminders:index", chatId);
    await redis.del(`reminders:${chatId}`);
    res.status(200).json({ ok: true, stored: false });
    return;
  }

  const cleanSchedule = schedule
    .filter((item) => item && typeof item.time === "string" && typeof item.title === "string" && item.id)
    .slice(0, MAX_SCHEDULE_ITEMS)
    .map((item) => ({ id: String(item.id), time: item.time, title: String(item.title).slice(0, 200) }));

  await redis.set(`reminders:${chatId}`, {
    chatId,
    schedule: cleanSchedule,
    timezone: typeof timezone === "string" && timezone ? timezone : "UTC",
    updatedAt: Date.now(),
  });
  await redis.sadd("reminders:index", chatId);

  res.status(200).json({ ok: true, stored: true, count: cleanSchedule.length });
}
