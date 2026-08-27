import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, computeStreak, computeCounterStreak, quitDays } from "../state/store.jsx";
import { haptic, getTelegramUser } from "../telegram.js";
import { parseVoiceTasks } from "../voiceParser.js";
import { getInitData } from "../reminderSync.js";
import {
  MicIcon,
  FlameIcon,
  SunIcon,
  BriefcaseIcon,
  RunIcon,
  MeditationIcon,
  MoonIcon,
  CheckIcon,
  TrashIcon,
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
  const tgUser = getTelegramUser();

  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false); // ждём разбор фразы ИИ-эндпоинтом
  const [draft, setDraft] = useState(null); // { title, time }
  const [addedFlash, setAddedFlash] = useState(null); // текст временного уведомления
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!addedFlash) return;
    const t = setTimeout(() => setAddedFlash(null), 3000);
    return () => clearTimeout(t);
  }, [addedFlash]);

  const chips = useMemo(() => {
    const quitChips = quitHabits.map((h) => ({
      key: h.id,
      value: quitDays(h),
      label: h.id.startsWith("quit-smok") ? "дней без курения" : `дней без «${h.title.toLowerCase()}»`,
      color: accent,
    }));
    const goodChips = goodHabits.map((h) => ({
      key: h.id,
      value: h.kind === "counter" ? computeCounterStreak(h.history, h.goal) : computeStreak(h.history),
      label: `дней подряд: ${h.title.toLowerCase()}`,
      color: "var(--good)",
    }));
    return [...quitChips, ...goodChips];
  }, [quitHabits, goodHabits, accent]);

  const toggleDone = (id) => {
    haptic("light");
    dispatch({ type: "TOGGLE_SCHEDULE", id });
  };

  const removeItem = (item) => {
    if (!window.confirm(`Удалить «${item.title}» из расписания?`)) return;
    dispatch({ type: "REMOVE_SCHEDULE_ITEM", id: item.id });
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
    recognition.onresult = async (event) => {
      const text = event.results[0]?.[0]?.transcript;
      if (!text) return;

      setProcessing(true);
      const tasks = await parseTasksViaAI(text);
      setProcessing(false);

      applyParsedTasks(tasks);
    };

    recognition.start();
  };

  // Пробуем разобрать фразу через серверный ИИ-эндпоинт (понимает суть даже
  // в потоке речи с "водой") — а если нет сети/initData/ключа на сервере, тихо
  // откатываемся на локальный разбор по правилам, чтобы голосовой ввод не ломался.
  const parseTasksViaAI = async (text) => {
    const initData = getInitData();
    if (!initData) return parseVoiceTasks(text);

    try {
      const resp = await fetch("/api/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, text }),
      });
      if (!resp.ok) return parseVoiceTasks(text);
      const data = await resp.json();
      if (Array.isArray(data?.tasks) && data.tasks.length > 0) return data.tasks;
      return parseVoiceTasks(text);
    } catch {
      return parseVoiceTasks(text);
    }
  };

  const applyParsedTasks = (tasks) => {
    if (!tasks || tasks.length === 0) return;

    if (tasks.length > 1) {
      // Несколько задач в одной фразе — раскидываем сразу, без промежуточного
      // подтверждения (под каждую редактировать форму неудобно). Время у
      // каждой можно поправить/удалить прямо в списке расписания.
      tasks.forEach((task) => {
        dispatch({
          type: "ADD_SCHEDULE_ITEM",
          item: {
            id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            time: task.time,
            title: task.title,
            subtitle: "Из голосового ввода",
            icon: task.icon,
            done: false,
          },
        });
      });
      haptic("success");
      setAddedFlash(`Добавлено задач: ${tasks.length}`);
    } else {
      // Одна задача — даём проверить/поправить время перед сохранением, как раньше.
      setDraft({ title: tasks[0].title, time: tasks[0].time });
    }
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
  };

  const openManualAdd = () => {
    haptic("light");
    setDraft({ title: "", time: "12:00" });
  };

  const confirmDraft = () => {
    if (!draft?.title || !draft?.time) return;
    dispatch({
      type: "ADD_SCHEDULE_ITEM",
      item: {
        id: `custom-${Date.now()}`,
        time: draft.time,
        title: draft.title,
        subtitle: "Добавлено вручную",
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
        <div style={{ width: 44, height: 44, borderRadius: 22, background: "var(--card-2)", border: `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, overflow: "hidden" }}>
          {tgUser?.photo_url ? (
            <img src={tgUser.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            (tgUser?.first_name || "Р")[0]
          )}
        </div>
      </div>

      <div className="scroll">
        <div style={{ margin: "16px 20px 6px 20px" }}>
          <div
            className="card"
            style={{ height: 56, display: "flex", alignItems: "center", gap: 12, padding: "0 8px", borderRadius: 28, cursor: processing ? "default" : "pointer", opacity: processing ? 0.7 : 1 }}
            onClick={processing ? undefined : listening ? stopVoice : startVoice}
          >
            <div style={{ width: 40, height: 40, borderRadius: 20, background: listening ? "var(--bad)" : accent, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              <MicIcon style={{ width: 19, height: 19, color: "var(--on-accent)" }} />
            </div>
            <span className="dim" style={{ fontSize: 15 }}>
              {processing ? "Понимаю, что ты сказал…" : listening ? "Слушаю… нажми, чтобы остановить" : "Скажи, что нужно сделать"}
            </span>
          </div>
          {!listening && !processing && (
            <button onClick={openManualAdd} style={{ background: "none", border: "none", padding: "8px 4px 0 4px", color: accent, fontSize: 12.5, fontWeight: 600 }}>
              + добавить вручную
            </button>
          )}
          {addedFlash && (
            <div className="faint" style={{ fontSize: 12, padding: "8px 4px 0 4px", color: "var(--good)" }}>
              ✓ {addedFlash} — время каждой можно поправить в списке ниже
            </div>
          )}
        </div>

        {draft && (
          <div className="card" style={{ margin: "6px 20px 6px 20px", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="faint" style={{ fontSize: 12 }}>Новая задача</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Что нужно сделать?"
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

        {chips.length > 0 && (
          <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "10px 20px 4px 20px" }}>
            {chips.map((chip) => (
              <div key={chip.key} className="card-2" style={{ padding: "12px 14px", minWidth: 126, flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 7 }}>
                <FlameIcon style={{ width: 18, height: 18, color: chip.color }} />
                <span style={{ fontSize: 21, fontWeight: 700 }}>{chip.value}</span>
                <span className="faint" style={{ fontSize: 11, lineHeight: 1.3 }}>{chip.label}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: "20px 20px 10px 20px", fontSize: 16, fontWeight: 600 }}>Сегодня по расписанию</div>

        {schedule.length === 0 && (
          <div className="card" style={{ margin: "0 20px", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>Расписание пока пустое</span>
            <span className="faint" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Нажми на микрофон выше и скажи сразу несколько дел, например: «Пробежка в 7 утра, потом
              работа в 10, и медитация вечером» — каждое станет отдельной задачей со своим временем.
              Можно и одно дело, и вручную кнопкой «+ добавить вручную». Открой вкладку «Привычки»,
              чтобы завести привычки, которые хочешь выработать или бросить, — их стрики появятся сами,
              как только начнёшь их отмечать.
            </span>
          </div>
        )}

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
                <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</span>
                  <span className="faint" style={{ fontSize: 12 }}>{item.done ? `${item.subtitle} · выполнено` : item.subtitle}</span>
                </div>
                <button
                  onClick={() => removeItem(item)}
                  style={{ background: "none", border: "none", padding: 4, display: "flex", flex: "0 0 auto" }}
                  aria-label="Удалить"
                >
                  <TrashIcon style={{ width: 14, height: 14, color: "var(--icon-dim)" }} />
                </button>
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
