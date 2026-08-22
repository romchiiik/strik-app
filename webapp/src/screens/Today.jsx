import { useMemo, useRef, useState } from "react";
import { useStore } from "../state/store.jsx";
import { haptic } from "../telegram.js";
import {
  MicIcon,
  FlameIcon,
  SunIcon,
  BriefcaseIcon,
  RunIcon,
  MeditationIcon,
  MoonIcon,
  CheckIcon,
} from "../icons.jsx";

const ICONS = {
  sun: SunIcon,
  briefcase: BriefcaseIcon,
  run: RunIcon,
  meditation: MeditationIcon,
  moon: MoonIcon,
};

const TODAY_LABEL = new Date().toLocaleDateString("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function Today() {
  const { state, dispatch } = useStore();
  const { schedule, quitHabits, goodHabits, settings } = state;
  const accent = settings.accent;

  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState(null); // { title, time }
  const recognitionRef = useRef(null);

  const chips = useMemo(() => {
    const quitChips = quitHabits.map((h) => ({
      key: h.id,
      value: h.days,
      label: h.id === "smoking" ? "дней без курения" : `дней без ${h.title.toLowerCase()}`,
      color: accent,
    }));
    const goodChips = goodHabits
      .filter((h) => h.id !== "water")
      .map((h) => ({
        key: h.id,
        value: h.streakDays,
        label: `дней ${h.title.toLowerCase() === "чтение" ? "чтения" : h.title.toLowerCase()}`,
        color: "var(--good)",
      }));
    const water = goodHabits.find((h) => h.id === "water");
    const waterChip = water
      ? [{ key: "water", value: water.streakDays, label: "день с водой", color: "var(--good)" }]
      : [];
    return [...quitChips, ...goodChips, ...waterChip];
  }, [quitHabits, goodHabits, accent]);

  const toggleDone = (id) => {
    haptic("light");
    dispatch({ type: "TOGGLE_SCHEDULE", id });
  };

  const startVoice = () => {
    const SR = getSpeechRecognition();
    if (!SR) {
      const title = window.prompt("Голосовой ввод не поддерживается этим браузером. Введите задачу текстом:");
      if (title) setDraft({ title, time: "12:00" });
      return;
    }
    const recognition = new SR();
    recognition.lang = "ru-RU";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript;
      if (text) setDraft({ title: capitalize(text), time: "12:00" });
    };

    recognition.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
  };

  const confirmDraft = () => {
    if (!draft?.title || !draft?.time) return;
    dispatch({
      type: "ADD_SCHEDULE_ITEM",
      item: {
        id: `custom-${Date.now()}`,
        time: draft.time,
        title: draft.title,
        subtitle: "Добавлено голосом",
        icon: "sun",
        done: false,
      },
    });
    haptic("success");
    setDraft(null);
  };

  return (
    <div className="screen">
      <div style={{ padding: "22px 20px 4px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flex: "0 0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span className="dim" style={{ fontSize: 13 }}>{capitalize(TODAY_LABEL)}</span>
          <span style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.3px" }}>Сегодня</span>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: "var(--card-2)", border: `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600 }}>
          Р
        </div>
      </div>

      <div className="scroll">
        <div style={{ margin: "16px 20px 6px 20px" }}>
          <div
            className="card"
            style={{ height: 56, display: "flex", alignItems: "center", gap: 12, padding: "0 8px", borderRadius: 28, cursor: "pointer" }}
            onClick={listening ? stopVoice : startVoice}
          >
            <div style={{ width: 40, height: 40, borderRadius: 20, background: listening ? "var(--bad)" : accent, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              <MicIcon style={{ width: 19, height: 19, color: "var(--on-accent)" }} />
            </div>
            <span className="dim" style={{ fontSize: 15 }}>
              {listening ? "Слушаю… нажми, чтобы остановить" : "Скажи, что нужно сделать"}
            </span>
          </div>
        </div>

        {draft && (
          <div className="card" style={{ margin: "6px 20px 6px 20px", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="faint" style={{ fontSize: 12 }}>Новая задача</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              style={{ background: "var(--card-2)", border: "none", borderRadius: 10, padding: "8px 10px", color: "var(--text)", fontSize: 14 }}
            />
            <input
              type="time"
              value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.target.value })}
              style={{ background: "var(--card-2)", border: "none", borderRadius: 10, padding: "8px 10px", color: "var(--text)", fontSize: 14 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmDraft} style={{ flex: 1, background: accent, color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "10px 0", fontWeight: 600, fontSize: 14 }}>Добавить</button>
              <button onClick={() => setDraft(null)} style={{ flex: 1, background: "var(--card-2)", color: "var(--text)", border: "none", borderRadius: 10, padding: "10px 0", fontWeight: 600, fontSize: 14 }}>Отмена</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "10px 20px 4px 20px" }}>
          {chips.map((chip) => (
            <div key={chip.key} className="card-2" style={{ padding: "12px 14px", minWidth: 126, flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 7 }}>
              <FlameIcon style={{ width: 18, height: 18, color: chip.color }} />
              <span style={{ fontSize: 21, fontWeight: 700 }}>{chip.value}</span>
              <span className="faint" style={{ fontSize: 11, lineHeight: 1.3 }}>{chip.label}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: "20px 20px 10px 20px", fontSize: 16, fontWeight: 600 }}>Сегодня по расписанию</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "0 20px 24px 20px" }}>
          {schedule.map((item) => {
            const Icon = ICONS[item.icon] || SunIcon;
            return (
              <div
                key={item.id}
                className="card"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderColor: item.done ? accent : undefined }}
              >
                <span className="dim" style={{ fontSize: 12, fontWeight: 600, width: 40, flex: "0 0 auto" }}>{item.time}</span>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: "var(--card-2)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <Icon style={{ width: 17, height: 17, color: item.done ? "var(--good)" : "var(--icon-neutral)" }} />
                </div>
                <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</span>
                  <span className="faint" style={{ fontSize: 12 }}>{item.done ? `${item.subtitle} · выполнено` : item.subtitle}</span>
                </div>
                <button
                  onClick={() => toggleDone(item.id)}
                  style={{
                    width: 22, height: 22, borderRadius: 11, flex: "0 0 auto", border: "none", padding: 0,
                    background: item.done ? accent : "transparent",
                    boxShadow: item.done ? "none" : "inset 0 0 0 1.5px var(--checkbox-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  aria-label={item.done ? "Отметить невыполненным" : "Отметить выполненным"}
                >
                  {item.done && <CheckIcon style={{ width: 13, height: 13, color: "var(--on-accent)" }} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
