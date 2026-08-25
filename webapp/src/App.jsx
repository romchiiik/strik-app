import { useEffect, useState } from "react";
import { StoreProvider, useStore } from "./state/store.jsx";
import TabBar from "./components/TabBar.jsx";
import Today from "./screens/Today.jsx";
import Habits from "./screens/Habits.jsx";
import Sport from "./screens/Sport.jsx";
import Profile from "./screens/Profile.jsx";
import { initTelegram, getTelegramColorScheme, onThemeChanged } from "./telegram.js";
import { syncReminders } from "./reminderSync.js";

function useEffectiveTheme(preference) {
  const [systemTheme, setSystemTheme] = useState(
    getTelegramColorScheme() ||
      (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark")
  );

  useEffect(() => {
    const offTelegram = onThemeChanged(() => {
      const scheme = getTelegramColorScheme();
      if (scheme) setSystemTheme(scheme);
    });

    const mql = window.matchMedia?.("(prefers-color-scheme: light)");
    const onMqlChange = (e) => {
      if (!getTelegramColorScheme()) setSystemTheme(e.matches ? "light" : "dark");
    };
    mql?.addEventListener?.("change", onMqlChange);

    return () => {
      offTelegram();
      mql?.removeEventListener?.("change", onMqlChange);
    };
  }, []);

  return preference === "auto" ? systemTheme : preference;
}

function Shell() {
  const { state } = useStore();
  const [tab, setTab] = useState("today");
  const theme = useEffectiveTheme(state.settings.theme);
  const accent = state.settings.accent;

  useEffect(() => {
    initTelegram();
  }, []);

  // Каждый раз, как меняется расписание или флажок "хочу напоминания" — отправляем
  // актуальное состояние на сервер, чтобы бот знал, кому и когда напоминать.
  useEffect(() => {
    syncReminders(state.schedule, state.settings.remindersWanted);
  }, [state.schedule, state.settings.remindersWanted]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.setProperty("--accent", accent);
  }, [theme, accent]);

  return (
    <div className="app-root">
      {tab === "today" && <Today />}
      {tab === "habits" && <Habits />}
      {tab === "sport" && <Sport />}
      {tab === "profile" && <Profile />}
      <TabBar active={tab} onChange={setTab} accent={accent} />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
