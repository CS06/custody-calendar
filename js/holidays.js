/**
 * Custody Calendar — Holiday date calculation
 */

/**
 * Calculate Easter Sunday for a given year using the Computus algorithm.
 * Returns a JS Date (set to noon to avoid timezone edge cases).
 */
function calculateEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Get the date of the Nth occurrence of a weekday in a month.
 * @param {number} year
 * @param {number} month — 0-indexed
 * @param {number} weekday — 0=Sunday..6=Saturday (JS convention)
 * @param {number} n — 1=first, 2=second, etc. Use -1 for last
 * @returns {Date}
 */
function nthWeekday(year, month, weekday, n) {
  if (n > 0) {
    let d = new Date(year, month, 1);
    while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
    for (let i = 1; i < n; i++) d.setDate(d.getDate() + 7);
    return d;
  } else if (n === -1) {
    const lastDay = new Date(year, month + 1, 0);
    while (lastDay.getDay() !== weekday) lastDay.setDate(lastDay.getDate() - 1);
    return lastDay;
  }
  return new Date(year, month, 1);
}

/**
 * Calculate a holiday date for a given year based on its configuration.
 * @param {object} holiday — { type, params: {...}, year }
 * @returns {Date|null}
 */
function calculateHolidayDate(holiday, year) {
  const p = holiday.params || {};
  const offset = Number(holiday.offset || 0);

  let date;
  switch (holiday.type) {
    case 'fixed':
      date = new Date(year, p.month - 1, p.day);
      if (date.getMonth() !== Number(p.month) - 1) return null;
      break;

    case 'nth-weekday': {
      const wdMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const weekday = wdMap[String(p.weekday).toLowerCase()];
      if (!Number.isInteger(weekday)) return null;
      date = nthWeekday(year, p.month - 1, weekday, p.n);
      if (date.getMonth() !== Number(p.month) - 1) return null;
      break;
    }

    case 'last-weekday': {
      const wdMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const weekday = wdMap[String(p.weekday).toLowerCase()];
      if (!Number.isInteger(weekday)) return null;
      date = nthWeekday(year, p.month - 1, weekday, -1);
      break;
    }

    case 'easter-based': {
      const easterOffset = Number(p.offset || 0);
      const easter = calculateEaster(year);
      date = new Date(easter);
      date.setDate(date.getDate() + easterOffset);
      break;
    }

    default:
      return null;
  }

  // Apply offset (can be negative or positive)
  if (offset !== 0) {
    date = new Date(date);
    date.setDate(date.getDate() + offset);
  }

  return date;
}

function parseTime(timeStr) {
  if (typeof timeStr !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Earlier entries win within the same rule type.
function getHolidayIntervals(child, date) {
  const day = calendarDay(date);
  const year = date.getFullYear();
  const intervals = [];
  for (const event of child?.holidays || []) {
    const offset = Number(event.offset || 0) + (event.type === 'easter-based' ? Number(event.params?.offset || 0) : 0);
    const duration = Number(event.duration || 0);
    const firstYear = year - Math.ceil((Math.max(0, offset) + duration) / 365) - 1;
    const lastYear = year + Math.ceil(Math.max(0, -offset) / 365) + 1;
    for (let occurrence = firstYear; occurrence <= lastYear; occurrence++) {
      const even = occurrence % 2 === 0;
      const yearRule = event.yearRule || child.schedule?.yearRule;
      if ((yearRule === 'even' && !even) || (yearRule === 'odd' && even)) continue;
      const startDate = calculateHolidayDate(event, occurrence);
      if (!startDate) continue;
      const startDay = calendarDay(startDate) - day;
      const start = startDay * 1440 + parseTime(event.startTime);
      const end = (startDay + duration) * 1440 + (event.endTime ? parseTime(event.endTime) : 1440);
      if (start < 1440 && end > 0) {
        const parent = (even ? event.evenParent : event.oddParent) || event.parent || 'mother';
        intervals.push({ event: { ...event, _effectiveParent: parent }, parent, start, end, holiday: true });
      }
    }
  }
  return intervals;
}

/**
 * Get preset holidays to offer during setup.
 */
function getHolidayPresets() {
  return [
    { id: 'new-year', name: "New Year's Day", type: 'fixed', params: { month: 1, day: 1 }, evenParent: 'mother', oddParent: 'mother' },
    { id: 'mlk', name: 'Martin Luther King Jr. Day', type: 'nth-weekday', params: { month: 1, weekday: 'monday', n: 3 }, evenParent: 'father', oddParent: 'father' },
    { id: 'presidents', name: "President's Day", type: 'nth-weekday', params: { month: 2, weekday: 'monday', n: 3 }, evenParent: 'mother', oddParent: 'mother' },
    { id: 'memorial', name: 'Memorial Day', type: 'last-weekday', params: { month: 5, weekday: 'monday' }, evenParent: 'father', oddParent: 'father' },
    { id: 'juneteenth', name: 'Juneteenth', type: 'fixed', params: { month: 6, day: 19 }, evenParent: 'mother', oddParent: 'mother' },
    { id: 'july4', name: 'Independence Day', type: 'fixed', params: { month: 7, day: 4 }, evenParent: 'father', oddParent: 'father' },
    { id: 'labor', name: 'Labor Day', type: 'nth-weekday', params: { month: 9, weekday: 'monday', n: 1 }, evenParent: 'mother', oddParent: 'mother' },
    { id: 'columbus', name: 'Columbus Day', type: 'nth-weekday', params: { month: 10, weekday: 'monday', n: 2 }, evenParent: 'father', oddParent: 'father' },
    { id: 'thanksgiving', name: 'Thanksgiving', type: 'nth-weekday', params: { month: 11, weekday: 'thursday', n: 4 }, evenParent: 'mother', oddParent: 'mother', duration: 3 },
    { id: 'black-friday', name: 'Black Friday', type: 'nth-weekday', params: { month: 11, weekday: 'thursday', n: 4 }, evenParent: 'father', oddParent: 'father', offset: 1 },
    { id: 'xmas-eve', name: "Christmas Eve", type: 'fixed', params: { month: 12, day: 24 }, evenParent: 'father', oddParent: 'father' },
    { id: 'xmas', name: 'Christmas Day', type: 'fixed', params: { month: 12, day: 25 }, evenParent: 'mother', oddParent: 'mother' },
    { id: 'good-friday', name: 'Good Friday', type: 'easter-based', params: { offset: -1 }, evenParent: 'father', oddParent: 'father' },
    { id: 'easter', name: 'Easter Sunday', type: 'easter-based', params: { offset: 0 }, evenParent: 'mother', oddParent: 'mother' },
  ];
}
