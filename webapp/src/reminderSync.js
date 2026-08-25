// Синхронизация расписания с сервером напоминаний (api/reminders.js): сервер сам,
// в фоне, шлёт сообщение от бота в Telegram примерно во время каждой задачи
// (см. api/cron-reminders.js). Работает только внутри Telegram — initData нужен,
// чтобы сервер убедился, что запрос действительно от этого человека, а не от кого угодно.

let debounceTimer = null;

function getInitData() {
  return typeof window !== "undefined" ? window.Telegram?.WebApp?.initData : undefined;
}

function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

async function pushSync(schedule, remindersWanted) {
  const initData = getInitData();
  if (!initData) return; // не внутри Telegram — синхронизировать не с кем

  try {
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initData,
        schedule,
        timezone: getTimezone(),
        remindersWanted,
      }),
    });
  } catch {
    // Нет сети или сервер недоступен — не критично, попробуем при следующем изменении.
  }
}

// Дебаунс: расписание может измениться несколькими действиями подряд (голосовой ввод
// сразу добавляет несколько задач) — незачем слать запрос на каждое из них.
export function syncReminders(schedule, remindersWanted) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => pushSync(schedule, remindersWanted), 1200);
}
