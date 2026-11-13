/**
 * Custody Calendar — Schedule calculation engine
 */

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Parse a YYYY-MM-DD date string into a local Date at midnight.
 * Avoids UTC timezone shifts that new Date(string) causes.
 */
function parseLocalDate(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calendarDay(date) {
  const utc = new Date(0);
  utc.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  return utc.getTime() / 86400000;
}

function localDateKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index ? 2 : 4, '0')).join('-');
}

function regularParent(schedule, date) {
  const start = parseLocalDate(schedule?.start);
  if (!start || date < start) return null;
  const week = Math.floor((calendarDay(date) - calendarDay(start)) / 7);
  const template = schedule.alternateWeeks !== false && week % 2
    ? (schedule.weekBTemplate?.length ? schedule.weekBTemplate : schedule.weekATemplate) : schedule.weekATemplate;
  return template?.[date.getDay()] || 'mother';
}

function getDaySchedule(child, inputDate) {
  const date = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate());
  const day = calendarDay(date);
  const yesterday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  const regular = regularParent(child?.schedule, date);
  const morning = regularParent(child?.schedule, yesterday) || regular;
  const regularSwitch = parseTime(child?.schedule?.switchTime || '08:30');
  const overrides = (child?.overrides || []).map(event => {
    const first = parseLocalDate(event.date || event.startDate);
    const start = first ? calendarDay(first) : NaN;
    const last = event.endDate ? parseLocalDate(event.endDate) : first;
    const end = last ? calendarDay(last) : NaN;
    return { event, parent: event.parent, start: (start - day) * 1440 + parseTime(event.time), end: (end - day + 1) * 1440 };
  });
  const holidays = getHolidayIntervals(child, date);
  const intervals = [...overrides, ...holidays].filter(rule =>
    rule.start < 1440 && rule.end > 0 && rule.start < rule.end);
  const boundaries = new Set([0, 1440, regularSwitch]);
  for (const rule of intervals) {
    boundaries.add(Math.max(0, rule.start));
    boundaries.add(Math.min(1440, rule.end));
  }
  const segments = [];
  const events = new Set();
  for (const minute of [...boundaries].sort((a, b) => a - b)) {
    if (minute >= 1440) break;
    const rule = intervals.find(entry => entry.start <= minute && minute < entry.end);
    if (rule) events.add(rule);
    const parent = rule ? rule.parent : minute < regularSwitch ? morning : regular;
    if (!segments.length || segments.at(-1).parent !== parent) {
      segments.push({ minute, parent });
    }
  }
  const time = minute => String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
  const winningRules = [...events];
  return {
    date,
    parent: segments.at(-1).parent,
    firstParent: segments[0].parent,
    isSplit: segments.length > 1,
    switchTime: segments.length > 1 ? time(segments[1].minute) : null,
    segments: segments.map(segment => ({ ...segment, time: time(segment.minute) })),
    override: winningRules.find(rule => !rule.holiday)?.event || null,
    holiday: winningRules.find(rule => rule.holiday)?.event || null,
    events: winningRules.map(rule => ({
      type: rule.holiday ? 'holiday' : 'override',
      name: rule.event.name || 'Schedule change',
      startTime: rule.start > 0 ? time(rule.start) : '',
      endTime: rule.end < 1440 ? time(rule.end) : ''
    }))
  };
}

function getMonthSchedule(child, year, month) {
  return Array.from({ length: new Date(year, month + 1, 0).getDate() },
    (_, index) => getDaySchedule(child, new Date(year, month, index + 1)));
}

function getWeekSchedule(child, date) {
  const monday = date.getDate() - (date.getDay() + 6) % 7;
  return Array.from({ length: 7 },
    (_, index) => getDaySchedule(child, new Date(date.getFullYear(), date.getMonth(), monday + index)));
}

function daysOffForChild(child) {
  if (!child) return [];
  const shared = window.daysOff || [];
  const legacy = (child.daysOff || []).filter((_, index) =>
    !shared.some(entry => entry.legacyKey === JSON.stringify([child.id, index])));
  return [...legacy, ...shared.filter(entry => !entry.deleted &&
    (entry.childIds === null || entry.childIds.includes(child.id)))];
}

function daysOffForDate(child, date) {
  const key = localDateKey(date);
  return daysOffForChild(child).filter(entry => {
    const end = entry.end || entry.start;
    if (key < entry.start) return false;
    if (!entry.repeat) return key <= end;
    const day = key.slice(5);
    const first = entry.start.slice(5);
    const last = end.slice(5);
    return first <= last ? day >= first && day <= last : day >= first || day <= last;
  });
}

function validSchoolRange(start, end, repeat) {
  if (!parseLocalDate(start) || localDateKey(parseLocalDate(start)) !== start) return false;
  if (!end) return true;
  if (!parseLocalDate(end) || localDateKey(parseLocalDate(end)) !== end || end < start) return false;
  return !repeat || calendarDay(parseLocalDate(end)) - calendarDay(parseLocalDate(start)) < 365;
}
