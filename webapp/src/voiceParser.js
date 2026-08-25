// Разбор надиктованной фразы на несколько отдельных задач расписания.
//
// Раньше вся фраза целиком становилась ОДНОЙ задачей на 12:00. Это разбивает
// её на части (по союзам и перечислению) и пытается вытащить время для каждой
// части — по цифрам ("в 7 утра", "в 19:30") или по словам ("утром", "вечером",
// "в обед" и т.п.). Если время не найдено — задаче присваивается следующий
// свободный дневной слот, чтобы всё не схлопывалось в одну и ту же метку.
//
// Важно: в JS \b — граница между \w и \W, а кириллица в \w НЕ входит, поэтому
// \bслово\b на кириллице просто не работает (тихо не матчится вообще нигде).
// Вместо этого используем свои границы через отрицание класса букв кириллицы.

const CYR = "а-яёА-ЯЁ";
function bound(source) {
  return new RegExp(`(?:^|[^${CYR}])(?:${source})(?=[^${CYR}]|$)`, "i");
}

const NUM_WORDS = {
  час: 1, один: 1, одна: 1,
  два: 2, две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
};

const PART_OF_DAY = [
  { re: bound("утром|с утра"), time: "09:00" },
  { re: bound("в обед|на обед|днём|днем"), time: "13:00" },
  { re: bound("вечером"), time: "19:00" },
  { re: bound("перед сном|пред сном"), time: "22:30" },
  { re: bound("ночью"), time: "23:00" },
  { re: bound("полдень"), time: "12:00" },
  { re: bound("полночь"), time: "00:00" },
];

const ICON_KEYWORDS = [
  { re: /беж|пробежк|бег\b|тренировк|спорт|качалк|зал\b|велик|велосипед/i, icon: "run" },
  { re: /медитац|дыхательн|практик/i, icon: "meditation" },
  { re: /работ|встреч|созвон|дедлайн|отчёт|отчет|проект/i, icon: "briefcase" },
  { re: /сон\b|спать|засыпа/i, icon: "moon" },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function detectExplicitTime(segment) {
  // "в 19:30", "в 7:00"
  let m = segment.match(new RegExp(`(?:^|[^${CYR}])в\\s+(\\d{1,2}):(\\d{2})(?=[^${CYR}\\d]|$)`, "i"));
  if (m) {
    const h = Math.min(23, parseInt(m[1], 10));
    const mm = Math.min(59, parseInt(m[2], 10));
    return { time: `${pad2(h)}:${pad2(mm)}`, match: m[0] };
  }

  // "в 7 утра" / "в 7 вечера" / "в 19 часов" / "в 7"
  m = segment.match(
    new RegExp(`(?:^|[^${CYR}])в\\s+(\\d{1,2})(\\s*час(?:а|ов)?)?\\s*(утра|вечера|дня|ночи)?(?=[^${CYR}\\d]|$)`, "i")
  );
  if (m) {
    let h = parseInt(m[1], 10);
    const period = m[3];
    if (period === "вечера" || period === "ночи") {
      if (h < 12) h += 12;
    } else if (period === "дня") {
      if (h < 8) h += 12;
    }
    h = Math.min(23, Math.max(0, h));
    return { time: `${pad2(h)}:00`, match: m[0] };
  }

  // "в семь утра" — числительное словом
  m = segment.match(new RegExp(`(?:^|[^${CYR}])в\\s+([а-яё]+)\\s*(утра|вечера|дня|ночи)?(?=[^${CYR}]|$)`, "i"));
  if (m) {
    const word = m[1]?.toLowerCase();
    if (word && NUM_WORDS[word] !== undefined) {
      let h = NUM_WORDS[word];
      const period = m[2];
      if (period === "вечера" || period === "ночи") {
        if (h < 12) h += 12;
      } else if (period === "дня") {
        if (h < 8) h += 12;
      }
      return { time: `${pad2(h)}:00`, match: m[0] };
    }
  }

  return null;
}

function detectPartOfDay(segment) {
  for (const { re, time } of PART_OF_DAY) {
    if (re.test(segment)) return time;
  }
  return null;
}

function guessIcon(segment) {
  for (const { re, icon } of ICON_KEYWORDS) {
    if (re.test(segment)) return icon;
  }
  return "sun";
}

const PART_OF_DAY_STRIP = new RegExp(
  `(?:^|[^${CYR}])(?:утром|с утра|в обед|на обед|днём|днем|вечером|ночью|перед сном|пред сном|полдень|полночь)(?=[^${CYR}]|$)`,
  "gi"
);

function cleanTitle(segment, matchedPhrase) {
  let s = segment;
  if (matchedPhrase) s = s.replace(matchedPhrase, " ");
  s = s
    .replace(PART_OF_DAY_STRIP, " ")
    .replace(/^\s*(и|потом|затем|также|ещё|еще)\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  s = s.replace(/^[,\s]+|[,\s]+$/g, "");
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Возвращает [{ title, time, icon }] — может быть один элемент, если фраза не делится.
export function parseVoiceTasks(rawText) {
  const text = (rawText || "").trim();
  if (!text) return [];

  // Делим по перечислению: запятые и союзы "и"/"потом"/"затем"/"также" между частями.
  const segments = text
    .split(/,|(?:\s+и\s+)|(?:\s*,?\s*потом\s+)|(?:\s*,?\s*затем\s+)|(?:\s*,?\s*также\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const tasks = [];
  let autoSlotHour = 9; // резервный слот для задач без явного времени

  for (const segment of segments) {
    const explicit = detectExplicitTime(segment);
    let time = explicit?.time || null;
    if (!time) time = detectPartOfDay(segment);

    const title = cleanTitle(segment, explicit?.match);
    if (!title) continue;

    if (!time) {
      time = `${pad2(Math.min(21, autoSlotHour))}:00`;
      autoSlotHour += 2;
    }

    tasks.push({ title, time, icon: guessIcon(segment) });
  }

  // Ничего не распарсилось (например, фраза без запятых/союзов, но и без времени) —
  // возвращаем исходную фразу одной задачей, чтобы ничего не потерять.
  if (tasks.length === 0) {
    return [{ title: text.charAt(0).toUpperCase() + text.slice(1), time: "09:00", icon: guessIcon(text) }];
  }

  return tasks;
}
