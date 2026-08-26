import { useState, useMemo } from "react";
import { useStore, computeStreak, computeCounterStreak, quitRecord } from "../state/store.jsx";
import { getTelegramUser, isInsideTelegram, haptic, showAlert } from "../telegram.js";
import { getInitData } from "../reminderSync.js";
import {
  BellIcon,
  MoonIcon,
  GlobeIcon,
  MicIcon,
  UserIcon,
  ChevronRightIcon,
  StarIcon,
  BoltIcon,
  CopyIcon,
} from "../icons.jsx";

const VOICE_CAPTURE_URL = "https://strik-app-nine.vercel.app/api/voice-capture";

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

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

  const [actionButtonOpen, setActionButtonOpen] = useState(false);
  const [voiceToken, setVoiceToken] = useState(null);
  const [tokenState, setTokenState] = useState("idle"); // idle | loading | error

  const loadVoiceToken = async (regenerate = false) => {
    const initData = getInitData();
    if (!initData) {
      setTokenState("error");
      return;
    }
    setTokenState("loading");
    try {
      const resp = await fetch("/api/voice-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, regenerate }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.token) throw new Error("bad response");
      setVoiceToken(data.token);
      setTokenState("idle");
    } catch {
      setTokenState("error");
    }
  };

  const toggleActionButtonPanel = () => {
    haptic("light");
    const next = !actionButtonOpen;
    setActionButtonOpen(next);
    if (next && !voiceToken) loadVoiceToken();
  };

  const requestBodyTemplate = voiceToken
    ? JSON.stringify({ token: voiceToken, text: "Текст из шага «Dictate Text»" }, null, 2)
    : "";

  const copyAndNotify = async (text, label) => {
    haptic("light");
    const ok = await copyToClipboard(text);
    showAlert(ok ? `${label} скопирован(о).` : `Не получилось скопировать автоматически. ${label}: ${text}`);
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
          <div
            onClick={toggleActionButtonPanel}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", minHeight: 44, borderTop: "1px solid var(--card-border)", cursor: "pointer" }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 16, background: "var(--card-2)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              <BoltIcon style={{ width: 15, height: 15, color: "var(--icon-neutral)" }} />
            </div>
            <div style={{ flex: "1 1 auto" }}>
              <div style={{ fontSize: 14.5 }}>Action Button (iPhone)</div>
              <div className="faint" style={{ fontSize: 12 }}>Надиктовать задачи не открывая приложение</div>
            </div>
            <ChevronRightIcon
              style={{ width: 16, height: 16, color: "var(--icon-dim)", transform: actionButtonOpen ? "rotate(90deg)" : "none" }}
            />
          </div>

          {actionButtonOpen && (
            <div style={{ padding: "4px 16px 16px 16px", borderTop: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="faint" style={{ fontSize: 12.5, lineHeight: 1.5, paddingTop: 10 }}>
                Настраивается один раз через приложение «Команды» (Shortcuts) — жмёшь Action Button,
                айфон надиктовывает текст, и он сразу приходит сюда и превращается в задачи расписания
                (плюс бот пришлёт подтверждение в чат). Ниже — данные для двух шагов настройки; сама
                инструкция — в чате с Клодом, который это подключал.
              </span>

              {tokenState === "loading" && <span className="faint" style={{ fontSize: 12.5 }}>Получаю личный ключ…</span>}
              {tokenState === "error" && (
                <span className="faint" style={{ fontSize: 12.5, color: "var(--bad)" }}>
                  Не получилось получить ключ. Открой этот экран из Telegram (не в браузере) и попробуй ещё раз.
                </span>
              )}

              {voiceToken && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className="faint" style={{ fontSize: 11.5 }}>Адрес (URL) — Get Contents of URL, метод POST</span>
                    <div
                      onClick={() => copyAndNotify(VOICE_CAPTURE_URL, "Адрес")}
                      style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--card-2)", borderRadius: 10, padding: "9px 10px", cursor: "pointer" }}
                    >
                      <span style={{ flex: "1 1 auto", fontSize: 12, fontFamily: "monospace", wordBreak: "break-all" }}>{VOICE_CAPTURE_URL}</span>
                      <CopyIcon style={{ width: 15, height: 15, color: "var(--icon-dim)", flex: "0 0 auto" }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className="faint" style={{ fontSize: 11.5 }}>Ключ «token» — только значение, без кавычек и скобок</span>
                    <div
                      onClick={() => copyAndNotify(voiceToken, "Токен")}
                      style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--card-2)", borderRadius: 10, padding: "9px 10px", cursor: "pointer" }}
                    >
                      <span style={{ flex: "1 1 auto", fontSize: 12, fontFamily: "monospace", wordBreak: "break-all" }}>{voiceToken}</span>
                      <CopyIcon style={{ width: 15, height: 15, color: "var(--icon-dim)", flex: "0 0 auto" }} />
                    </div>
                    <span className="faint" style={{ fontSize: 11, lineHeight: 1.4 }}>
                      В Shortcuts: поле «Ключ» → впиши <code>token</code>, в поле значения справа — нажми сюда, скопируй и вставь именно эту строку целиком, без фигурных скобок.
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className="faint" style={{ fontSize: 11.5 }}>Целиком — если поле тела запроса одно на весь JSON</span>
                    <div
                      onClick={() => copyAndNotify(requestBodyTemplate, "Шаблон тела запроса")}
                      style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--card-2)", borderRadius: 10, padding: "9px 10px", cursor: "pointer" }}
                    >
                      <pre style={{ flex: "1 1 auto", fontSize: 11.5, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>{requestBodyTemplate}</pre>
                      <CopyIcon style={{ width: 15, height: 15, color: "var(--icon-dim)", flex: "0 0 auto" }} />
                    </div>
                    <span className="faint" style={{ fontSize: 11, lineHeight: 1.4 }}>
                      Нужен, только если в Shortcuts у тебя одно текстовое поле для всего JSON сразу (не отдельные «Ключ» / «Значение»).
                      Если поля отдельные — используй блок выше, а не этот.
                    </span>
                  </div>

                  <button
                    onClick={() => loadVoiceToken(true)}
                    style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: accent, fontSize: 12, fontWeight: 600 }}
                  >
                    Обновить ключ (если кому-то показал по ошибке)
                  </button>
                </>
              )}
            </div>
          )}
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
