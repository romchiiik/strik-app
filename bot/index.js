import "dotenv/config";
import { Telegraf, Markup } from "telegraf";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

if (!BOT_TOKEN) {
  console.error("Не задан BOT_TOKEN в .env (возьми его у @BotFather).");
  process.exit(1);
}
if (!WEBAPP_URL) {
  console.error("Не задан WEBAPP_URL в .env — адрес, где задеплоен фронтенд мини-аппа (обязательно https).");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Постоянная кнопка меню рядом с полем ввода — открывает мини-апп в один тап.
// Не обязательна (можно открыть и через инлайн-кнопку ниже), но с ней приложение
// выглядит "нативной" частью Telegram, а не разовой ссылкой.
await bot.telegram.setChatMenuButton({
  menuButton: { type: "web_app", text: "Привычки", web_app: { url: WEBAPP_URL } },
});

bot.start((ctx) => {
  ctx.reply(
    "Привет! Это «Привычки» — помогает распланировать день, избавиться от вредных привычек и добавить полезные.",
    Markup.inlineKeyboard([Markup.button.webApp("📲 Открыть приложение", WEBAPP_URL)])
  );
});

bot.help((ctx) => {
  ctx.reply("Просто нажми на кнопку меню рядом с полем ввода (иконка «Привычки»), чтобы открыть приложение.");
});

bot.launch();
console.log("Бот запущен. Ctrl+C для остановки.");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
