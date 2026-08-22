import { createContext, useContext, useEffect, useMemo, useReducer } from "react";

const STORAGE_KEY = "habit-app-state-v1";

const initialState = {
  profile: {
    name: "Роман",
    memberSince: "августа 2026",
  },
  settings: {
    theme: "auto", // "auto" | "light" | "dark"
    accent: "#3D5AFE",
    units: "km-kg",
    weightKg: 75,
  },
  schedule: [
    { id: "wake", time: "07:00", title: "Подъём", subtitle: "Начало дня", icon: "sun", done: false },
    { id: "work", time: "09:00", title: "Работа", subtitle: "До 18:00", icon: "briefcase", done: false },
    { id: "run", time: "19:00", title: "Пробежка 5 км", subtitle: "Спорт", icon: "run", done: false },
    { id: "meditate-block", time: "21:00", title: "Медитация 15 мин", subtitle: "Привычка", icon: "meditation", done: true, linkedHabit: "meditate" },
    { id: "sleep", time: "23:00", title: "Сон", subtitle: "8 часов", icon: "moon", done: false },
  ],
  goodHabits: [
    { id: "water", title: "Вода", icon: "droplet", kind: "counter", current: 5, goal: 8, streakDays: 21 },
    { id: "read", title: "Чтение", icon: "book", kind: "toggle", doneToday: true, streakDays: 6, goalLabel: "20 минут" },
    { id: "meditate", title: "Медитация", icon: "meditation", kind: "toggle", doneToday: true, streakDays: 12, goalLabel: "15 минут" },
  ],
  quitHabits: [
    { id: "smoking", title: "Курение", days: 14, record: 21 },
    { id: "alcohol", title: "Алкоголь", days: 30, record: 30 },
  ],
  activities: [
    { id: 1, type: "run", label: "Пробежка", dateLabel: "Вчера, 19:04", distanceKm: 5.2, durationMin: 28 },
    { id: 2, type: "bike", label: "Велопрогулка", dateLabel: "Четверг, 20:15", distanceKm: 11.2, durationMin: 42 },
    { id: 3, type: "run", label: "Пробежка", dateLabel: "Вторник, 07:32", distanceKm: 4.0, durationMin: 22 },
  ],
};

function loadInitialState() {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw);
    // Мелкая защита от повреждённых/старых данных — сливаем поверх дефолта.
    return { ...initialState, ...saved };
  } catch {
    return initialState;
  }
}

function reducer(state, action) {
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

    case "INCREMENT_WATER":
      return {
        ...state,
        goodHabits: state.goodHabits.map((h) =>
          h.id === "water" ? { ...h, current: Math.min(h.goal, h.current + 1) } : h
        ),
      };

    case "TOGGLE_HABIT_DONE":
      return {
        ...state,
        goodHabits: state.goodHabits.map((h) =>
          h.id === action.id ? { ...h, doneToday: !h.doneToday } : h
        ),
      };

    case "RESET_QUIT_HABIT":
      return {
        ...state,
        quitHabits: state.quitHabits.map((h) =>
          h.id === action.id
            ? { ...h, record: Math.max(h.record, h.days), days: 0 }
            : h
        ),
      };

    case "ADD_GOOD_HABIT":
      return { ...state, goodHabits: [...state.goodHabits, action.habit] };

    case "ADD_ACTIVITY":
      return { ...state, activities: [action.activity, ...state.activities] };

    case "SET_THEME":
      return { ...state, settings: { ...state.settings, theme: action.theme } };

    case "SET_ACCENT":
      return { ...state, settings: { ...state.settings, accent: action.accent } };

    case "SET_WEIGHT":
      return { ...state, settings: { ...state.settings, weightKg: action.weightKg } };

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
