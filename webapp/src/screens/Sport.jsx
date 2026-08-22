import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../state/store.jsx";
import { haptic } from "../telegram.js";
import { RunIcon, BikeIcon } from "../icons.jsx";

const ICONS = { run: RunIcon, bike: BikeIcon };
const MET = { run: 9.8, bike: 6.5 };

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

export default function Sport() {
  const { state, dispatch } = useStore();
  const { activities, settings } = state;
  const accent = settings.accent;

  const [tracking, setTracking] = useState(false);
  const [activityType, setActivityType] = useState("run");
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [geoError, setGeoError] = useState(null);

  const watchIdRef = useRef(null);
  const lastPointRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  const weekSummary = useMemo(() => {
    const totalKm = activities.reduce((sum, a) => sum + a.distanceKm, 0);
    return { count: activities.length, totalKm: totalKm.toFixed(1) };
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
    lastPointRef.current = null;
    startTimeRef.current = Date.now();
    setTracking(true);
    haptic("light");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        if (lastPointRef.current) {
          const delta = haversineKm(lastPointRef.current, point);
          // Отсекаем случайный "прыжок" GPS в состоянии покоя.
          if (delta > 0.003) {
            setDistanceKm((d) => d + delta);
          }
        }
        lastPointRef.current = point;
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
          dateLabel: now.toLocaleDateString("ru-RU", { weekday: "long", hour: "2-digit", minute: "2-digit" }),
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
        <div style={{ margin: "0 20px 16px 20px" }}>
          <div className="card" style={{ position: "relative", height: 210, overflow: "hidden", borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {tracking ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: "var(--faint)" }}>Идёт запись маршрута…</span>
                <span style={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatDuration(elapsedSec)}</span>
                <span style={{ fontSize: 14 }} className="dim">{distanceKm.toFixed(2)} км</span>
              </div>
            ) : (
              <svg viewBox="0 0 350 210" style={{ width: "100%", height: "100%", display: "block" }}>
                <rect x="0" y="0" width="350" height="210" fill="var(--map-bg)" />
                <g stroke="var(--map-grid)" strokeWidth="1.5">
                  <line x1="0" y1="35" x2="350" y2="35" />
                  <line x1="0" y1="78" x2="350" y2="78" />
                  <line x1="0" y1="122" x2="350" y2="122" />
                  <line x1="0" y1="168" x2="350" y2="168" />
                  <line x1="42" y1="0" x2="42" y2="210" />
                  <line x1="96" y1="0" x2="96" y2="210" />
                  <line x1="158" y1="0" x2="158" y2="210" />
                  <line x1="222" y1="0" x2="222" y2="210" />
                  <line x1="284" y1="0" x2="284" y2="210" />
                </g>
                <path
                  d="M30,172 C82,150 58,102 118,92 C168,84 150,42 220,47 C270,50 258,112 312,96"
                  fill="none"
                  stroke={accent}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="30" cy="172" r="5.5" fill={accent} />
                <circle cx="312" cy="96" r="9" fill="none" stroke={accent} strokeWidth="2" opacity="0.5" />
                <circle cx="312" cy="96" r="4.5" fill={accent} />
              </svg>
            )}
            {!tracking && activities[0] && (
              <div style={{ position: "absolute", left: 12, bottom: 12, background: "var(--overlay)", padding: "7px 12px", borderRadius: 14, fontSize: 12.5, fontWeight: 600 }}>
                {activities[0].distanceKm} км · {activities[0].durationMin} мин
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, padding: "0 20px" }}>
          <div className="card-2" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="faint" style={{ fontSize: 11 }}>Дистанция</span>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{distanceKm.toFixed(1)} км</span>
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
              {tracking ? "Остановить" : "Начать пробежку"}
            </span>
          </button>
        </div>

        <div style={{ padding: "22px 20px 8px 20px", fontSize: 16, fontWeight: 600 }}>История</div>

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
                  <div className="faint" style={{ fontSize: 12 }}>{a.dateLabel}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.distanceKm} км</div>
                  <div className="faint" style={{ fontSize: 11 }}>{a.durationMin} мин</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
