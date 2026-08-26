// Синхронизация расписания с сервером напоминаний (api/reminders.js): сервер сам,
// в фоне, шлёт сообщение от бота в Telegram примерно во время каждой задачи
// (см. api/cron-reminders.js). Работает только внутри Telegram — initData нужен,
// чтобы сервер убедился, что запрос действительно от этого человека, а не от кого угодно.
//
// Вторая часть — pullReminders: подтягивает то, что могло появиться на сервере "снаружи"
// приложения (например, задачи, надиктованные через Action Button на айфоне — см.
// api/voice-capture.js). Сама эта функция ничего не решает — она просто возвращает те
// серверные задачи, которых ещё нет локально, а куда их деть (dispatch) решает вызывающий код.

let debounceTimer = null;

export function getInitData() {
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

// Возвращает массив новых задач (в формате, готовом для ADD_SCHEDULE_ITEM), которые есть
// на сервере, но которых ещё нет в переданном локальном расписании. Ничего не мутирует
// и не диспатчит сама — так проще тестировать и не привязываться к конкретному reducer'у.
export async function pullReminders(localSchedule) {
  const initData = getInitData();
  if (!initData) return [];

  try {
    const url = `/api/reminders?initData=${encodeURIComponent(initData)}`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    const serverSchedule = Array.isArray(data?.schedule) ? data.schedule : [];

    const localIds = new Set(localSchedule.map((item) => item.id));
    return serverSchedule
      .filter((item) => item?.id && !localIds.has(item.id))
      .map((item) => ({
        id: item.id,
        time: item.time,
        title: item.title,
        subtitle: "Добавлено с Action Button",
        icon: item.icon || "sun",
        done: false,
      }));
  } catch {
    return [];
  }
}
