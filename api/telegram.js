// Serverless-вебхук для Vercel. Никакого постоянно работающего процесса —
// эта функция "просыпается" только когда Telegram присылает апдейт (сообщение,
// нажатие кнопки и т.д.), и после ответа снова "засыпает". Именно поэтому боту
// не нужен ни включённый компьютер, ни терминал, ни отдельный сервер.

import { Telegraf, Markup } from "telegraf";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

// Telegraf-инстанс создаётся один раз при "холодном старте" функции
// и переиспользуется, пока Vercel держит функцию "тёплой".
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply(
    "Привет! Это «Привычки» — помогает распланировать день, избавиться от вредных привычек и добавить полезные.",
    Markup.inlineKeyboard([Markup.button.webApp("📲 Открыть приложение", WEBAPP_URL)])
  );
});

bot.help((ctx) => {
  ctx.reply("Нажми на кнопку меню рядом с полем ввода (иконка «Привычки»), чтобы открыть приложение.");
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(200).send("Бот работает. Этот адрес принимает вебхуки от Telegram.");
    return;
  }

  if (!BOT_TOKEN || !WEBAPP_URL) {
    console.error("Не заданы переменные окружения BOT_TOKEN / WEBAPP_URL в настройках проекта Vercel.");
    res.status(200).end(); // Telegram всё равно ждёт 200, иначе будет повторять запрос
    return;
  }

  try {
    await bot.handleUpdate(req.body, res);
  } catch (err) {
    console.error("Ошибка обработки апдейта:", err);
  }

  if (!res.writableEnded) {
    res.status(200).end();
  }
}
