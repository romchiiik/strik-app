// Дёргается снаружи (GitHub Actions, раз в ~5 минут — см. .github/workflows/reminders.yml)
// с секретом в заголовке Authorization. Смотрит расписания всех пользователей, кто включил
// напоминания, и для задач, время которых уже наступило, шлёт сообщение от бота в Telegram —
// это единственный способ получить настоящий push на телефон из мини-аппа: у Telegram-вебвью
// нет доступа к Web Push, а обычное сообщение от бота даёт системное уведомление на телефоне.
//
// Vercel Cron на бесплатном плане умеет запускаться не чаще раза в день, поэтому реальный
// "будильник" здесь — внешний, бесплатный GitHub Actions.

import { redis } from "./_lib/redis.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

// Не шлём то, что "протухло" больше чем на полчаса — если крон не отработал вовремя
// (бывает при задержках GitHub Actions), лучше молча пропустить, чем прислать
// напоминание про давно прошедшее дело.
const WINDOW_MIN = 0;
const WINDOW_MAX_LATE = 30;
// Как долго держим отметку "уже отправлено" — с запасом на сутки, чтобы одна и та же
// задача не напомнила о себе повторно в тот же день.
const DEDUPE_TTL_SEC = 60 * 60 * 30;

function timeInZone(tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return {
      dateKey: `${map.year}-${map.month}-${map.day}`,
      minutes: Number(map.hour) * 60 + Number(map.minute),
    };
  } catch {
    // Некорректная/неизвестная таймзона — считаем по UTC, лучше так, чем не слать вообще.
    const now = new Date();
    return {
      dateKey: now.toISOString().slice(0, 10),
      minutes: now.getUTCHours() * 60 + now.getUTCMinutes(),
    };
  }
}

function parseTimeToMinutes(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || "");
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!resp.ok) {
    console.error("sendMessage failed", chatId, resp.status, await resp.text().catch(() => ""));
  }
}

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  if (!CRON_SECRET || !BOT_TOKEN || auth !== `Bearer ${CRON_SECRET}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const chatIds = (await redis.smembers("reminders:index")) || [];
  let checked = 0;
  let sent = 0;

  for (const chatId of chatIds) {
    const data = await redis.get(`reminders:${chatId}`);
    if (!data || !Array.isArray(data.schedule) || data.schedule.length === 0) continue;

    const { dateKey, minutes: nowMin } = timeInZone(data.timezone);

    for (const item of data.schedule) {
      checked++;
      const itemMin = parseTimeToMinutes(item.time);
      if (itemMin === null) continue;
      const diff = nowMin - itemMin;
      if (diff < WINDOW_MIN || diff > WINDOW_MAX_LATE) continue;

      const dedupeKey = `reminders:sent:${chatId}:${dateKey}:${item.id}`;
      const firstTime = await redis.set(dedupeKey, "1", { nx: true, ex: DEDUPE_TTL_SEC });
      if (!firstTime) continue; // уже отправляли сегодня

      await sendTelegramMessage(chatId, `⏰ ${item.title}\nПо расписанию на ${item.time}`);
      sent++;
    }
  }

  res.status(200).json({ ok: true, users: chatIds.length, checked, sent });
}
