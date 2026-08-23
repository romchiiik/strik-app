import { useState } from "react";
import { useStore, computeStreak, computeCounterStreak, quitDays, quitRecord } from "../state/store.jsx";
import { haptic } from "../telegram.js";
import {
  DropletIcon,
  BookIcon,
  MeditationIcon,
  TargetIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "../icons.jsx";

const GOOD_ICONS = [
  { id: "book", Icon: BookIcon },
  { id: "meditation", Icon: MeditationIcon },
  { id: "droplet", Icon: DropletIcon },
  { id: "target", Icon: TargetIcon },
];
const ICON_MAP = Object.fromEntries(GOOD_ICONS.map((i) => [i.id, i.Icon]));

function emptyGoodDraft() {
  return { title: "", icon: "book", kind: "toggle", goal: 8, unit: "раз" };
}

export default function Habits() {
  const { state, dispatch } = useStore();
  const { goodHabits, quitHabits, settings } = state;
  const accent = settings.accent;
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState("good"); // "good" | "quit"
  const [goodDraft, setGoodDraft] = useState(emptyGoodDraft());
  const [quitTitle, setQuitTitle] = useState("");

  const isEmpty = goodHabits.length === 0 && quitHabits.length === 0;

  const closeForm = () => {
    setAdding(false);
    setGoodDraft(emptyGoodDraft());
    setQuitTitle("");
  };

  const submitGood = () => {
    if (!goodDraft.title.trim()) return;
    haptic("success");
    dispatch({
      type: "ADD_GOOD_HABIT",
      habit: {
        id: `habit-${Date.now()}`,
        title: goodDraft.title.trim(),
        icon: goodDraft.icon,
        kind: goodDraft.kind,
        ...(goodDraft.kind === "counter"
          ? { goal: Math.max(1, Number(goodDraft.goal) || 1), unit: goodDraft.unit.trim() || "раз" }
          : {}),
      },
    });
    closeForm();
  };

  const submitQuit = () => {
    if (!quitTitle.trim()) return;
    haptic("success");
    dispatch({
      type: "ADD_QUIT_HABIT",
      habit: { id: `quit-${Date.now()}`, title: quitTitle.trim() },
    });
    closeForm();
  };

  const handleQuitReset = (habit) => {
    const ok = window.confirm(
      `Отметить срыв по привычке «${habit.title}»?\nТекущий счётчик (${quitDays(habit)} дн.) обнулится, рекорд сохранится.`
    );
    if (!ok) return;
    haptic("warning");
    dispatch({ type: "RESET_QUIT_HABIT", id: habit.id });
  };

  const removeGood = (habit) => {
    if (!window.confirm(`Удалить привычку «${habit.title}»? Прогресс по ней пропадёт.`)) return;
    dispatch({ type: "REMOVE_GOOD_HABIT", id: habit.id });
  };

  const removeQuit = (habit) => {
    if (!window.confirm(`Удалить «${habit.title}» из списка?`)) return;
    dispatch({ type: "REMOVE_QUIT_HABIT", id: habit.id });
  };

  return (
    <div className="screen">
      <div style={{ padding: "22px 20px 6px 20px", flex: "0 0 auto" }}>
        <span style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.3px" }}>Привычки</span>
        <div className="faint" style={{ fontSize: 13, marginTop: 3 }}>Полезные и вредные — всё в одном месте</div>
      </div>

      <div className="scroll">
        {isEmpty && (
          <div className="card" style={{ margin: "12px 20px", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>Пока нет ни одной привычки</span>
            <span className="faint" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Нажми на кнопку «+» внизу справа и добавь то, что хочешь выработать (например, чтение
              или воду), или то, от чего хочешь избавиться (например, курение). Стрики появятся сами,
              как только начнёшь отмечать привычки день за днём.
            </span>
          </div>
        )}

        {goodHabits.length > 0 && (
          <div style={{ padding: "16px 20px 8px 20px", fontSize: 14, fontWeight: 600, color: "var(--good)" }}>Полезные привычки</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "0 20px" }}>
          {goodHabits.map((habit) => {
            const Icon = ICON_MAP[habit.icon] || BookIcon;
            const isCounter = habit.kind === "counter";
            const today = new Date().toISOString().slice(0, 10);
            const current = isCounter ? habit.history?.[today] || 0 : 0;
            const doneToday = !isCounter && Boolean(habit.history?.[today]);
            const streak = isCounter ? computeCounterStreak(habit.history, habit.goal) : computeStreak(habit.history);
            const pct = isCounter ? Math.round((current / habit.goal) * 100) : doneToday ? 100 : 0;
            const fillColor = doneToday || (isCounter && current > 0) ? "var(--good)" : "var(--track)";
            return (
              <div key={habit.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: "var(--card-2)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                    <Icon style={{ width: 17, height: 17, color: accent }} />
                  </div>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{habit.title}</div>
                    <div className="faint" style={{ fontSize: 12 }}>
                      {isCounter
                        ? `${current} из ${habit.goal} ${habit.unit} сегодня`
                        : doneToday ? "выполнено сегодня" : "ещё не сегодня"}
                    </div>
                  </div>
                  {isCounter ? (
                    <button
                      onClick={() => { haptic("light"); dispatch({ type: "INCREMENT_COUNTER_HABIT", id: habit.id }); }}
                      style={{ width: 30, height: 30, borderRadius: 15, background: accent, border: "none", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}
                      aria-label={`Добавить: ${habit.title}`}
                    >
                      <PlusIcon style={{ width: 15, height: 15 }} />
                    </button>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 600 }} className="dim">
                      {streak} <span className="faint" style={{ fontWeight: 400 }}>дн.</span>
                    </div>
                  )}
                </div>
                <div className="progress-track" style={{ marginTop: 11 }}>
                  <div className="progress-fill" style={{ width: `${pct}%`, background: fillColor }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  {!isCounter ? (
                    <button
                      onClick={() => { haptic("light"); dispatch({ type: "TOGGLE_HABIT_DONE", id: habit.id }); }}
                      style={{ fontSize: 12, background: "none", border: "none", color: accent, padding: 0, fontWeight: 600 }}
                    >
                      {doneToday ? "Снять отметку" : "Отметить выполненным"}
                    </button>
                  ) : <span />}
                  <button
                    onClick={() => removeGood(habit)}
                    style={{ background: "none", border: "none", padding: 4, display: "flex" }}
                    aria-label="Удалить привычку"
                  >
                    <TrashIcon style={{ width: 15, height: 15, color: "var(--icon-dim)" }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {quitHabits.length > 0 && (
          <div style={{ padding: "22px 20px 8px 20px", fontSize: 14, fontWeight: 600, color: "var(--bad)" }}>Бросаю</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "0 20px 100px 20px" }}>
          {quitHabits.map((habit) => (
            <div key={habit.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 26, border: "2px solid var(--bad)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>{quitDays(habit)}</span>
                </div>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{habit.title}</div>
                  <div className="faint" style={{ fontSize: 12 }}>дней без срывов · рекорд {quitRecord(habit)}</div>
                </div>
                <button
                  onClick={() => handleQuitReset(habit)}
                  style={{ fontSize: 12, background: "none", border: "none", color: "var(--dim)", padding: 0, flex: "0 0 auto" }}
                >
                  Сорвался
                </button>
                <button
                  onClick={() => removeQuit(habit)}
                  style={{ background: "none", border: "none", padding: 4, display: "flex", flex: "0 0 auto" }}
                  aria-label="Удалить"
                >
                  <TrashIcon style={{ width: 15, height: 15, color: "var(--icon-dim)" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {adding && (
        <div className="card" style={{ position: "absolute", left: 20, right: 20, bottom: 96, padding: 14, display: "flex", flexDirection: "column", gap: 12, boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="faint" style={{ fontSize: 12 }}>Новая привычка</span>
            <button onClick={closeForm} style={{ background: "none", border: "none", padding: 2, display: "flex" }} aria-label="Закрыть">
              <XIcon style={{ width: 16, height: 16, color: "var(--icon-dim)" }} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setMode("good")}
              style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, background: mode === "good" ? accent : "var(--card-2)", color: mode === "good" ? "var(--on-accent)" : "var(--text)" }}
            >
              Полезная
            </button>
            <button
              onClick={() => setMode("quit")}
              style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, background: mode === "quit" ? "var(--bad)" : "var(--card-2)", color: mode === "quit" ? "#fff" : "var(--text)" }}
            >
              Хочу бросить
            </button>
          </div>

          {mode === "good" ? (
            <>
              <input
                value={goodDraft.title}
                onChange={(e) => setGoodDraft({ ...goodDraft, title: e.target.value })}
                placeholder="Например: Растяжка"
                style={{ background: "var(--card-2)", border: "none", borderRadius: 10, padding: "8px 10px", color: "var(--text)", fontSize: 14 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                {GOOD_ICONS.map(({ id, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setGoodDraft({ ...goodDraft, icon: id })}
                    style={{ width: 38, height: 38, borderRadius: 12, border: "none", background: goodDraft.icon === id ? accent : "var(--card-2)", display: "flex", alignItems: "center", justifyContent: "center" }}
                    aria-label={id}
                  >
                    <Icon style={{ width: 17, height: 17, color: goodDraft.icon === id ? "var(--on-accent)" : "var(--icon-neutral)" }} />
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setGoodDraft({ ...goodDraft, kind: "toggle" })}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", fontSize: 12.5, fontWeight: 600, background: goodDraft.kind === "toggle" ? "var(--card-2)" : "transparent", boxShadow: goodDraft.kind === "toggle" ? "inset 0 0 0 1.5px " + accent : "inset 0 0 0 1px var(--card-border)", color: "var(--text)" }}
                >
                  Отмечать каждый день
                </button>
                <button
                  onClick={() => setGoodDraft({ ...goodDraft, kind: "counter" })}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", fontSize: 12.5, fontWeight: 600, background: goodDraft.kind === "counter" ? "var(--card-2)" : "transparent", boxShadow: goodDraft.kind === "counter" ? "inset 0 0 0 1.5px " + accent : "inset 0 0 0 1px var(--card-border)", color: "var(--text)" }}
                >
                  Считать за день (число)
                </button>
              </div>
              {goodDraft.kind === "counter" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    min="1"
                    value={goodDraft.goal}
                    onChange={(e) => setGoodDraft({ ...goodDraft, goal: e.target.value })}
                    style={{ width: 70, background: "var(--card-2)", border: "none", borderRadius: 10, padding: "8px 10px", color: "var(--text)", fontSize: 14 }}
                  />
                  <input
                    value={goodDraft.unit}
                    onChange={(e) => setGoodDraft({ ...goodDraft, unit: e.target.value })}
                    placeholder="стаканов, страниц…"
                    style={{ flex: 1, background: "var(--card-2)", border: "none", borderRadius: 10, padding: "8px 10px", color: "var(--text)", fontSize: 14 }}
                  />
                </div>
              )}
              <button
                onClick={submitGood}
                style={{ background: accent, color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "10px 0", fontWeight: 600, fontSize: 14 }}
              >
                Добавить
              </button>
            </>
          ) : (
            <>
              <input
                value={quitTitle}
                onChange={(e) => setQuitTitle(e.target.value)}
                placeholder="Например: Курение"
                style={{ background: "var(--card-2)", border: "none", borderRadius: 10, padding: "8px 10px", color: "var(--text)", fontSize: 14 }}
              />
              <span className="faint" style={{ fontSize: 11.5, lineHeight: 1.4 }}>
                Счётчик дней без срыва начнётся с нуля и будет расти сам каждый день. Если сорвёшься —
                отметь это карточкой «Сорвался», и рекорд сохранится.
              </span>
              <button
                onClick={submitQuit}
                style={{ background: "var(--bad)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 0", fontWeight: 600, fontSize: 14 }}
              >
                Добавить
              </button>
            </>
          )}
        </div>
      )}

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          style={{ position: "absolute", right: 20, bottom: 98, width: 52, height: 52, borderRadius: 26, background: accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow)" }}
          aria-label="Добавить привычку"
        >
          <PlusIcon style={{ width: 22, height: 22, color: "var(--on-accent)" }} />
        </button>
      )}
    </div>
  );
}
