// Выдаёт (или создаёт при первом запросе) личный непубличный токен пользователя —
// нужен для api/voice-capture.js. Смысл: Shortcuts на iPhone не умеет открыть Mini App
// и получить initData, поэтому вместо проверки через Telegram он ходит на отдельный
// эндпоинт с этим токеном в качестве пароля. Сам токен выдаётся только отсюда, и только
// тому, кто прошёл настоящую проверку initData — то есть только из открытого в Telegram
// Mini App.

import crypto from "node:crypto";
import { redis } from "./_lib/redis.js";
import { verifyInitData } from "./_lib/telegramAuth.js";

const BOT_TOKEN = process.env.BOT_TOKEN;

function newToken() {
  return crypto.randomBytes(24).toString("hex");
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

  const { initData, regenerate } = req.body || {};
  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) {
    res.status(401).json({ error: "invalid_init_data" });
    return;
  }

  const chatId = String(user.id);
  const byChatKey = `voicekey:byChat:${chatId}`;

  let token = regenerate ? null : await redis.get(byChatKey);

  if (token) {
    // Токен уже существовал — убедимся, что обратная запись на месте (на случай, если
    // индекс когда-то разошёлся), и вернём тот же самый, чтобы не ломать уже настроенный
    // на телефоне Shortcut.
    await redis.set(`voicekey:token:${token}`, chatId);
  } else {
    if (regenerate) {
      const oldToken = await redis.get(byChatKey);
      if (oldToken) await redis.del(`voicekey:token:${oldToken}`);
    }
    token = newToken();
    await redis.set(byChatKey, token);
    await redis.set(`voicekey:token:${token}`, chatId);
  }

  res.status(200).json({ ok: true, token });
}
