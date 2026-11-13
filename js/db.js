/**
 * Custody Calendar — Storage wrapper (IndexedDB with localStorage fallback)
 */

const DB_NAME = 'CustodyCalendar';
const DB_VERSION = 1;
const STORE_CONFIG = 'config';
const STORE_CHILDREN = 'children';
const LS_KEY_CHILDREN = 'custody-calendar-children';
const LS_KEY_CONFIG = 'custody-calendar-config';

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_CONFIG)) {
        db.createObjectStore(STORE_CONFIG);
      }
      if (!db.objectStoreNames.contains(STORE_CHILDREN)) {
        const store = db.createObjectStore(STORE_CHILDREN, { keyPath: 'id' });
        store.createIndex('userId', 'userId');
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
    setTimeout(() => {
      if (!_db) {
        reject(new Error('Database open timed out'));
      }
    }, 10000);
  });
}

async function clearAllData() {
  const db = await openDB().catch(() => null);
  if (db) {
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CHILDREN, STORE_CONFIG], 'readwrite');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
      tx.objectStore(STORE_CHILDREN).clear();
      tx.objectStore(STORE_CONFIG).clear();
    });
  }
  for (const key of [LS_KEY_CHILDREN, LS_KEY_CONFIG, 'custody-calendar-setup',
    'custody-calendar-theme', 'custody-calendar-browser-notice']) localStorage.removeItem(key);
}

function escapeHTML(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, char => entities[char]);
}

function validColors(colors) {
  return Object.fromEntries(['mother', 'father'].filter(parent =>
    /^#[0-9a-f]{6}$/i.test(colors?.[parent])).map(parent => [parent, colors[parent]]));
}

// localStorage fallback helpers
function lsGetChildren() {
  try {
    const bundled = lsGetConfig('children');
    if (Array.isArray(bundled)) return bundled;
    const data = localStorage.getItem(LS_KEY_CHILDREN);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function lsSetChildren(children) {
  try {
    lsSetConfig('children', children);
  } catch (e) {
    console.error('[DB] localStorage save failed:', e);
  }
}

function lsGetConfig(key) {
  try {
    const data = localStorage.getItem(LS_KEY_CONFIG);
    if (!data) return null;
    const config = JSON.parse(data);
    return config[key] || null;
  } catch (e) {
    return null;
  }
}

function lsSetConfig(key, value) {
  const config = JSON.parse(localStorage.getItem(LS_KEY_CONFIG) || '{}');
  config[key] = value;
  localStorage.setItem(LS_KEY_CONFIG, JSON.stringify(config));
}

async function getConfig(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CONFIG, 'readonly');
      const store = tx.objectStore(STORE_CONFIG);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    // Fallback to localStorage
    return lsGetConfig(key);
  }
}

async function setConfig(key, value) {
  const db = await openDB().catch(() => null);
  if (!db) return lsSetConfig(key, value);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CONFIG, 'readwrite');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
    tx.objectStore(STORE_CONFIG).put({ key, value }, key);
  });
}

async function getAllChildren(userId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CHILDREN, 'readonly');
      const store = tx.objectStore(STORE_CHILDREN);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).filter(c => c.userId === userId));
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    // Fallback to localStorage
    return lsGetChildren().filter(c => c.userId === userId);
  }
}

async function saveChild(child) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CHILDREN, 'readwrite');
      const store = tx.objectStore(STORE_CHILDREN);
      store.put(child);
      tx.oncomplete = () => resolve(child.id);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    // Fallback to localStorage
    const children = lsGetChildren();
    const idx = children.findIndex(c => c.id === child.id);
    if (idx >= 0) {
      children[idx] = child;
    } else {
      children.push(child);
    }
    lsSetChildren(children);
    return child.id;
  }
}

async function deleteChild(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CHILDREN, 'readwrite');
      const store = tx.objectStore(STORE_CHILDREN);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    // Fallback to localStorage
    let children = lsGetChildren();
    children = children.filter(c => c.id !== id);
    lsSetChildren(children);
  }
}

function validateBackup(data) {
  const assert = (condition, field) => {
    if (!condition) throw new Error(`Invalid backup field: ${field}.`);
  };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const parent = value => value === 'mother' || value === 'father';
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    localDateKey(parseLocalDate(value)) === value;
  const time = value => value == null || value === '' ||
    (typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value));
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  assert(object(data) && data.schemaVersion === 1 && Array.isArray(data.children), 'format');
  assert(data.colors == null || (object(data.colors) &&
    ['mother', 'father'].every(key => data.colors[key] == null || validColors(data.colors)[key])), 'colors');
  const ids = new Set();
  for (const child of data.children) {
    assert(object(child) && typeof child.name === 'string' && child.name.trim(), 'child name');
    assert(child.id == null || (typeof child.id === 'string' && child.id && !ids.has(child.id)), 'child ID');
    if (child.id) ids.add(child.id);
    const schedule = child.schedule;
    assert(object(schedule) && date(schedule.start) && time(schedule.switchTime), 'regular schedule');
    assert(schedule.alternateWeeks == null || typeof schedule.alternateWeeks === 'boolean', 'alternating weeks');
    for (const key of ['weekATemplate', 'weekBTemplate']) {
      const template = schedule[key];
      assert(template == null || (Array.isArray(template) && (template.length === 0 || (template.length === 7 && template.every(parent)))), key);
    }
    assert(child.daysOff == null || Array.isArray(child.daysOff), 'days off');
    for (const entry of child.daysOff || []) {
      assert(object(entry) && typeof entry.name === 'string' && typeof entry.repeat === 'boolean' &&
        (entry.type == null || ['school', 'work', 'vacation'].includes(entry.type)) &&
        validSchoolRange(entry.start, entry.end, entry.repeat), 'day off');
    }
    assert(child.overrides == null || Array.isArray(child.overrides), 'one-time changes');
    for (const entry of child.overrides || []) {
      const start = entry?.date || entry?.startDate;
      assert(object(entry) && date(start) && parent(entry.parent) && time(entry.time) &&
        (entry.name == null || typeof entry.name === 'string') &&
        (!entry.endDate || (date(entry.endDate) && entry.endDate >= start)), 'one-time change');
    }
    assert(child.holidays == null || Array.isArray(child.holidays), 'holidays');
    for (const entry of child.holidays || []) {
      assert(object(entry) && typeof entry.name === 'string' && object(entry.params) &&
        [entry.parent, entry.evenParent, entry.oddParent].every(value => value == null || parent(value)) &&
        integer(entry.offset ?? 0, -36600, 36600) && integer(entry.duration ?? 0, 0, 36600) &&
        time(entry.startTime) && time(entry.endTime) &&
        (entry.duration > 0 || !entry.endTime || parseTime(entry.endTime) > parseTime(entry.startTime)), 'holiday');
      const { month, day, weekday, n, offset } = entry.params;
      const weekdayValid = typeof weekday === 'string' && DAY_NAMES.includes(weekday.toLowerCase());
      const monthValid = integer(month, 1, 12);
      const valid = {
        fixed: monthValid && integer(day, 1, 31),
        'nth-weekday': monthValid && weekdayValid && (n === -1 || integer(n, 1, 5)),
        'last-weekday': monthValid && weekdayValid,
        'easter-based': integer(offset ?? 0, -36600, 36600)
      };
      assert(Object.hasOwn(valid, entry.type) && valid[entry.type], 'holiday date rule');
    }
  }
  assert(data.daysOff == null || Array.isArray(data.daysOff), 'shared days off');
  for (const entry of data.daysOff || []) {
    assert(object(entry) && typeof entry.name === 'string' && typeof entry.repeat === 'boolean' &&
      ['school', 'work', 'vacation'].includes(entry.type) &&
      validSchoolRange(entry.start, entry.end, entry.repeat) &&
      (entry.childIds === null || (Array.isArray(entry.childIds) && entry.childIds.length &&
        entry.childIds.every(id => ids.has(id)))), 'shared day off');
  }
  return data;
}

async function readBackup(file) {
  const json = file.type === 'image/png' || /\.png$/i.test(file.name)
    ? MetaPNG.getMetadata(new Uint8Array(await file.arrayBuffer()), 'custody-calendar-export')
    : await file.text();
  if (!json) throw new Error('This file contains no Custody Calendar backup.');
  return validateBackup(JSON.parse(json));
}

async function importData(data, { replace = false, includeChildren = true, includeColors = true } = {}) {
  validateBackup(data);
  const children = includeChildren ? data.children.map(child => ({
    ...child, id: replace && child.id ? child.id : generateId(), userId: _currentUserId
  })) : [];
  const childIds = new Map(data.children.map((child, i) => [child.id, children[i]?.id]));
  const daysOff = includeChildren ? [
    ...(replace ? [] : await getConfig('daysOff') || []),
    ...(data.daysOff || []).map(({ type, name, start, end, repeat, childIds: scope }) => ({
      type, name, start, end, repeat, childIds: scope?.map(id => childIds.get(id)) ?? null
    }))
  ] : null;
  const colors = includeColors && Object.keys(validColors(data.colors)).length
    ? { ...getSafeColors(), ...validColors(data.colors) } : null;
  const db = await openDB().catch(() => null);
  if (!db) {
    const current = lsGetChildren();
    const config = JSON.parse(localStorage.getItem(LS_KEY_CONFIG) || '{}');
    if (includeChildren) config.children = [...(replace ? current.filter(c => c.userId !== _currentUserId) : current), ...children];
    if (colors) config.colors = colors;
    if (daysOff) config.daysOff = daysOff;
    localStorage.setItem(LS_KEY_CONFIG, JSON.stringify(config));
  } else {
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CHILDREN, STORE_CONFIG], 'readwrite');
      const store = tx.objectStore(STORE_CHILDREN);
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error('The backup could not be saved.'));
      if (includeChildren && replace) {
        const cursor = store.index('userId').openCursor(_currentUserId);
        cursor.onsuccess = () => {
          if (cursor.result) {
            cursor.result.delete();
            cursor.result.continue();
          } else {
            for (const child of children) store.add(child);
          }
        };
      } else {
        for (const child of children) store.add(child);
      }
      if (daysOff) tx.objectStore(STORE_CONFIG).put({ key: 'daysOff', value: daysOff }, 'daysOff');
      if (colors) tx.objectStore(STORE_CONFIG).put({ key: 'colors', value: colors }, 'colors');
    });
  }
  if (daysOff) window.daysOff = daysOff;
  window._children = await getAllChildren(_currentUserId);
  if (colors) {
    window._colors = colors;
    for (const [parent, color] of Object.entries(colors)) {
      document.documentElement.style.setProperty(`--${parent}-color`, color);
    }
  }
  if (!window._children.some(child => child.id === window.currentChildId)) {
    window.currentChildId = window._children[0]?.id || null;
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
