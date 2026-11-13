/**
 * Custody Calendar — Calendar rendering
 */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

let _currentView = 'month'; // 'month', 'week', 'day'
let _currentDate = new Date();

function initCalendar() {
  bindCalendarSwipes(document.getElementById('calendar-container'));
  renderCalendar();
  updateLegend();
}

function bindCalendarSwipes(container) {
  let start = null;
  container.addEventListener('touchstart', event => {
    start = event.touches.length === 1
      ? { touch: event.touches[0], view: _currentView } : null;
  }, { passive: true });
  container.addEventListener('touchcancel', () => { start = null; }, { passive: true });
  container.addEventListener('touchend', event => {
    const first = start;
    start = null;
    if (!first || _currentView !== first.view || event.touches.length) return;
    const last = Array.from(event.changedTouches).find(touch => touch.identifier === first.touch.identifier);
    if (!last) return;
    const dx = last.clientX - first.touch.clientX;
    const dy = last.clientY - first.touch.clientY;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (event.cancelable) event.preventDefault();
    navigate(dx < 0 ? 1 : -1);
  }, { passive: false });
}

function navigate(direction) {
  if (_currentView === 'month') {
    _currentDate.setDate(1);
    _currentDate.setMonth(_currentDate.getMonth() + direction);
  } else if (_currentView === 'week') {
    _currentDate.setDate(_currentDate.getDate() + direction * 7);
  } else if (_currentView === 'day') {
    _currentDate.setDate(_currentDate.getDate() + direction);
  }
  renderCalendar();
}

function goToToday() {
  _currentDate = new Date();
  renderCalendar();
}

function setView(view) {
  _currentView = view;
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
    btn.setAttribute('aria-pressed', String(btn.dataset.view === view));
  });
  renderCalendar();
}

function setActiveChild(childId) {
  window.currentChildId = childId;
  window.ui?.renderSettings();
  renderCalendar();
  updateLegend();
}

function getChild() {
  return window._children?.find(c => c.id === window.currentChildId) || window._children?.[0] || null;
}

function renderCalendar() {
  const container = document.getElementById('calendar-container');
  const title = document.getElementById('calendar-title');
  const child = getChild();

  if (_currentView === 'month') {
    renderMonthView(container, title, child);
  } else if (_currentView === 'week') {
    renderWeekView(container, title, child);
  } else if (_currentView === 'day') {
    renderDayView(container, title, child);
  }


}

function renderMonthView(container, title, child) {
  const year = _currentDate.getFullYear();
  const month = _currentDate.getMonth();

  title.textContent = `${MONTH_NAMES[month]} ${year}`;

  // Get first day of month and pad with previous month's days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay(); // Sun=0
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  let html = '<div class="calendar-grid">';

  // Day headers
  for (let i = 0; i < 7; i++) {
    html += `<div class="day-header">${DAY_ABBR[i]}</div>`;
  }

  // Fetch schedules for previous, current, and next months
  const colors = getSafeColors();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const prevSchedule = child ? getMonthSchedule(child, prevYear, prevMonth) : [];
  const currSchedule = child ? getMonthSchedule(child, year, month) : [];
  const nextSchedule = child ? getMonthSchedule(child, nextYear, nextMonth) : [];

  const prevSchedMap = {};
  prevSchedule.forEach(s => { prevSchedMap[s.date.getDate()] = s; });
  const currSchedMap = {};
  currSchedule.forEach(s => { currSchedMap[s.date.getDate()] = s; });
  const nextSchedMap = {};
  nextSchedule.forEach(s => { nextSchedMap[s.date.getDate()] = s; });

  // Previous month padding with colors
  for (let i = 0; i < startDayOfWeek; i++) {
    const day = daysInPrevMonth - startDayOfWeek + i + 1;
    const s = prevSchedMap[day] || { parent: null, isSplit: false, switchTime: null, holiday: null, override: null };
    let colorBlock = '<div class="day-color-block" style="background:transparent;"></div>';
    if (s.parent) {
      const color = s.parent === 'mother' ? colors.mother : colors.father;
      colorBlock = `<div class="day-color-block" style="background:${color};border-radius:4px;padding:4px;">`;
      if (s.override) colorBlock += `<div class="day-label" style="background:rgba(255,255,255,0.7);">${escapeHTML(s.override.name || 'Override')}</div>`;
      colorBlock += holidayBadge(s) + `</div>`;
    }
    html += `<div class="day-cell other-month"><div class="day-number">${day}${daysOffIcons(child, new Date(prevYear, prevMonth, day))}</div>${colorBlock}</div>`;
  }

  // Current month days
  const today = new Date();
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const s = currSchedMap[day] || { parent: null, isSplit: false, switchTime: null, holiday: null, override: null };
    const isToday = date.toDateString() === today.toDateString();
    html += '<div class="day-cell';
    if (isToday) html += ' today';
    if (s.isSplit) html += ' split';
    html += '"' + dateAction(date, s, child) + '>';

    // Day number always at top
    html += `<div class="day-number">${day}${daysOffIcons(child, date)}</div>`;

    if (s.isSplit) {
      const leftColor = colors[s.firstParent] || 'transparent';
      const rightColor = colors[s.segments[1].parent] || 'transparent';
      const label = s.override?.name || '';
      const returns = s.segments.length === 3 && s.firstParent &&
        s.segments[2].parent === s.firstParent && (s.holiday || s.override);
      html += `<div class="split-left" style="background:${leftColor}">${holidayBadge(s)}<div class="split-label">${escapeHTML(label)}${s.segments.length > 2 && !returns ? ' +' : ''}</div></div>`;
      html += `<div class="split-divider"></div><div class="split-right" style="background:${rightColor}">`;
      if (returns) {
        html += `<div class="split-time split-return-time"><span>${formatTime(s.switchTime)}</span> - <span>${formatTime(s.segments[2].time)}</span></div>`;
      } else {
        html += `<div class="split-time">↕ ${formatTime(s.switchTime)}</div>`;
      }
      html += '</div>';
    } else if (s.parent) {
      const color = s.parent === 'mother' ? colors.mother : colors.father;
      html += `<div class="day-color-block" style="background:${color};border-radius:4px;padding:4px;">`;
      if (s.override) {
        html += `<div class="day-label" style="background:rgba(255,255,255,0.7);">${escapeHTML(s.override.name || 'Override')}</div>`;
      }
      html += holidayBadge(s) + `</div>`;
    } else {
      // Empty day - add transparent block to maintain height
      html += `<div class="day-color-block" style="background:transparent;"></div>`;
    }

    html += '</div>';
  }

  // Next month padding with colors
  const totalCells = startDayOfWeek + lastDay.getDate();
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const s = nextSchedMap[i] || { parent: null, isSplit: false, switchTime: null, holiday: null, override: null };
    let colorBlock = '<div class="day-color-block" style="background:transparent;"></div>';
    if (s.parent) {
      const color = s.parent === 'mother' ? colors.mother : colors.father;
      colorBlock = `<div class="day-color-block" style="background:${color};border-radius:4px;padding:4px;">`;
      if (s.override) colorBlock += `<div class="day-label" style="background:rgba(255,255,255,0.7);">${escapeHTML(s.override.name || 'Override')}</div>`;
      colorBlock += holidayBadge(s) + `</div>`;
    }
    html += `<div class="day-cell other-month"><div class="day-number">${i}${daysOffIcons(child, new Date(nextYear, nextMonth, i))}</div>${colorBlock}</div>`;
  }

  html += '</div>';
  container.innerHTML = html;
  bindDateActions(container);

  // Adjust grid to only show needed rows
  const allCells = startDayOfWeek + lastDay.getDate() + remaining;
  const neededRows = Math.ceil(allCells / 7);
  const grid = container.querySelector('.calendar-grid');
  if (grid) {
    grid.style.setProperty('--calendar-weeks', neededRows);
  }
}

function holidayBadge(day) {
  if (!day.holiday || day.override) return '';
  return `<span class="holiday-badge">${escapeHTML(day.holiday.name)}</span>`;
}

function renderWeekView(container, title, child) {
  const dayOfWeek = _currentDate.getDay();
  const monday = new Date(_currentDate);
  monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  title.textContent = `${MONTH_NAMES[monday.getMonth()]} ${monday.getDate()} – ${MONTH_NAMES[sunday.getMonth()]} ${sunday.getDate()}, ${sunday.getFullYear()}`;

  const days = getWeekSchedule(child, _currentDate);
  const colors = getSafeColors();
  const today = new Date();

  let html = '<div class="week-view">';
  for (const d of days) {
    const isToday = d.date.toDateString() === today.toDateString();
    html += `<div class="week-day${isToday ? ' today' : ''}"${dateAction(d.date, d, child)}>`;
    html += `<div class="week-day-header"><div class="week-day-name">${DAY_ABBR[d.date.getDay()]}</div><div class="week-day-num">${d.date.getDate()}</div></div>`
    html += daysOffDetails(child, d.date);
    html += '<div class="week-day-content">';

    if (d.holiday && !d.override) {
      const color = (d.holiday._effectiveParent || d.holiday.parent) === 'mother' ? colors.mother : colors.father;
      html += `<div class="week-event holiday" style="border-left-color:${color}">`;
      html += `<div class="week-event-name">${escapeHTML(d.holiday.name)}</div>`;
      html += `<div class="week-event-time">${scheduleDescription(d)}</div>`;
      html += '</div>';
    } else if (d.override) {
      html += `<div class="week-event override">`;
      html += `<div class="week-event-name">${escapeHTML(d.override.name || 'Schedule change')}</div>`;
      html += `<div class="week-event-time">${scheduleDescription(d)}</div>`;
      html += '</div>';
    } else if (d.isSplit && d.parent) {
      const leftP = d.firstParent;
      const leftColor = leftP === 'mother' ? colors.mother : colors.father;
      const rightColor = d.parent === 'mother' ? colors.mother : colors.father;
      html += `<div style="display:flex;border-radius:4px;overflow:hidden;height:50px;">`;
      html += `<div style="flex:1;background:${leftColor};border-right:1px solid rgba(0,0,0,0.1);"></div>`;
      html += `<div style="flex:1;background:${rightColor};"></div>`;
      html += `</div><div class="switch-time-label">${scheduleDescription(d)}</div>`;
    } else if (d.parent) {
      const color = d.parent === 'mother' ? colors.mother : colors.father;
      html += `<div style="background:${color};border-radius:4px;height:40px;"></div><div class="switch-time-label">${parentLabel(d.parent)}</div>`;
    }

    html += '</div></div>';
  }
  html += '</div>';
  container.innerHTML = html;
  bindDateActions(container);
}

function renderDayView(container, title, child) {
  const date = _currentDate;
  title.textContent = `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

  const result = getDaySchedule(child, date);
  const colors = getSafeColors();
  const events = result.events;

  let html = '<div class="day-view">';
  html += `<div class="day-view-header"><button class="btn btn-small" onclick="setView('month')">← Month</button><div class="day-view-day">${DAY_NAMES[date.getDay()]}</div><div class="day-view-date">${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}</div></div>`;

  if (result.segments.some(segment => segment.parent)) {
    html += '<div class="day-view-body">';
    for (const segment of result.segments) {
      const color = colors[segment.parent] || 'transparent';
      html += `<div class="day-split" style="background:${color}"><div class="day-split-label">${parentLabel(segment.parent)}</div>`;
      if (result.isSplit) html += `<div class="day-split-time">From ${formatTime(segment.time)}</div>`;
      html += '</div>';
    }
    html += '</div>';
  }

  html += daysOffDetails(child, date);

  // Event list below
  if (events.length > 0) {
    html += '<div style="margin-top:16px;"><h4 style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px;">Events</h4>';
    for (const ev of events) {
      const cls = ev.type === 'holiday' ? 'holiday' : 'override';
      html += `<div class="event-item ${cls}"><div class="event-item-title">${escapeHTML(ev.name)}</div>`;
      if (ev.startTime || ev.endTime) html += `<div class="event-item-time">${ev.startTime ? 'From ' + formatTime(ev.startTime) : ''}${ev.endTime ? ' Until ' + formatTime(ev.endTime) : ''}</div>`;
      html += '</div>';
    }
    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

function updateLegend() {
  const legend = document.getElementById('legend');
  const colors = getSafeColors();
  legend.innerHTML = `
    <div class="legend-item"><div class="legend-swatch" style="background:${colors.mother}"></div>Mother</div>
    <div class="legend-item"><div class="legend-swatch" style="background:${colors.father}"></div>Father</div>
  `;
}

function getDefaultColors() {
  return { mother: '#FCA5A5', father: '#93C5FD' };
}

function getSafeColors() {
  return { ...getDefaultColors(), ...validColors(window._colors) };
}

function parentLabel(parent) {
  return parent === 'mother' ? 'Mother' : parent === 'father' ? 'Father' : 'Unassigned';
}

function scheduleDescription(schedule) {
  return schedule.segments?.map(({ parent, time }, index) =>
    index ? `${parentLabel(parent)} from ${formatTime(time)}` : parentLabel(parent)).join(', ') || 'Unassigned';
}

function dateAction(date, schedule, child) {
  const name = schedule.override?.name || schedule.holiday?.name;
  const label = [date.toLocaleDateString(undefined, { dateStyle: 'full' }),
    scheduleDescription(schedule), name, daysOffDescription(child, date)].filter(Boolean).join(', ');
  return ` role="button" tabindex="0" data-date="${localDateKey(date)}" aria-label="${escapeHTML(label)}"`;
}

function bindDateActions(container) {
  for (const cell of container.querySelectorAll('[data-date]')) {
    const open = () => window.ui.handleDayClick(cell.dataset.date);
    cell.addEventListener('click', open);
    cell.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  }
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function daysOffDescription(child, date) {
  const entries = daysOffForDate(child, date);
  return entries.map(entry => [dayOffLabel(entry), entry.name].filter(Boolean).join(': ')).join(', ');
}

const DAY_OFF_ICONS = {
  school: '<path d="m1 4 5-3 5 3-5 3zM3 5.5V8q3 2 6 0V5.5M11 4v4"/>',
  work: '<rect x="1" y="4" width="10" height="7" rx="1"/><path d="M4 4V2h4v2M1 7h10M5 7v1h2V7"/>',
  vacation: '<rect x="3" y="4" width="6" height="6" rx="1"/><path d="M5 4V1h2v3M4 10v1m4-1v1"/>'
};

function daysOffIcons(child, date) {
  const types = new Set(daysOffForDate(child, date).map(entry => entry.type || 'school'));
  if (!types.size) return '';
  const icons = Object.entries(DAY_OFF_ICONS).filter(([type]) => types.has(type)).map(([type, shape]) =>
    `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round"><title>${dayOffLabel({ type })}</title>${shape}</svg>`);
  return `<span class="days-off-icons" aria-hidden="true">${icons.join('')}</span>`;
}

function dayOffLabel(entry) {
  if (entry.type === 'work') return 'Off work';
  if (entry.type === 'vacation') return 'Vacation';
  return 'No school';
}

function daysOffDetails(child, date) {
  const label = daysOffDescription(child, date);
  return label ? `<div class="days-off-details">${escapeHTML(label)}</div>` : '';
}

function renderPrintMonth() {
  const child = getChild();
  const year = _currentDate.getFullYear();
  const month = _currentDate.getMonth();
  const days = getMonthSchedule(child, year, month);
  const padding = days[0].date.getDay();
  const cells = Array.from({ length: Math.ceil((padding + days.length) / 7) * 7 }, (_, i) => {
    const day = days[i - padding];
    if (!day) return '<div></div>';
    const events = [day.override?.name, day.holiday?.name, daysOffDescription(child, day.date)].filter(Boolean);
    return `<div><strong>${day.date.getDate()}</strong><p>${escapeHTML(scheduleDescription(day))}</p>` +
      events.map(name => `<p>${escapeHTML(name)}</p>`).join('') + '</div>';
  });
  document.getElementById('print-calendar').innerHTML =
    `<h1>${MONTH_NAMES[month]} ${year}${child ? ' · ' + escapeHTML(child.name) : ''}</h1>` +
    '<div class="print-grid">' + DAY_ABBR.map(day => `<strong>${day}</strong>`).join('') +
    cells.join('') + '</div>';
}
