const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
process.env.TZ = 'America/Los_Angeles';

const storage = new Map();
const context = vm.createContext({
  assert,
  console,
  window: { _children: [], _colors: null },
  document: { documentElement: { style: { setProperty() {} } } },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  }
});
for (const name of ['db', 'holidays', 'schedule', 'calendar']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8'), context);
}

vm.runInContext(`
(async () => {
  for (const [id, date] of [
    ['mothers-day', '2026-05-10'], ['fathers-day', '2026-06-21'],
    ['halloween', '2026-10-31'], ['memorial', '2026-05-25']
  ]) {
    const preset = getHolidayPresets().find(holiday => holiday.id === id);
    assert.equal(localDateKey(calculateHolidayDate(preset, 2026)), date);
  }
  const _currentUserId = 'local-user';
  const child = {
    id: 'existing', userId: 'local-user', name: 'Test child',
    schedule: {
      start: '2026-03-02', switchTime: '08:30',
      weekATemplate: Array(7).fill('mother'), weekBTemplate: Array(7).fill('father')
    }
  };
  const day = (date, entry = child) => getDaySchedule(entry, parseLocalDate(date));
  assert.equal(day('2026-03-09').parent, 'father');
  assert.equal(day('2026-03-09').switchTime, '08:30');
  assert.equal(day('2026-03-16').parent, 'mother');
  assert.equal(day('2026-11-02').parent, 'father');
  assert.ok(day('2060-01-01').parent);

  const timed = {
    ...child,
    schedule: { ...child.schedule, alternateWeeks: false },
    holidays: [
      { name: 'Year end', type: 'fixed', params: { month: 12, day: 31 },
        duration: 1, startTime: '18:00', endTime: '12:00', evenParent: 'father', oddParent: 'mother' }
    ],
    overrides: [
      { date: '2027-01-01', endDate: '2027-01-02', parent: 'mother', time: '09:00' },
      { date: '2027-01-01', parent: 'father', time: '09:00' }
    ]
  };
  assert.equal(day('2026-12-31', timed).switchTime, '18:00');
  const jan = day('2027-01-01', timed);
  assert.equal(jan.firstParent, 'father');
  assert.equal(jan.parent, 'mother');
  assert.equal(jan.switchTime, '09:00');
  assert.equal(day('2027-01-01', { ...timed, overrides: [] }).switchTime, '12:00');
  assert.deepEqual(jan, getMonthSchedule(timed, 2027, 0)[0]);
  assert.deepEqual(jan, getWeekSchedule(timed, new Date(2027, 0, 1, 20))[4]);
  assert.ok(day('2027-01-02', timed).override);
  assert.equal(day('2027-01-03', timed).override, null);
  assert.equal(day('2027-01-01', { ...timed, overrides: [], holidays: [] }).isSplit, false);

  _currentDate = new Date(2026, 0, 31);
  renderCalendar = () => {};
  navigate(1);
  assert.equal(localDateKey(_currentDate), '2026-02-01');
  assert.equal(escapeHTML('<b>'), '&lt;b&gt;');

  timed.daysOff = [
    { type: 'school', name: 'Winter break', start: '2026-12-29', end: '2027-01-03', repeat: true },
    { type: 'work', name: '', start: '2028-01-01', repeat: false },
    { type: 'vacation', name: '<Trip>', start: '2028-01-01', repeat: false }
  ];
  assert.equal(daysOffForDate(timed, parseLocalDate('2026-01-01')).length, 0);
  assert.equal(daysOffForDate(timed, parseLocalDate('2028-01-01')).length, 3);
  assert.equal(daysOffForDate(timed, parseLocalDate('2028-01-02')).length, 1);
  assert.equal(daysOffForDate(timed, parseLocalDate('2028-01-04')).length, 0);
  assert.equal(day('2027-01-01', timed).switchTime, '09:00');
  assert.equal(validSchoolRange('2026-02-29', '', false), false);
  assert.match(daysOffDetails(timed, parseLocalDate('2028-01-01')), /&lt;Trip&gt;/);
  const icons = daysOffIcons(timed, parseLocalDate('2028-01-01'));
  assert.deepEqual([...icons.matchAll(/<title>(.*?)<\\/title>/g)].map(match => match[1]),
    ['No school', 'Off work', 'Vacation']);
  const printArea = {};
  document.getElementById = () => printArea;
  window._children = [timed];
  _currentDate = new Date(2028, 0, 1);
  renderPrintMonth();
  assert.match(printArea.innerHTML, /January 2028/);
  assert.match(printArea.innerHTML, /Winter break, Off work, Vacation: &lt;Trip&gt;/);

  globalThis._currentUserId = _currentUserId;
  await saveChild(child);
  const backup = { schemaVersion: 1, children: [timed], colors: { mother: '#ff0000' } };
  await assert.rejects(importData({ ...backup, children: [{ ...timed, schedule: {} }] }, { replace: true }));
  assert.equal((await getAllChildren(_currentUserId))[0].name, 'Test child');
  await importData(backup);
  assert.equal((await getAllChildren(_currentUserId)).length, 2);
  const write = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Storage full'); };
  await assert.rejects(importData(backup, { replace: true }), /Storage full/);
  assert.equal((await getAllChildren(_currentUserId)).length, 2);
  localStorage.setItem = write;
  await importData(backup, { replace: true });
  assert.equal((await getAllChildren(_currentUserId)).length, 1);
  assert.equal((await getConfig('colors')).mother, '#ff0000');
  assert.equal((await getAllChildren(_currentUserId))[0].daysOff.length, 3);
  const sibling = { ...child, id: 'sibling', name: 'Sibling' };
  const scoped = { type: 'school', name: 'School break', start: '2028-01-01', repeat: false,
    childIds: [timed.id, sibling.id] };
  const all = { ...scoped, type: 'work', childIds: null };
  await importData({ schemaVersion: 1, children: [timed, sibling], daysOff: [scoped, all] });
  const importedSibling = window._children.find(entry => entry.name === 'Sibling');
  assert.notEqual(importedSibling.id, sibling.id);
  const checkDate = parseLocalDate('2028-01-01');
  assert.equal(daysOffForDate(importedSibling, checkDate).length, 2);
  assert.equal(daysOffForDate({ ...child, id: 'future' }, checkDate).length, 1);
  window.daysOff.push({ legacyKey: JSON.stringify([timed.id, 0]), deleted: true });
  assert.equal(daysOffForChild(timed).some(entry => entry.name === 'Winter break'), false);
  await importData(backup, { replace: true });
  assert.equal(window.daysOff.length, 0);
  console.log('Calendar and backup regression checks passed.');
})()
`, context).catch(error => {
  console.error(error);
  process.exitCode = 1;
});

