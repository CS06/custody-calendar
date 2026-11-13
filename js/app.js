/**
 * Custody Calendar — Main Application
 */

const _currentUserId = 'local-user';
window._children = [];
window.currentChildId = null;
window._colors = null;
window.daysOff = [];

async function initApp() {
  window._colors = { ...getDefaultColors(), ...validColors(await getConfig('colors').catch(() => null)) };
  for (const [parent, color] of Object.entries(window._colors)) {
    document.documentElement.style.setProperty(`--${parent}-color`, color);
  }

  window._children = await getAllChildren(_currentUserId).catch(() => []);
  window.currentChildId = window._children[0]?.id || null;
  window.daysOff = await getConfig('daysOff') || [];

  // Initialize UI
  ui.init();
  initCalendar();

  // Ensure colors are applied (re-render calendar with loaded colors)
  if (window._colors && document.getElementById('calendar-container')) {
    renderCalendar();
    updateLegend();
  }

  // Check if setup is needed
  const setupDone = localStorage.getItem('custody-calendar-setup');
  const wizard = document.getElementById('setup-wizard');
  if (setupDone && window._children.length > 0) {
    wizard?.classList.add('hidden');
  } else {
    showSetupWizard();
  }

  // Browser notice dismiss
  document.getElementById('browser-notice-dismiss')?.addEventListener('click', () => {
    localStorage.setItem('custody-calendar-browser-notice', '1');
    document.getElementById('browser-notice').classList.add('hidden');
  });

  // Initialize theme
  initTheme();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ===== Theme Toggle =====
function initTheme() {
  const saved = localStorage.getItem('custody-calendar-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  setTheme(theme);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('custody-calendar-theme', theme);
  
  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');
  
  if (theme === 'dark') {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  } else {
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  }
}

document.getElementById('btn-theme')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current === 'dark' ? 'light' : 'dark');
});


// ===== Setup Wizard =====
function showSetupWizard(child = null) {
  const additional = window._children.length > 0;
  const schedule = child?.schedule;
  ui._wizardData = {
    childId: child?.id,
    childName: child?.name || '',
    startingParent: schedule?.startingParent || 'mother',
    scheduleStart: schedule?.start || localDateKey(new Date()),
    switchTime: schedule?.switchTime || '08:30',
    template: child ? 'custom' : 'alternating-weeks',
    weekATemplate: schedule?.weekATemplate?.length ? [...schedule.weekATemplate] : Array(7).fill('mother'),
    weekBTemplate: schedule?.weekBTemplate?.length ? [...schedule.weekBTemplate] : Array(7).fill('father'),
    alternateWeeks: schedule?.alternateWeeks !== false
  };
  const wizard = document.getElementById('setup-wizard');
  wizard.style.display = '';
  wizard.classList.remove('hidden');
  document.getElementById('wizard-title').textContent = child ? 'Edit schedule' :
    additional ? 'Add a child' : 'Welcome to Custody Calendar';
  document.getElementById('wizard-import-section').hidden = additional;
  document.getElementById('wizard-cancel').hidden = !additional;
  document.getElementById('child-name').value = ui._wizardData.childName;
  document.getElementById('wizard-next-1').disabled = !child;
  document.getElementById('schedule-start').value = ui._wizardData.scheduleStart;
  document.getElementById('wizard-switch-time').value = ui._wizardData.switchTime;
  handleParentToggle(ui._wizardData.startingParent, 'wizard-step-2');
  document.querySelectorAll('.template-btn').forEach(button =>
    button.classList.toggle('active', button.dataset.template === ui._wizardData.template));
  showWizardStep(1);
}

document.getElementById('wizard-cancel').addEventListener('click', () => {
  document.getElementById('setup-wizard').classList.add('hidden');
});

function showWizardStep(step) {
  document.querySelectorAll('.wizard-step').forEach(s => s.classList.add('hidden'));
  document.getElementById(`wizard-step-${step}`).classList.remove('hidden');
  document.getElementById('wizard-step-indicator').textContent = `Step ${step} of 4`;
  if (step === 2) {
    const dateInput = document.getElementById('schedule-start');
    if (dateInput && !dateInput.value) {
      dateInput.value = ui._wizardData.scheduleStart || localDateKey(new Date());
    }
  }
  if (step === 3) {
    renderWizardTemplateGrid();
  }
}
window.showWizardStep = showWizardStep;
window.handleTemplateClick = handleTemplateClick;
window.toggleWizardDay = toggleWizardDay;

function renderWizardTemplateGrid() {
  const data = ui._wizardData;
  if (!data.weekATemplate) return;

  renderWizardWeekGrid('wizard-week-a', data.weekATemplate);

  const editor = document.getElementById('custom-schedule-editor');
  const weekB = document.getElementById('wizard-week-b');
  const altLabel = document.getElementById('alternate-toggle-label');
  const altCheckbox = document.getElementById('wizard-alternate-weeks');
  const hint = document.getElementById('week-pattern-hint');
  const isAlternating = data.template === 'alternating-weeks';
  const isCustom = data.template === 'custom';

  // Show editor for any template with week definition
  if (editor) {
    editor.classList.remove('hidden');
  }

  // For presets (non-custom), alternate weeks is always on and disabled
  // For custom, it's controlled by the checkbox
  const isAlternateEnabled = isCustom ? data.alternateWeeks : true;
  const isCheckboxDisabled = !isCustom;

  if (altCheckbox) {
    altCheckbox.checked = isAlternateEnabled;
    altCheckbox.disabled = isCheckboxDisabled;
  }

  // Show both weeks when alternating is enabled
  if (isAlternateEnabled) {
    if (weekB) weekB.classList.remove('hidden');
    renderWizardWeekGrid('wizard-week-b', data.weekBTemplate);
    if (altLabel) altLabel.classList.remove('hidden');
    if (isAlternating) {
      if (hint) hint.textContent = 'Tap each day to assign it to a parent. Week B auto-flips:';
    } else {
      if (hint) hint.textContent = 'Define the first week pattern:';
    }
  } else {
    // No alternate: show only first week
    if (weekB) weekB.classList.add('hidden');
    if (altLabel) altLabel.classList.add('hidden');
    if (hint) hint.textContent = 'This pattern repeats every week:';
  }
}

function renderWizardWeekGrid(containerId, template) {
  const container = document.getElementById(containerId);
  let html = '';
  for (let i = 0; i < 7; i++) {
    const parent = template[i] || 'mother';
    html += `<button class="week-day-btn ${parent}" data-day="${i}" onclick="toggleWizardDay(this)"><span>${DAY_ABBR[i]}</span></button>`;
  }
  container.innerHTML = html;
}

function toggleWizardDay(btn) {
  const day = parseInt(btn.dataset.day);
  const current = btn.classList.contains('mother') ? 'mother' : 'father';
  const next = current === 'mother' ? 'father' : 'mother';
  btn.classList.remove(current);
  btn.classList.add(next);

  const isWeekB = !!btn.closest('#wizard-week-b');
  const key = isWeekB ? 'weekBTemplate' : 'weekATemplate';
  ui._wizardData[key][day] = next;

  // For alternating weeks, flip the same day in the other week
  if (ui._wizardData.template === 'alternating-weeks') {
    const otherKey = isWeekB ? 'weekATemplate' : 'weekBTemplate';
    ui._wizardData[otherKey][day] = next === 'mother' ? 'father' : 'mother';

    // Update the other week's button visual
    const otherContainerId = isWeekB ? 'wizard-week-a' : 'wizard-week-b';
    const otherBtn = document.querySelector(`#${otherContainerId} .week-day-btn[data-day="${day}"]`);
    if (otherBtn) {
      const otherCurrent = otherBtn.classList.contains('mother') ? 'mother' : 'father';
      otherBtn.classList.remove(otherCurrent);
      otherBtn.classList.add(next === 'mother' ? 'father' : 'mother');
    }
  }
}

// Wizard button handlers
document.addEventListener('input', (e) => {
  // Child name input — enable next button
  if (e.target.id === 'child-name') {
    document.getElementById('wizard-next-1').disabled = e.target.value.trim().length === 0;
  }
});

// Wizard import file handler
document.getElementById('wizard-import-input')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById('wizard-import-name').textContent = file.name;

  try {
    const data = await readBackup(file);
    if (!data.children.length) throw new Error('No children found in this backup.');
    await importData(data);
    ui.finishBackupImport();
  } catch (err) {
    console.error('Wizard import error:', err);
    ui.showMessage('Error importing file: ' + err.message);
  }
});
function handleTemplateClick(templateName) {
  document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.template-btn[data-template="${templateName}"]`);
  if (btn) btn.classList.add('active');
  ui._wizardData.template = templateName;

  // Set default templates for preset types
  if (templateName === 'alternating-weeks') {
    // Default: Sunday = father, Mon-Sat = mother (and vice versa for Week B)
    setAlternatingWizardWeeks(ui._wizardData.startingParent);
    ui._wizardData.alternateWeeks = true;
  } else if (templateName === '2-2-3') {
    ui._wizardData.weekATemplate = ['mother','mother','father','father','mother','mother','mother'];
    ui._wizardData.weekBTemplate = ['father','father','mother','mother','father','father','father'];
  } else if (templateName === 'every-other-weekend') {
    ui._wizardData.weekATemplate = ['mother','mother','father','mother','mother','father','father'];
    ui._wizardData.weekBTemplate = ['mother','mother','father','mother','mother','mother','mother'];
  }

  renderWizardTemplateGrid();
}

function setAlternatingWizardWeeks(parent) {
  const otherParent = parent === 'mother' ? 'father' : 'mother';
  ui._wizardData.weekATemplate = [otherParent, ...Array(6).fill(parent)];
  ui._wizardData.weekBTemplate = [parent, ...Array(6).fill(otherParent)];
}

function handleParentToggle(parentName, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.parent-btn').forEach(b => b.classList.remove('active'));
  const btn = container.querySelector(`.parent-btn[data-parent="${parentName}"]`);
  if (btn) btn.classList.add('active');
  ui._wizardData.startingParent = parentName;
  if (ui._wizardData.template === 'alternating-weeks') {
    setAlternatingWizardWeeks(parentName);
  }
}

// Wire up template buttons directly
document.querySelectorAll('.template-btn').forEach(btn => {
  btn.addEventListener('click', () => handleTemplateClick(btn.dataset.template));
});

// Wire up parent toggle buttons directly
document.querySelectorAll('#wizard-step-2 .parent-btn').forEach(btn => {
  btn.addEventListener('click', () => handleParentToggle(btn.dataset.parent, 'wizard-step-2'));
});

document.getElementById('wizard-next-1')?.addEventListener('click', () => {
  ui._wizardData.childName = document.getElementById('child-name').value.trim();
  if (ui._wizardData.childName) showWizardStep(2);
});

document.getElementById('wizard-back-2')?.addEventListener('click', () => showWizardStep(1));
document.getElementById('wizard-next-2')?.addEventListener('click', () => {
  const startDate = document.getElementById('schedule-start').value;
  if (!startDate) { ui.showMessage('Choose a start date.').then(() => document.getElementById('schedule-start').focus()); return; }
  ui._wizardData.scheduleStart = startDate;
  ui._wizardData.switchTime = document.getElementById('wizard-switch-time').value || '08:30';
  showWizardStep(3);
});
document.getElementById('wizard-back-3')?.addEventListener('click', () => showWizardStep(2));

document.getElementById('wizard-next-3')?.addEventListener('click', () => {
  ui._wizardData.weekATemplate = [];
  document.querySelectorAll('#wizard-week-a .week-day-btn').forEach(btn => {
    ui._wizardData.weekATemplate.push(btn.classList.contains('mother') ? 'mother' : 'father');
  });
  if (ui._wizardData.template === 'custom' || ui._wizardData.alternateWeeks) {
    ui._wizardData.weekBTemplate = [];
    document.querySelectorAll('#wizard-week-b .week-day-btn').forEach(btn => {
      ui._wizardData.weekBTemplate.push(btn.classList.contains('mother') ? 'mother' : 'father');
    });
  }
  showWizardStep(4);
});
document.getElementById('wizard-back-4')?.addEventListener('click', () => showWizardStep(3));

document.getElementById('wizard-preload-holidays')?.addEventListener('change', (e) => {
  ui._wizardData.preloadHolidays = e.target.checked;
});
document.getElementById('wizard-preload-birthdays')?.addEventListener('change', (e) => {
  ui._wizardData.preloadBirthdays = e.target.checked;
});
document.getElementById('wizard-alternate-weeks')?.addEventListener('change', (e) => {
  ui._wizardData.alternateWeeks = e.target.checked;
  renderWizardTemplateGrid();
});

function finishWizard() {
  const data = ui._wizardData;

  const existing = window._children.find(child => child.id === data.childId);
  if (data.childId && !existing) return;
  const child = {
    holidays: [],
    overrides: [],
    ...existing,
    id: existing?.id || generateId(),
    userId: _currentUserId,
    name: data.childName,
    schedule: {
      ...existing?.schedule,
      start: data.scheduleStart,
      startingParent: data.startingParent,
      switchTime: data.switchTime,
      weekATemplate: data.weekATemplate,
      weekBTemplate: data.weekBTemplate,
      alternateWeeks: data.alternateWeeks || data.template !== 'custom'
    }
  };

  // Disable button to prevent double-click
  const finishBtn = document.getElementById('wizard-finish');
  if (finishBtn) finishBtn.disabled = true;

  // Save to DB and update state
  saveChild(child).then(function() {
    if (existing) window._children = window._children.map(item => item.id === child.id ? child : item);
    else window._children.push(child);
    setActiveChild(child.id);

    // Mark setup as done
    localStorage.setItem('custody-calendar-setup', '1');

    // Hide wizard
    var wizard = document.getElementById('setup-wizard');
    wizard.style.display = '';
    wizard.classList.add('hidden');

    // Re-render
    ui.renderChildTabs();
  }).catch(function(e) {
    console.error('[Wizard] Save error:', e);
    ui.showMessage('Error saving schedule: ' + e.message);
  }).finally(() => {
    if (finishBtn) finishBtn.disabled = false;
  });
}

document.getElementById('wizard-finish')?.addEventListener('click', finishWizard);

// ===== Preset quick-add (for settings) =====
async function addPresetHolidays() {
  const child = getChild();
  if (!child) return;
  const presets = getHolidayPresets();
  for (const p of presets) {
    child.holidays.push({ ...p, id: generateId() });
  }
  await saveChild(child);
  ui.renderSettingsHolidays();
  renderCalendar();
}

// Make helpers globally accessible
window.navigate = navigate;
window.goToToday = goToToday;
window.setView = setView;
window.setActiveChild = setActiveChild;
window.getChild = getChild;
window.renderCalendar = renderCalendar;
window.updateLegend = updateLegend;
window.getDefaultColors = getDefaultColors;
window.formatTime = formatTime;
window.ADD_DAY_NAMES = DAY_NAMES;
window.DAY_ABBR = DAY_ABBR;
