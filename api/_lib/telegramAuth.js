// Проверка initData, которую присылает Telegram Mini App.
// Без этой проверки любой мог бы дёргать /api/reminders с чужим chatId и подсовывать
// произвольное расписание — человеку начали бы приходить чужие/поддельные напоминания.
// Алгоритм — официальный, из документации Telegram Bot API (Validating data
// received via the Mini App).

import crypto from "node:crypto";

export function verifyInitData(initData, botToken, maxAgeSec = 86400) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const pairs = [];
  for (const [key, value] of params.entries()) {
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  // timingSafeEqual требует одинаковую длину буферов — hash от Telegram всегда hex-строка
  // фиксированной длины (64 символа), но на всякий случай подстраховываемся сравнением длины.
  const a = Buffer.from(computedHash);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;

  let user = null;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    user = null;
  }
  if (!user?.id) return null;

  return user;
}
