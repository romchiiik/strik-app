import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../state/store.jsx";
import { haptic } from "../telegram.js";
import { RunIcon, BikeIcon, InfoIcon } from "../icons.jsx";

const ICONS = { run: RunIcon, bike: BikeIcon };
const MET = { run: 9.8, bike: 6.5 };

// Точку с точностью хуже этого порога (в метрах) в расчёт дистанции не берём —
// это и есть источник "фантомного" движения на месте: у смартфонов точность GPS
// в помещении/у зданий часто 30-100+ м, и наивное суммирование каждого чиха
// координат превращается в километры за секунды стояния на месте.
const ACCURACY_OK_M = 25;
// Потолок правдоподобной скорости передвижения (бег/вело у обычного человека) —
// отсекает единичные "прыжки" GPS даже при формально неплохой точности.
const MAX_SPEED_MPS = 9.5; // ~34 км/ч

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatPace(distanceKm, elapsedSec) {
  if (distanceKm <= 0.05) return "—";
  const secPerKm = elapsedSec / distanceKm;
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, "0")} /км`;
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatRelativeDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Сегодня, ${time}`;
  if (diffDays === 1) return `Вчера, ${time}`;
  if (diffDays < 7) return `${capitalize(d.toLocaleDateString("ru-RU", { weekday: "long" }))}, ${time}`;
  return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}, ${time}`;
}

export default function Sport() {
  const { state, dispatch } = useStore();
  const { activities, settings } = state;
  const accent = settings.accent;

  const [tracking, setTracking] = useState(false);
  const [activityType, setActivityType] = useState("run");
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [geoError, setGeoError] = useState(null);
  const [gpsQuality, setGpsQuality] = useState("searching"); // "searching" | "good" | "weak"

  const watchIdRef = useRef(null);
  const lastPointRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  const weekSummary = useMemo(() => {
    const weekAgoMs = Date.now() - 7 * 86400000;
    const inWeek = activities.filter((a) => new Date(a.date || a.dateLabel).getTime() >= weekAgoMs);
    const totalKm = inWeek.reduce((sum, a) => sum + a.distanceKm, 0);
    return { count: inWeek.length, totalKm: totalKm.toFixed(1) };
  }, [activities]);

  const calories = Math.round(MET[activityType] * settings.weightKg * (elapsedSec / 3600));

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setGeoError("Геолокация не поддерживается этим браузером.");
      return;
    }
    setGeoError(null);
    setDistanceKm(0);
    setElapsedSec(0);
    setGpsQuality("searching");
    lastPointRef.current = null;
    startTimeRef.current = Date.now();
    setTracking(true);
    haptic("light");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const accuracy = pos.coords.accuracy ?? 9999;
        const point = { lat: pos.coords.latitude, lon: pos.coords.longitude, t: pos.timestamp || Date.now() };

        if (accuracy > ACCURACY_OK_M) {
          // Точка слишком неточная — не используем её для дистанции и не
          // сдвигаем "последнюю точку", чтобы следующий хороший фикс сравнивался
          // с последней достоверной позицией, а не с шумом.
          setGpsQuality("weak");
          return;
        }
        setGpsQuality("good");

        const prev = lastPointRef.current;
        if (prev) {
          const deltaKm = haversineKm(prev, point);
          const deltaM = deltaKm * 1000;
          const dtSec = Math.max(0.5, (point.t - prev.t) / 1000);
          const speedMps = deltaM / dtSec;
          // Минимальный сдвиг должен превышать суммарную погрешность обеих точек —
          // иначе это просто дрожание сигнала на месте, а не реальное движение.
          const noiseFloorM = Math.max(5, prev.accuracy * 0.6 + accuracy * 0.6);
          if (deltaM > noiseFloorM && speedMps <= MAX_SPEED_MPS) {
            setDistanceKm((d) => d + deltaKm);
          }
        }
        lastPointRef.current = { ...point, accuracy };
      },
      (err) => setGeoError(err.message || "Не удалось получить доступ к геолокации."),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );

    timerRef.current = setInterval(() => {
      setElapsedSec(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setTracking(false);
    haptic("success");

    if (distanceKm > 0.01) {
      const now = new Date();
      dispatch({
        type: "ADD_ACTIVITY",
        activity: {
          id: Date.now(),
          type: activityType,
          label: activityType === "run" ? "Пробежка" : "Велопрогулка",
          date: now.toISOString(),
          distanceKm: Number(distanceKm.toFixed(2)),
          durationMin: Math.round(elapsedSec / 60),
        },
      });
    }
  };

  return (
    <div className="screen">
      <div style={{ padding: "22px 20px 14px 20px", flex: "0 0 auto" }}>
        <span style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.3px" }}>Спорт</span>
        <div className="faint" style={{ fontSize: 13, marginTop: 3 }}>
          На этой неделе: {weekSummary.count} активности · {weekSummary.totalKm} км
        </div>
      </div>

      <div className="scroll">
        <div style={{ margin: "0 20px 8px 20px" }}>
          <div className="card" style={{ position: "relative", height: 210, overflow: "hidden", borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {tracking ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: "var(--faint)" }}>
                  {gpsQuality === "searching" ? "Ищем сигнал GPS…" : gpsQuality === "weak" ? "Слабый сигнал GPS" : "Идёт запись маршрута…"}
                </span>
                <span style={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatDuration(elapsedSec)}</span>
                <span style={{ fontSize: 14 }} className="dim">{distanceKm.toFixed(2)} км</span>
              </div>
            ) : activities[0] ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span className="faint" style={{ fontSize: 12.5 }}>Последняя активность</span>
                <span style={{ fontSize: 28, fontWeight: 700 }}>{activities[0].distanceKm} км</span>
                <span className="dim" style={{ fontSize: 13 }}>{activities[0].durationMin} мин</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "0 24px", textAlign: "center" }}>
                <span className="faint" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  Здесь появится карта маршрута после первой тренировки
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "0 20px 6px 20px" }}>
          <InfoIcon style={{ width: 13, height: 13, color: "var(--icon-dim)", marginTop: 1, flex: "0 0 auto" }} />
          <span className="faint" style={{ fontSize: 11, lineHeight: 1.4 }}>
            Дистанция считается по GPS прямо в приложении. Telegram-мини-приложения не имеют доступа к
            Apple Health или Google Fit — данные не синхронизируются с Watch/часами автоматически.
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, padding: "10px 20px 0 20px" }}>
          <div className="card-2" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="faint" style={{ fontSize: 11 }}>Дистанция</span>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{distanceKm.toFixed(2)} км</span>
          </div>
          <div className="card-2" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="faint" style={{ fontSize: 11 }}>Темп</span>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{formatPace(distanceKm, elapsedSec)}</span>
          </div>
          <div className="card-2" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="faint" style={{ fontSize: 11 }}>Калории</span>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{calories}</span>
          </div>
        </div>

        {geoError && (
          <div style={{ margin: "12px 20px 0 20px", fontSize: 12, color: "var(--bad)" }}>{geoError}</div>
        )}

        <div style={{ padding: "18px 20px 0 20px", display: "flex", gap: 10 }}>
          {!tracking && (
            <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
              {["run", "bike"].map((t) => {
                const Icon = ICONS[t];
                const isActive = activityType === t;
                return (
                  <button
                    key={t}
                    onClick={() => setActivityType(t)}
                    style={{
                      width: 44, height: 44, borderRadius: 12, border: "none",
                      background: isActive ? accent : "var(--card-2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    aria-label={t === "run" ? "Бег" : "Велосипед"}
                  >
                    <Icon style={{ width: 19, height: 19, color: isActive ? "var(--on-accent)" : "var(--icon-neutral)" }} />
                  </button>
                );
              })}
            </div>
          )}
          <button
            onClick={tracking ? stopTracking : startTracking}
            style={{ flex: 1, height: 56, borderRadius: 28, background: tracking ? "var(--bad)" : accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            {!tracking && <RunIcon style={{ width: 19, height: 19, color: "var(--on-accent)" }} />}
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--on-accent)" }}>
              {tracking ? "Остановить" : activityType === "run" ? "Начать пробежку" : "Начать поездку"}
            </span>
          </button>
        </div>

        <div style={{ padding: "22px 20px 8px 20px", fontSize: 16, fontWeight: 600 }}>История</div>

        {activities.length === 0 ? (
          <div className="card" style={{ margin: "0 20px 40px 20px", padding: 16 }}>
            <span className="faint" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Пока пусто. Нажми «Начать пробежку» или «Начать поездку» и подожди, пока приложение
              поймает сигнал GPS, — после остановки тренировка появится здесь.
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "0 20px 100px 20px" }}>
            {activities.map((a) => {
              const Icon = ICONS[a.type] || RunIcon;
              return (
                <div key={a.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: "var(--card-2)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                    <Icon style={{ width: 17, height: 17, color: a.type === "run" ? accent : "var(--icon-neutral)" }} />
                  </div>
                  <div style={{ flex: "1 1 auto" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{a.label}</div>
                    <div className="faint" style={{ fontSize: 12 }}>{a.date ? formatRelativeDate(a.date) : a.dateLabel}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.distanceKm} км</div>
                    <div className="faint" style={{ fontSize: 11 }}>{a.durationMin} мин</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
