import { useMemo } from "react";
import { useStore, computeStreak, computeCounterStreak, quitRecord } from "../state/store.jsx";
import { getTelegramUser, isInsideTelegram, haptic, showAlert } from "../telegram.js";
import {
  BellIcon,
  MoonIcon,
  GlobeIcon,
  MicIcon,
  UserIcon,
  ChevronRightIcon,
  StarIcon,
} from "../icons.jsx";

const THEME_LABEL = { auto: "Как в Telegram", light: "Светлая", dark: "Тёмная" };
const THEME_ORDER = ["auto", "light", "dark"];

function formatMemberSince(key) {
  if (!key) return "недавно";
  const d = new Date(key + "T00:00:00Z");
  return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

export default function Profile() {
  const { state, dispatch } = useStore();
  const { profile, goodHabits, quitHabits, activities, settings } = state;
  const accent = settings.accent;

  const tgUser = getTelegramUser();

  const stats = useMemo(() => {
    const goodStreaks = goodHabits.map((h) =>
      h.kind === "counter" ? computeCounterStreak(h.history, h.goal) : computeStreak(h.history)
    );
    const quitStreaks = quitHabits.map((h) => quitRecord(h));
    const bestStreak = Math.max(0, ...quitStreaks, ...goodStreaks);
    return {
      bestStreak,
      habitsCount: goodHabits.length + quitHabits.length,
      workouts: activities.length,
    };
  }, [goodHabits, quitHabits, activities]);

  const cycleTheme = () => {
    haptic("light");
    const idx = THEME_ORDER.indexOf(settings.theme);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    dispatch({ type: "SET_THEME", theme: next });
  };

  const toggleReminders = () => {
    haptic("light");
    const next = !settings.remindersWanted;
    if (next) {
      showAlert(
        "Готово — бот пришлёт сообщение в Telegram примерно во время каждой задачи из " +
          "расписания на вкладке «Сегодня» (сервер проверяет расписание раз в ~5 минут, " +
          "так что возможна небольшая задержка). Просто держи расписание актуальным — " +
          "остальное сделает сервер."
      );
    }
    dispatch({ type: "SET_REMINDERS_WANTED", value: next });
  };

  const editWeight = () => {
    const value = window.prompt("Твой вес (кг) — используется для расчёта калорий:", settings.weightKg);
    const num = Number(value);
    if (value && Number.isFinite(num) && num > 20 && num < 300) {
      dispatch({ type: "SET_WEIGHT", weightKg: Math.round(num) });
    }
  };

  const displayName = tgUser?.first_name || profile.name;

  return (
    <div className="screen">
      <div style={{ padding: "22px 20px 6px 20px", flex: "0 0 auto" }}>
        <span style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.3px" }}>Профиль</span>
      </div>

      <div className="scroll">
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px 18px 20px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: "var(--card-2)", border: `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flex: "0 0 auto", overflow: "hidden" }}>
            {tgUser?.photo_url ? (
              <img src={tgUser.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              displayName[0]
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{displayName}</span>
              {tgUser?.is_premium && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, background: "var(--card-2)", padding: "3px 8px 3px 6px", borderRadius: 10 }}>
                  <StarIcon style={{ width: 11, height: 11, color: accent }} />
                  <span style={{ fontSize: 11, fontWeight: 600 }}>Premium</span>
                </span>
              )}
            </div>
            <span className="faint" style={{ fontSize: 12.5 }}>В приложении с {formatMemberSince(profile.memberSince)}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, padding: "0 20px 6px 20px" }}>
          <div className="card-2" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{stats.bestStreak}</span>
            <span className="faint" style={{ fontSize: 11 }}>лучший стрик</span>
          </div>
          <div className="card-2" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{stats.habitsCount}</span>
            <span className="faint" style={{ fontSize: 11 }}>привычек</span>
          </div>
          <div className="card-2" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{stats.workouts}</span>
            <span className="faint" style={{ fontSize: 11 }}>тренировки</span>
          </div>
        </div>

        <div style={{ padding: "22px 20px 8px 20px", fontSize: 13, fontWeight: 600 }} className="faint">ОБЩЕЕ</div>
        <div className="card" style={{ margin: "0 20px" }}>
          <Row
            icon={<BellIcon style={{ width: 19, height: 19, color: "var(--icon-neutral)" }} />}
            label="Уведомления"
            value={settings.remindersWanted ? "Включены" : "Выключены"}
            onClick={toggleReminders}
            noDivider
          />
          <Row
            icon={<MoonIcon style={{ width: 19, height: 19, color: "var(--icon-neutral)" }} />}
            label="Тема"
            value={THEME_LABEL[settings.theme]}
            onClick={cycleTheme}
          />
          <Row
            icon={<GlobeIcon style={{ width: 19, height: 19, color: "var(--icon-neutral)" }} />}
            label="Единицы измерения"
            value={`км, ${settings.weightKg} кг`}
            onClick={editWeight}
          />
        </div>

        <div style={{ padding: "22px 20px 8px 20px", fontSize: 13, fontWeight: 600 }} className="faint">ГОЛОСОВОЙ ПОМОЩНИК</div>
        <div className="card" style={{ margin: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", minHeight: 44 }}>
            <div style={{ width: 32, height: 32, borderRadius: 16, background: accent, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              <MicIcon style={{ width: 15, height: 15, color: "var(--on-accent)" }} />
            </div>
            <div style={{ flex: "1 1 auto" }}>
              <div style={{ fontSize: 14.5 }}>Быстрый вызов</div>
              <div className="faint" style={{ fontSize: 12 }}>Кнопка на экране «Сегодня»</div>
            </div>
          </div>
        </div>

        <div style={{ padding: "22px 20px 8px 20px", fontSize: 13, fontWeight: 600 }} className="faint">АККАУНТ</div>
        <div className="card" style={{ margin: "0 20px 40px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", minHeight: 44 }}>
            <UserIcon style={{ width: 19, height: 19, color: "var(--icon-neutral)", flex: "0 0 auto" }} />
            <span style={{ flex: "1 1 auto", fontSize: 14.5 }}>Telegram-аккаунт</span>
            <span className="faint" style={{ fontSize: 13.5 }}>
              {tgUser?.username ? `@${tgUser.username}` : isInsideTelegram() ? "без username" : "не в Telegram"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value, onClick, noDivider }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", minHeight: 44,
        borderTop: noDivider ? "none" : "1px solid var(--card-border)", cursor: onClick ? "pointer" : "default",
      }}
    >
      {icon}
      <span style={{ flex: "1 1 auto", fontSize: 14.5 }}>{label}</span>
      {value && <span className="faint" style={{ fontSize: 13.5 }}>{value}</span>}
      {onClick && <ChevronRightIcon style={{ width: 16, height: 16, color: "var(--icon-dim)" }} />}
    </div>
  );
}
