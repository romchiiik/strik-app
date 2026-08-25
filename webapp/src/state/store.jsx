import { createContext, useContext, useEffect, useMemo, useReducer } from "react";

const STORAGE_KEY = "habit-app-state-v2";

// --- Даты и стрики -----------------------------------------------------
// Вся логика стриков считается "на лету" из истории отметок, а не хранится
// готовым числом — так счётчики никогда не расходятся с реальными действиями
// пользователя и переживают переход через полночь без миграций.

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function daysBetween(fromKey, toKey) {
  const a = new Date(fromKey + "T00:00:00Z");
  const b = new Date(toKey + "T00:00:00Z");
  return Math.max(0, Math.round((b - a) / 86400000));
}

// Стрик = число подряд идущих дней с отметкой, заканчивая сегодня
// (или вчера, если сегодня ещё не отмечено — чтобы стрик не обнулялся
// раньше времени в течение дня).
export function computeStreak(doneMap) {
  const done = new Set(Object.keys(doneMap || {}).filter((k) => doneMap[k]));
  if (done.size === 0) return 0;
  const cursor = new Date();
  if (!done.has(todayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  while (done.has(todayKey(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function computeCounterStreak(history, goal) {
  const doneMap = Object.fromEntries(
    Object.entries(history || {}).map(([k, v]) => [k, v >= goal])
  );
  return computeStreak(doneMap);
}

// Текущий стаж привычки, от которой избавляются (дней без срыва).
export function quitDays(habit, todayK = todayKey()) {
  return daysBetween(habit.startDate, todayK);
}

export function quitRecord(habit, todayK = todayKey()) {
  return Math.max(habit.record || 0, quitDays(habit, todayK));
}

const initialState = {
  profile: {
    name: "Роман",
    memberSince: null, // проставляется один раз при первом запуске
  },
  settings: {
    theme: "auto", // "auto" | "light" | "dark"
    accent: "#3D5AFE",
    units: "km-kg",
    weightKg: 75,
    remindersWanted: false, // хочет ли человек push-напоминания от бота (сама доставка — отдельная бэкенд-часть)
  },
  schedule: [],
  goodHabits: [],
  quitHabits: [],
  activities: [],
};

function loadInitialState() {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...initialState, profile: { ...initialState.profile, memberSince: todayKey() } };
    }
    const saved = JSON.parse(raw);
    const merged = { ...initialState, ...saved };
    if (!merged.profile?.memberSince) {
      merged.profile = { ...merged.profile, memberSince: todayKey() };
    }
    return merged;
  } catch {
    return { ...initialState, profile: { ...initialState.profile, memberSince: todayKey() } };
  }
}

function reducer(state, action) {
  const today = todayKey();
  switch (action.type) {
    case "TOGGLE_SCHEDULE":
      return {
        ...state,
        schedule: state.schedule.map((item) =>
          item.id === action.id ? { ...item, done: !item.done } : item
        ),
      };

    case "ADD_SCHEDULE_ITEM":
      return {
        ...state,
        schedule: [...state.schedule, action.item].sort((a, b) => a.time.localeCompare(b.time)),
      };

    case "REMOVE_SCHEDULE_ITEM":
      return { ...state, schedule: state.schedule.filter((i) => i.id !== action.id) };

    case "INCREMENT_COUNTER_HABIT":
      return {
        ...state,
        goodHabits: state.goodHabits.map((h) => {
          if (h.id !== action.id || h.kind !== "counter") return h;
          const current = h.history?.[today] || 0;
          if (current >= h.goal) return h;
          return { ...h, history: { ...h.history, [today]: current + 1 } };
        }),
      };

    case "TOGGLE_HABIT_DONE":
      return {
        ...state,
        goodHabits: state.goodHabits.map((h) => {
          if (h.id !== action.id || h.kind !== "toggle") return h;
          const isDone = Boolean(h.history?.[today]);
          return { ...h, history: { ...h.history, [today]: !isDone } };
        }),
      };

    case "ADD_GOOD_HABIT":
      return {
        ...state,
        goodHabits: [
          ...state.goodHabits,
          { ...action.habit, history: {}, createdAt: today },
        ],
      };

    case "REMOVE_GOOD_HABIT":
      return { ...state, goodHabits: state.goodHabits.filter((h) => h.id !== action.id) };

    case "ADD_QUIT_HABIT":
      return {
        ...state,
        quitHabits: [
          ...state.quitHabits,
          { ...action.habit, startDate: today, record: 0 },
        ],
      };

    case "REMOVE_QUIT_HABIT":
      return { ...state, quitHabits: state.quitHabits.filter((h) => h.id !== action.id) };

    case "RESET_QUIT_HABIT":
      return {
        ...state,
        quitHabits: state.quitHabits.map((h) =>
          h.id === action.id
            ? { ...h, record: quitRecord(h, today), startDate: today }
            : h
        ),
      };

    case "ADD_ACTIVITY":
      return { ...state, activities: [action.activity, ...state.activities] };

    case "SET_THEME":
      return { ...state, settings: { ...state.settings, theme: action.theme } };

    case "SET_ACCENT":
      return { ...state, settings: { ...state.settings, accent: action.accent } };

    case "SET_WEIGHT":
      return { ...state, settings: { ...state.settings, weightKg: action.weightKg } };

    case "SET_REMINDERS_WANTED":
      return { ...state, settings: { ...state.settings, remindersWanted: action.value } };

    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage может быть недоступен — не критично для работы приложения.
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore должен вызываться внутри StoreProvider");
  return ctx;
}
