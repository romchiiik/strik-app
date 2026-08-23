// Общие иконки — простые, обводкой, без эмодзи. Используются во всех экранах.

const base = { viewBox: "0 0 24 24", fill: "none" };

export function HomeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11.5L12 4l8 7.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TargetIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function ActivityIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h4l2-7 4 14 2-7h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function MicIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12 18v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function FlameIcon(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M12 21c-4 0-7-2.5-7-6.5C5 10 8 7 9.5 3c.5 3 2.5 3.5 2.5 6 1-1 1.5-2.5 1.5-4 3 2 5.5 5 5.5 9.5C19 18.5 16 21 12 21z" fill="currentColor" />
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronRightIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SunIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function MoonIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function BriefcaseIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="8" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function RunIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="15" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 8l-2 4 3 2-1 5M11 12l-4 2M14 14l4 1 2 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BikeIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="17" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="17" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 17l4-8h4l3 6M10 9h3M13 6h3l2 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MeditationIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 19c2-3 4-4 8-4s6 1 8 4M6 15c1-2 3-3 6-3s5 1 6 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function DropletIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3c4 5 7 8.5 7 12a7 7 0 0 1-14 0c0-3.5 3-7 7-12z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function BookIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 0 4 23V5.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5A2.5 2.5 0 0 1 20 23V5.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function BellIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function GlobeIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function StarIcon(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M12 3l2.6 5.9L21 9.6l-4.6 4.2 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.6l6.4-.7L12 3z" fill="currentColor" />
    </svg>
  );
}

export function TrashIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 20l1-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InfoIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 11v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="8.3" r="1.05" fill="currentColor" />
    </svg>
  );
}

export function XIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SatelliteIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="8.2" y="8.2" width="7.6" height="7.6" rx="1.4" transform="rotate(45 12 12)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
