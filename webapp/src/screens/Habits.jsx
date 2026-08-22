import { useState } from "react";
import { useStore } from "../state/store.jsx";
import { haptic } from "../telegram.js";
import { DropletIcon, BookIcon, MeditationIcon, PlusIcon } from "../icons.jsx";

const ICONS = { droplet: DropletIcon, book: BookIcon, meditation: MeditationIcon };
const ICON_COLOR = { droplet: "var(--water)" };

export default function Habits() {
  const { state, dispatch } = useStore();
  const { goodHabits, quitHabits, settings } = state;
  const accent = settings.accent;
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const handleQuitReset = (habit) => {
    const ok = window.confirm(
      `Отметить срыв по привычке «${habit.title}»?\nТекущий счётчик (${habit.days} дн.) обнулится, рекорд сохранится.`
    );
    if (!ok) return;
    haptic("warning");
    dispatch({ type: "RESET_QUIT_HABIT", id: habit.id });
  };

  return (
    <div className="screen">
      <div style={{ padding: "22px 20px 6px 20px", flex: "0 0 auto" }}>
        <span style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.3px" }}>Привычки</span>
        <div className="faint" style={{ fontSize: 13, marginTop: 3 }}>Полезные и вредные — всё в одном месте</div>
      </div>

      <div className="scroll">
        <div style={{ padding: "16px 20px 8px 20px", fontSize: 14, fontWeight: 600, color: "var(--good)" }}>Полезные привычки</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "0 20px" }}>
          {goodHabits.map((habit) => {
            const Icon = ICONS[habit.icon];
            const iconColor = ICON_COLOR[habit.icon] || accent;
            const isCounter = habit.kind === "counter";
            const pct = isCounter ? Math.round((habit.current / habit.goal) * 100) : habit.doneToday ? 100 : 0;
            const fillColor = habit.id === "water" ? "var(--water)" : habit.doneToday || isCounter ? "var(--good)" : "var(--track)";
            return (
              <div key={habit.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: "var(--card-2)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                    <Icon style={{ width: 17, height: 17, color: iconColor }} />
                  </div>
                  <div style={{ flex: "1 1 auto" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{habit.title}</div>
                    <div className="faint" style={{ fontSize: 12 }}>
                      {isCounter
                        ? `${habit.current} из ${habit.goal} стаканов сегодня`
                        : `${habit.goalLabel} — ${habit.doneToday ? "готово" : "ещё не сегодня"}`}
                    </div>
                  </div>
                  {isCounter ? (
                    <button
                      onClick={() => { haptic("light"); dispatch({ type: "INCREMENT_WATER" }); }}
                      style={{ width: 30, height: 30, borderRadius: 15, background: "var(--water)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}
                      aria-label="Добавить стакан воды"
                    >
                      <PlusIcon style={{ width: 15, height: 15 }} />
                    </button>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 600 }} className="dim">
                      {habit.streakDays} <span className="faint" style={{ fontWeight: 400 }}>дн.</span>
                    </div>
                  )}
                </div>
                <div className="progress-track" style={{ marginTop: 11 }}>
                  <div className="progress-fill" style={{ width: `${pct}%`, background: fillColor }} />
                </div>
                {!isCounter && (
                  <button
                    onClick={() => { haptic("light"); dispatch({ type: "TOGGLE_HABIT_DONE", id: habit.id }); }}
                    style={{ marginTop: 10, fontSize: 12, background: "none", border: "none", color: accent, padding: 0, fontWeight: 600 }}
                  >
                    {habit.doneToday ? "Снять отметку" : "Отметить выполненным"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "22px 20px 8px 20px", fontSize: 14, fontWeight: 600, color: "var(--bad)" }}>Бросаю</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "0 20px 100px 20px" }}>
          {quitHabits.map((habit) => (
            <div key={habit.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 26, border: "2px solid var(--bad)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>{habit.days}</span>
                </div>
                <div style={{ flex: "1 1 auto" }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{habit.title}</div>
                  <div className="faint" style={{ fontSize: 12 }}>дней без срывов · рекорд {habit.record}</div>
                </div>
                <button
                  onClick={() => handleQuitReset(habit)}
                  style={{ fontSize: 12, background: "none", border: "none", color: "var(--dim)", padding: 0 }}
                >
                  Сорвался
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {adding && (
        <div className="card" style={{ position: "absolute", left: 20, right: 20, bottom: 96, padding: 14, display: "flex", flexDirection: "column", gap: 10, boxShadow: "var(--shadow)" }}>
          <span className="faint" style={{ fontSize: 12 }}>Новая полезная привычка</span>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Например: Растяжка"
            style={{ background: "var(--card-2)", border: "none", borderRadius: 10, padding: "8px 10px", color: "var(--text)", fontSize: 14 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                if (!newTitle.trim()) return;
                haptic("success");
                dispatch({
                  type: "ADD_GOOD_HABIT",
                  habit: {
                    id: `habit-${Date.now()}`,
                    title: newTitle.trim(),
                    icon: "book",
                    kind: "toggle",
                    doneToday: false,
                    streakDays: 0,
                    goalLabel: "новая привычка",
                  },
                });
                setAdding(false);
                setNewTitle("");
              }}
              style={{ flex: 1, background: accent, color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "10px 0", fontWeight: 600, fontSize: 14 }}
            >
              Добавить
            </button>
            <button onClick={() => setAdding(false)} style={{ flex: 1, background: "var(--card-2)", color: "var(--text)", border: "none", borderRadius: 10, padding: "10px 0", fontWeight: 600, fontSize: 14 }}>
              Отмена
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setAdding(true)}
        style={{ position: "absolute", right: 20, bottom: 98, width: 52, height: 52, borderRadius: 26, background: accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow)" }}
        aria-label="Добавить привычку"
      >
        <PlusIcon style={{ width: 22, height: 22, color: "var(--on-accent)" }} />
      </button>
    </div>
  );
}
