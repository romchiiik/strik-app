import { HomeIcon, TargetIcon, ActivityIcon, UserIcon } from "../icons.jsx";

const TABS = [
  { id: "today", label: "Сегодня", Icon: HomeIcon },
  { id: "habits", label: "Привычки", Icon: TargetIcon },
  { id: "sport", label: "Спорт", Icon: ActivityIcon },
  { id: "profile", label: "Профиль", Icon: UserIcon },
];

export default function TabBar({ active, onChange, accent }) {
  return (
    <div className="tabbar">
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            className="tab"
            onClick={() => onChange(id)}
            style={isActive ? { color: accent } : undefined}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon style={{ color: isActive ? accent : "currentColor" }} />
            <span className="tab-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
