/**
 * Custody Calendar — UI Controller
 */

const ui = {
  _editingHoliday: null,
  _editingOverride: null,
  _editingChildId: null,
  _wizardData: {
    childName: '',
    startingParent: 'mother',
    scheduleStart: '',
    template: 'alternating-weeks',
    weekATemplate: ['father','mother','mother','mother','mother','mother','mother'],
    weekBTemplate: ['mother','father','father','father','father','father','father'],
    alternateWeeks: true,
    preloadHolidays: true,
    preloadBirthdays: true
  },

  init() {
    this.bindEvents();
    this.renderChildTabs();
    this.renderSettings();
  },

  bindEvents() {
    // Navigation
    document.getElementById('btn-prev').addEventListener('click', () => navigate(-1));
    document.getElementById('btn-next').addEventListener('click', () => navigate(1));
    document.getElementById('btn-today').addEventListener('click', goToToday);

    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    // Settings
    document.getElementById('btn-settings').addEventListener('click', () => this.toggleSettings());
    document.getElementById('btn-close-settings').addEventListener('click', () => this.toggleSettings());

    const help = document.getElementById('help-screen');
    document.getElementById('btn-help').addEventListener('click', () => {
      this.toggleSettings();
      help.showModal();
      help.querySelector('.help-content').scrollTop = 0;
    });
    help.addEventListener('close', () => document.getElementById('btn-settings').focus());

    // Export/Import
    document.getElementById('btn-export').addEventListener('click', () => this.showIOModal('export'));
    document.getElementById('btn-import').addEventListener('click', () => this.showIOModal('import'));
    document.getElementById('import-file-input').addEventListener('change', (e) => this.handleImport(e));
    document.getElementById('io-close').addEventListener('click', () => this.hideIOModal());

    // Modals
    document.getElementById('modal-cancel').addEventListener('click', () => this.hideModal());
    document.getElementById('modal-save')?.addEventListener('click', () => this.saveModal());
    document.getElementById('modal-delete')?.addEventListener('click', () => this.deleteModal());

    // Child modal
    document.getElementById('child-modal-cancel').addEventListener('click', () => this.hideChildModal());
    document.getElementById('child-modal-save').addEventListener('click', () => this.saveChildModal());
    document.getElementById('child-modal-delete')?.addEventListener('click', () => this.deleteChildModal());

    // Add buttons
    document.getElementById('btn-add-child').addEventListener('click', () => this.addChild());
    document.getElementById('btn-add-child-settings').addEventListener('click', () => this.addChild());
    document.getElementById('btn-add-holiday').addEventListener('click', () => this.editHoliday());
    document.getElementById('btn-add-override').addEventListener('click', () => this.editOverride());

    // Schedule settings
    document.getElementById('btn-save-schedule').addEventListener('click', () => {
      console.log('[Click] save schedule clicked');
      this.saveSchedule().catch(e => console.error('[Click] saveSchedule error:', e));
    });
    document.getElementById('btn-reset-data').addEventListener('click', async () => {
      if (!confirm('Permanently delete all Custody Calendar data in this browser?')) return;
      try {
        await clearAllData();
        location.reload();
      } catch (error) {
        alert('Could not reset Custody Calendar. ' + error.message);
      }
    });
    document.getElementById('btn-save-appearance').addEventListener('click', () => this.saveAppearance());

    // Parent toggles in settings
    document.querySelectorAll('.setting-parent-toggle .parent-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.parentElement.querySelectorAll('.parent-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Alternate weeks toggle — flip Week B to match opposite of Week A
    document.getElementById('setting-alternate-weeks')?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const weekABtns = document.querySelectorAll('#setting-week-a .week-day-btn');
      const weekBBtns = document.querySelectorAll('#setting-week-b .week-day-btn');
      
      // Update Week B to be opposite of Week A
      weekABtns.forEach((btn, idx) => {
        if (weekBBtns[idx]) {
          const aCurrent = btn.classList.contains('mother') ? 'mother' : 'father';
          const bOpposite = aCurrent === 'mother' ? 'father' : 'mother';
          
          const bCurrent = weekBBtns[idx].classList.contains('mother') ? 'mother' : 'father';
          weekBBtns[idx].classList.remove(bCurrent);
          weekBBtns[idx].classList.add(bOpposite);
        }
      });
      
      // Show/hide Week B based on toggle
      const weekBContainer = document.getElementById('setting-week-b');
      if (weekBContainer) {
        weekBContainer.classList.toggle('hidden', !isChecked);
      }
    });

    document.getElementById('days-off-form').addEventListener('submit', event => {
      event.preventDefault();
      this.saveDayOff();
    });
    document.getElementById('day-off-type').addEventListener('change', event => {
      if (!this._editingDayOff) this.renderDayOffScope(event.target.value === 'school' ? [getChild()?.id] : null);
    });
    document.getElementById('days-off-all').addEventListener('change', event => {
      document.getElementById('days-off-children').hidden = event.target.checked;
    });
    document.getElementById('days-off-cancel').addEventListener('click', () => this.renderDaysOff());
    document.getElementById('btn-print-month').addEventListener('click', () => window.print());
    window.addEventListener('beforeprint', renderPrintMonth);

    // Install banner
    this.setupInstallPrompt();

    // Browser notice
    this.showBrowserNotice();
  },

  // ===== Child Management =====
  renderChildTabs() {
    const children = window._children || [];
    const container = document.getElementById('child-tabs');
    if (!container) return;

    let html = '';
    for (const child of children) {
      html += `<button class="child-tab${child.id === window.currentChildId ? ' active' : ''}" data-id="${escapeHTML(child.id)}">${escapeHTML(child.name)}</button>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('.child-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        setActiveChild(btn.dataset.id);
        this.renderChildTabs();
      });
    });
  },

  showChildModal(childId = null) {
    const modal = document.getElementById('child-modal');
    const title = document.getElementById('child-modal-title');
    const nameInput = document.getElementById('child-modal-name');
    const deleteBtn = document.getElementById('child-modal-delete');

    this._editingChildId = childId;

    if (childId) {
      // Edit mode
      const child = window._children.find(c => c.id === childId);
      title.textContent = 'Edit Child';
      nameInput.value = child ? child.name : '';
      deleteBtn.classList.remove('hidden');
    } else {
      // Add mode
      title.textContent = 'Add Child';
      nameInput.value = '';
      deleteBtn.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    setTimeout(() => nameInput.focus(), 50);
  },

  hideChildModal() {
    document.getElementById('child-modal').classList.add('hidden');
    this._editingChildId = null;
  },

  async saveChildModal() {
    const nameInput = document.getElementById('child-modal-name');
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }

    if (this._editingChildId) {
      // Edit existing child
      const child = window._children.find(c => c.id === this._editingChildId);
      if (child) {
        child.name = name;
        await saveChild(child);
        window._children = window._children.map(c => c.id === this._editingChildId ? child : c);
        this.renderChildTabs();
        this.renderSettingsChildren();
      }
    } else {
      // Add new child
      const child = {
        id: generateId(),
        userId: _currentUserId,
        name,
        schedule: {
          start: localDateKey(new Date()),
          startingParent: 'mother',
          switchTime: '08:30',
          weekATemplate: ['father','mother','mother','mother','mother','mother','mother'],
          weekBTemplate: ['mother','father','father','father','father','father','father'],
          alternateWeeks: true,
        },
        holidays: [],
        overrides: []
      };

      await saveChild(child);
      window._children.push(child);
      setActiveChild(child.id);
      this.renderChildTabs();
    }

    this.hideChildModal();
  },

  async deleteChildModal() {
    if (!this._editingChildId) return;
    
    const child = window._children.find(c => c.id === this._editingChildId);
    const confirmMsg = child 
      ? `Delete "${child.name}" and all their data?`
      : 'Delete this child and all their data?';
    
    if (!confirm(confirmMsg)) return;
    
    await deleteChild(this._editingChildId);
    window._children = window._children.filter(c => c.id !== this._editingChildId);
    
    if (window.currentChildId === this._editingChildId) {
      window.currentChildId = window._children[0]?.id || null;
    }
    
    this.renderChildTabs();
    this.renderSettingsChildren();
    this.hideChildModal();
  },

  async addChild() {
    this.showChildModal(null);
  },

  async editChildName(id) {
    this.showChildModal(id);
  },

  async deleteChild(id) {
    this.showChildModal(id);
  },

  // ===== Settings Panel =====
  toggleSettings() {
    const panel = document.getElementById('settings-panel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      this.renderSettingsSchedule();
      this.renderSettingsChildren();
      this.renderSettingsHolidays();
      this.renderSettingsOverrides();
      this.renderSettingsAppearance();
      this.renderDaysOff();
    }
  },

  renderDaysOff() {
    const form = document.getElementById('days-off-form');
    const list = document.getElementById('days-off-list');
    const child = getChild();
    this._editingDayOff = null;
    form.reset();
    form.hidden = !child;
    document.getElementById('days-off-save').textContent = 'Add days off';
    document.getElementById('days-off-cancel').classList.add('hidden');
    list.replaceChildren();
    this.renderDayOffScope([child?.id]);
    for (const entry of daysOffForChild(child)) {
      const legacyIndex = (child.daysOff || []).indexOf(entry);
      const identity = legacyIndex < 0 ? entry : { legacyKey: JSON.stringify([child.id, legacyIndex]) };
      const row = document.createElement('div');
      row.className = 'override-list-item';
      const text = document.createElement('span');
      text.textContent = [dayOffLabel(entry), entry.name,
        entry.end ? entry.start + ' – ' + entry.end : entry.start,
        entry.repeat ? 'Repeats yearly' : '',
        entry.childIds === null ? 'All children' : window._children
          .filter(child => entry.childIds?.includes(child.id)).map(child => child.name).join(', ')].filter(Boolean).join(' · ');
      const actions = document.createElement('div');
      actions.className = 'override-actions';
      for (const [label, action] of [
        ['Edit', () => this.editDayOff(identity, entry)],
        ['Delete', () => {
          if (confirm('Delete this entry from all calendars it applies to?')) {
            this.updateDaysOff(identity, null);
          }
        }]
      ]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.addEventListener('click', action);
        actions.append(button);
      }
      row.append(text, actions);
      list.append(row);
    }
  },

  renderDayOffScope(childIds) {
    const all = document.getElementById('days-off-all');
    const list = document.getElementById('days-off-children');
    all.checked = childIds === null;
    list.hidden = all.checked;
    list.replaceChildren();
    for (const child of window._children) {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = child.id;
      checkbox.checked = childIds?.includes(child.id) || false;
      label.append(checkbox, ' ' + child.name);
      list.append(label);
    }
  },

  editDayOff(identity, entry) {
    this._editingDayOff = identity;
    this.renderDayOffScope(entry.childIds === undefined ? [getChild()?.id] : entry.childIds);
    document.getElementById('day-off-type').value = entry.type || 'school';
    document.getElementById('days-off-name').value = entry.name;
    document.getElementById('days-off-start').value = entry.start;
    document.getElementById('days-off-end').value = entry.end || '';
    document.getElementById('days-off-repeat').checked = entry.repeat;
    document.getElementById('days-off-save').textContent = 'Save days off';
    document.getElementById('days-off-cancel').classList.remove('hidden');
    document.getElementById('day-off-type').focus();
  },

  saveDayOff() {
    const child = getChild();
    if (!child) return;
    const entry = {
      type: document.getElementById('day-off-type').value,
      name: document.getElementById('days-off-name').value.trim(),
      start: document.getElementById('days-off-start').value,
      end: document.getElementById('days-off-end').value,
      repeat: document.getElementById('days-off-repeat').checked
    };
    if (!validSchoolRange(entry.start, entry.end, entry.repeat)) {
      alert('Choose a valid date range. A yearly entry must span less than a year.');
      return;
    }
    entry.childIds = document.getElementById('days-off-all').checked ? null :
      Array.from(document.querySelectorAll('#days-off-children input:checked'), input => input.value);
    if (entry.childIds?.length === 0) {
      alert('Select at least one child or choose All children.');
      return;
    }
    this.updateDaysOff(this._editingDayOff, entry);
  },

  async updateDaysOff(identity, entry) {
    if (this._savingDaysOff) return;
    this._savingDaysOff = true;
    const daysOff = window.daysOff.filter(item => item !== identity);
    if (entry) daysOff.push({ ...entry, legacyKey: identity?.legacyKey });
    else if (identity.legacyKey) daysOff.push({ legacyKey: identity.legacyKey, deleted: true });
    try {
      await setConfig('daysOff', daysOff);
      window.daysOff = daysOff;
      this.renderDaysOff();
      renderCalendar();
    } catch (error) {
      alert('Could not save days off. ' + error.message);
    } finally {
      this._savingDaysOff = false;
    }
  },

  renderSettings() {
    // Placeholder — actual rendering happens in toggleSettings
  },

  async renderSettingsSchedule() {
    const child = getChild();
    if (!child) return;

    const startDateInput = document.getElementById('setting-start-date');
    if (startDateInput) startDateInput.value = child.schedule.start || '';
    const switchTimeInput = document.getElementById('setting-switch-time');
    if (switchTimeInput) switchTimeInput.value = child.schedule.switchTime || '08:30';
    const altWeeksCheckbox = document.getElementById('setting-alternate-weeks');
    if (altWeeksCheckbox) altWeeksCheckbox.checked = child.schedule.alternateWeeks !== false;

    // Show/hide schedule editor based on template type
    const editor = document.getElementById('settings-schedule-editor');
    const isCustom = child.schedule.weekATemplate && child.schedule.weekATemplate.length === 7;
    if (editor) {
      editor.classList.toggle('hidden', !isCustom);
    }

    // Week templates
    this.renderWeekGrid('settings-week-a', child.schedule.weekATemplate || []);
    this.renderWeekGrid('settings-week-b', child.schedule.weekBTemplate || [], !child.schedule.alternateWeeks);
  },

  renderWeekGrid(containerId, template, hideLabel) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '';
    for (let i = 0; i < 7; i++) {
      const parent = template[i] === 'father' ? 'father' : 'mother';
      html += `<button class="week-day-btn ${parent}" data-day="${i}" onclick="ui.toggleWeekDay(this)"><span class="day-abbr">${DAY_ABBR[i]}</span>${parent === 'mother' ? 'Mom' : 'Dad'}</button>`;
    }
    container.innerHTML = html;
    if (hideLabel) container.classList.add('hidden');
    else container.classList.remove('hidden');
  },

  toggleWeekDay(btn) {
    const day = parseInt(btn.dataset.day);
    const child = getChild();
    if (!child) return;

    const current = btn.classList.contains('mother') ? 'mother' : 'father';
    const next = current === 'mother' ? 'father' : 'mother';
    btn.classList.remove(current);
    btn.classList.add(next);
    btn.querySelector('.day-abbr').textContent = DAY_ABBR[day];
    btn.textContent = DAY_ABBR[day] + '\n' + (next === 'mother' ? 'Mom' : 'Dad');
    btn.style.whiteSpace = 'pre-line';

    // Update template in memory
    const isWeekB = !!btn.closest('#setting-week-b');
    const key = isWeekB ? 'weekBTemplate' : 'weekATemplate';
    child.schedule[key][day] = next;
  },

  async saveSchedule() {
    const child = getChild();
    if (!child) return;

    child.schedule.start = document.getElementById('setting-start-date').value;
    child.schedule.switchTime = document.getElementById('setting-switch-time').value;
    child.schedule.alternateWeeks = document.getElementById('setting-alternate-weeks').checked;

    // Collect templates from DOM
    const weekA = [];
    const weekB = [];
    document.querySelectorAll('#setting-week-a .week-day-btn').forEach(btn => {
      weekA.push(btn.classList.contains('mother') ? 'mother' : 'father');
    });
    document.querySelectorAll('#setting-week-b .week-day-btn').forEach(btn => {
      weekB.push(btn.classList.contains('mother') ? 'mother' : 'father');
    });
    child.schedule.weekATemplate = weekA;
    child.schedule.weekBTemplate = weekB;

    // Starting parent
    const activeParentBtn = document.querySelector('.setting-parent-toggle .parent-btn.active');
    if (activeParentBtn) child.schedule.startingParent = activeParentBtn.dataset.parent;

    await saveChild(child);
    renderCalendar();
    updateLegend();
  },

  async renderSettingsChildren() {
    const container = document.getElementById('children-list');
    if (!container) return;
    let html = '';
    for (const child of window._children || []) {
      html += `<div class="children-list-item"><span>${escapeHTML(child.name)}</span><div class="child-actions"><button data-child-action="edit" data-child-id="${escapeHTML(child.id)}" aria-label="Edit ${escapeHTML(child.name)}" title="Rename">✎</button><button data-child-action="delete" data-child-id="${escapeHTML(child.id)}" aria-label="Delete ${escapeHTML(child.name)}" title="Delete">×</button></div></div>`;
    }
    container.innerHTML = html || '<p style="font-size:0.85rem;color:var(--text-muted);">No children added yet.</p>';
    for (const button of container.querySelectorAll('[data-child-action]')) {
      button.addEventListener('click', () => {
        if (button.dataset.childAction === 'edit') this.editChildName(button.dataset.childId);
        else this.deleteChild(button.dataset.childId);
      });
    }
  },

  // ===== Holidays Settings =====
  async renderSettingsHolidays() {
    const child = getChild();
    if (!child) return;
    const container = document.getElementById('holidays-list');
    if (!container) return;

    let html = '';
    for (let i = 0; i < (child.holidays || []).length; i++) {
      const h = child.holidays[i];
      const evenClass = h.evenParent === 'father' ? 'holiday-parent-dad' : 'holiday-parent-mom';
      const oddClass = h.oddParent === 'father' ? 'holiday-parent-dad' : 'holiday-parent-mom';
      const evenLabel = h.evenParent === 'father' ? 'Dad' : 'Mom';
      const oddLabel = h.oddParent === 'father' ? 'Dad' : 'Mom';
      const altBadge = h.evenParent !== h.oddParent ? '<span class="holiday-alt-badge">↔</span>' : '';
      const parentLabel = h.evenParent === h.oddParent ? evenLabel : `${evenLabel}/${oddLabel}`;
      html += `<div class="holiday-list-item"><span>${escapeHTML(h.name)}${altBadge}<span class="holiday-parent-badge ${evenClass}">${parentLabel}</span></span><div class="holiday-actions"><button onclick="ui.editHoliday(${i})" aria-label="Edit ${escapeHTML(h.name)}" title="Edit">✎</button><button onclick="ui.deleteHoliday(${i})" aria-label="Delete ${escapeHTML(h.name)}" title="Delete">×</button></div></div>`;
    }
    container.innerHTML = html || '<p style="font-size:0.85rem;color:var(--text-muted);">No holidays set.</p>';
  },

  editHoliday(holidayIndex) {
    const child = getChild();
    if (!child) return;

    this._editingHoliday = holidayIndex !== undefined ? holidayIndex : null;
    const modal = document.getElementById('event-modal');
    document.getElementById('modal-title').textContent = this._editingHoliday ? 'Edit Holiday' : 'Add Holiday';
    document.getElementById('modal-delete').classList.toggle('hidden', !this._editingHoliday);

    const body = document.getElementById('modal-body');
    const h = this._editingHoliday !== null ? child.holidays[this._editingHoliday] : { type: 'fixed', params: {}, evenParent: 'mother', oddParent: 'mother', offset: 0, duration: 0, startTime: '', endTime: '' };

    // Build preset options (excluding birthdays)
    const presets = getHolidayPresets().filter(p => !p.name.includes('Birthday'));
    const presetOptions = presets.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    body.innerHTML = `
      <label>Preset holiday</label>
      <select id="holiday-preset" onchange="ui.applyPreset(this.value)">
        <option value="">— Custom —</option>
        ${presetOptions}
      </select>
      <p class="form-hint">Select a preset to auto-fill, or enter details manually.</p>
      <label>Holiday name</label>
      <input type="text" id="holiday-name" value="${escapeHTML(h.name || '')}" placeholder="e.g., Thanksgiving">
      <label>Calculation type</label>
      <select id="holiday-type">
        <option value="fixed" ${h.type === 'fixed' ? 'selected' : ''}>Fixed date (same each year)</option>
        <option value="nth-weekday" ${h.type === 'nth-weekday' ? 'selected' : ''}>Nth weekday of month</option>
        <option value="last-weekday" ${h.type === 'last-weekday' ? 'selected' : ''}>Last weekday of month</option>
        <option value="easter-based" ${h.type === 'easter-based' ? 'selected' : ''}>Easter-based</option>
      </select>
      <div id="holiday-params"></div>
      <label>Offset (days from calculated date)</label>
      <p class="form-hint">Leave as 0. Enter 1 for Black Friday (day after Thanksgiving).</p>
      <input type="number" id="holiday-offset" min="-30" max="30" value="${escapeHTML(h.offset || 0)}">
      <label>Even years parent</label>
      <div class="parent-toggle" id="even-parent-toggle">
        <button class="parent-btn ${(h.evenParent || 'mother') === 'mother' ? 'active' : ''}" data-parent="mother" onclick="ui.selectEvenParent(this)">Mother</button>
        <button class="parent-btn ${(h.evenParent || 'mother') === 'father' ? 'active' : ''}" data-parent="father" onclick="ui.selectEvenParent(this)">Father</button>
      </div>
      <label>Odd years parent</label>
      <div class="parent-toggle" id="odd-parent-toggle">
        <button class="parent-btn ${(h.oddParent || 'mother') === 'mother' ? 'active' : ''}" data-parent="mother" onclick="ui.selectOddParent(this)">Mother</button>
        <button class="parent-btn ${(h.oddParent || 'mother') === 'father' ? 'active' : ''}" data-parent="father" onclick="ui.selectOddParent(this)">Father</button>
      </div>
      <label>Duration (days after start)</label>
      <p class="form-hint">Leave as 0 for single-day holiday. Enter 3 for Thanksgiving (Thu-Sun).</p>
      <input type="number" id="holiday-duration" min="0" max="30" value="${escapeHTML(h.duration || 0)}">
      <label>Start time (optional)</label>
      <p class="form-hint">When the holiday period begins. Leave empty for all-day.</p>
      <input type="time" id="holiday-start-time" value="${escapeHTML(h.startTime || '')}">
      <label>End time (optional)</label>
      <p class="form-hint">When the holiday period ends. Leave empty for all-day.</p>
      <input type="time" id="holiday-end-time" value="${escapeHTML(h.endTime || '')}">
    `;

    document.getElementById('holiday-type').addEventListener('change', event => {
      this.renderHolidayParams({ type: event.target.value, params: {} });
    });
    this.renderHolidayParams(h);
    modal.classList.remove('hidden');
  },

  renderHolidayParams(h) {
    const container = document.getElementById('holiday-params');
    const type = h.type || 'fixed';
    const p = h.params || {};

    if (type === 'fixed') {
      container.innerHTML = `
        <label>Month</label>
        <select id="hp-month">
          ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${p.month === m ? 'selected' : ''}>${MONTH_NAMES[m-1]}</option>`).join('')}
        </select>
        <label>Day</label>
        <input type="number" id="hp-day" min="1" max="31" value="${escapeHTML(p.day || 1)}">
      `;
    } else if (type === 'nth-weekday') {
      container.innerHTML = `
        <label>Month</label>
        <select id="hp-month">
          ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${p.month === m ? 'selected' : ''}>${MONTH_NAMES[m-1]}</option>`).join('')}
        </select>
        <label>Weekday</label>
        <select id="hp-weekday">
          ${DAY_NAMES.map((d,i) => `<option value="${d}" ${p.weekday === d ? 'selected' : ''}>${d.charAt(0).toUpperCase() + d.slice(1)}</option>`).join('')}
        </select>
        <label>Occurrence</label>
        <select id="hp-n">
          <option value="1" ${p.n === 1 ? 'selected' : ''}>1st</option>
          <option value="2" ${p.n === 2 ? 'selected' : ''}>2nd</option>
          <option value="3" ${p.n === 3 ? 'selected' : ''}>3rd</option>
          <option value="4" ${p.n === 4 ? 'selected' : ''}>4th</option>
          <option value="-1" ${p.n === -1 ? 'selected' : ''}>Last</option>
        </select>
      `;
    } else if (type === 'last-weekday') {
      container.innerHTML = `
        <label>Month</label>
        <select id="hp-month">
          ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${p.month === m ? 'selected' : ''}>${MONTH_NAMES[m-1]}</option>`).join('')}
        </select>
        <label>Weekday</label>
        <select id="hp-weekday">
          ${DAY_NAMES.map((d,i) => `<option value="${d}" ${p.weekday === d ? 'selected' : ''}>${d.charAt(0).toUpperCase() + d.slice(1)}</option>`).join('')}
        </select>
      `;
    } else if (type === 'easter-based') {
      container.innerHTML = `
        <label>Offset from Easter (days)</label>
        <input type="number" id="hp-offset" value="${escapeHTML(p.offset || 0)}" placeholder="0 = Easter Sunday, -1 = Good Friday">
      `;
    }
  },

  selectModalParent(btn) {
    btn.parentElement.querySelectorAll('.parent-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  },

  selectEvenParent(btn) {
    document.getElementById('even-parent-toggle').querySelectorAll('.parent-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  },

  selectOddParent(btn) {
    document.getElementById('odd-parent-toggle').querySelectorAll('.parent-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  },

  selectWizardParent(btn) {
    btn.parentElement.querySelectorAll('.parent-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ui._wizardData.startingParent = btn.dataset.parent;
  },

  applyPreset(presetId) {
    if (!presetId) return;
    const presets = getHolidayPresets().filter(p => !p.name.includes('Birthday'));
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    // Fill in fields except duration and times
    document.getElementById('holiday-name').value = preset.name || '';
    document.getElementById('holiday-type').value = preset.type || 'fixed';

    // Set offset if present
    const offsetInput = document.getElementById('holiday-offset');
    if (offsetInput) offsetInput.value = preset.offset || 0;

    // Update parent toggles
    const evenBtn = document.querySelector(`#even-parent-toggle .parent-btn[data-parent="${preset.evenParent || 'mother'}"]`);
    const oddBtn = document.querySelector(`#odd-parent-toggle .parent-btn[data-parent="${preset.oddParent || 'mother'}"]`);
    if (evenBtn) {
      evenBtn.parentElement.querySelectorAll('.parent-btn').forEach(b => b.classList.remove('active'));
      evenBtn.classList.add('active');
    }
    if (oddBtn) {
      oddBtn.parentElement.querySelectorAll('.parent-btn').forEach(b => b.classList.remove('active'));
      oddBtn.classList.add('active');
    }

    // Re-render params with preset values
    this.renderHolidayParams(preset);
  },

  async saveModal() {
    const child = getChild();
    if (!child) return;

    if (this._editingHoliday !== null || this._editingHoliday === null && document.getElementById('holiday-name')) {
      // Saving a holiday
      const name = document.getElementById('holiday-name')?.value.trim();
      if (!name) { alert('Please enter a holiday name'); return; }

      const type = document.getElementById('holiday-type')?.value || 'fixed';
      const params = {};
      if (type === 'fixed') {
        params.month = parseInt(document.getElementById('hp-month')?.value);
        params.day = parseInt(document.getElementById('hp-day')?.value);
      } else if (type === 'nth-weekday' || type === 'last-weekday') {
        params.month = parseInt(document.getElementById('hp-month')?.value);
        params.weekday = document.getElementById('hp-weekday')?.value;
        params.n = parseInt(document.getElementById('hp-n')?.value) || -1;
      } else if (type === 'easter-based') {
        params.offset = parseInt(document.getElementById('hp-offset')?.value) || 0;
      }

      const evenParentBtn = document.querySelector('#even-parent-toggle .parent-btn.active');
      const oddParentBtn = document.querySelector('#odd-parent-toggle .parent-btn.active');
      const evenParent = evenParentBtn?.dataset.parent || 'mother';
      const oddParent = oddParentBtn?.dataset.parent || 'mother';
      const offset = parseInt(document.getElementById('holiday-offset')?.value) || 0;
      const duration = parseInt(document.getElementById('holiday-duration')?.value) || 0;
      const startTime = document.getElementById('holiday-start-time')?.value || '';
      const endTime = document.getElementById('holiday-end-time')?.value || '';

      if ((duration === 0 && endTime && parseTime(endTime) <= parseTime(startTime)) ||
          duration < 0 || duration > 30 || Math.abs(offset) > 30 ||
          !calculateHolidayDate({ type, params }, 2028)) {
        alert('Enter a valid holiday date, offset and time range.');
        return;
      }
      const holiday = { name, type, params, evenParent, oddParent, offset, duration, startTime, endTime };

      if (!child.holidays) child.holidays = [];
      if (this._editingHoliday !== null) {
        child.holidays[this._editingHoliday] = holiday;
      } else {
        child.holidays.push(holiday);
      }

      await saveChild(child);
      // Refresh in-memory children from DB
      window._children = window._children.map(c => c.id === child.id ? child : c);
      this._editingHoliday = null;
      // Clear preset dropdown
      const presetSelect = document.getElementById('holiday-preset');
      if (presetSelect) presetSelect.value = '';
    } else if (this._editingOverride !== null || this._editingOverride === null && document.getElementById('override-name')) {
      // Saving an override
      const name = document.getElementById('override-name')?.value.trim();
      if (!name) { alert('Please enter a description'); return; }

      const activeParentBtn = document.querySelector('#modal-body .parent-btn.active');
      const parent = activeParentBtn?.dataset.parent || 'mother';
      const date = document.getElementById('override-date')?.value;
      const endDate = document.getElementById('override-end-date')?.value || '';
      const time = document.getElementById('override-time')?.value || '';

      if (!date || (endDate && endDate < date)) {
        alert('Choose a start date and an end date on or after it.');
        return;
      }
      const override = { name, parent, date, endDate, time };

      if (!child.overrides) child.overrides = [];
      if (this._editingOverride !== null) {
        child.overrides[this._editingOverride] = override;
      } else {
        child.overrides.push(override);
      }

      await saveChild(child);
      window._children = window._children.map(c => c.id === child.id ? child : c);
      this._editingOverride = null;
    }

    this.hideModal();
    renderCalendar();
    this.renderSettingsHolidays();
    this.renderSettingsOverrides();
  },

  deleteModal() {
    const child = getChild();
    if (!child) return;

    if (this._editingHoliday !== null) {
      child.holidays.splice(this._editingHoliday, 1);
      this._editingHoliday = null;
    } else if (this._editingOverride !== null) {
      child.overrides.splice(this._editingOverride, 1);
      this._editingOverride = null;
    }

    saveChild(child).then(() => {
      this.hideModal();
      renderCalendar();
      this.renderSettingsHolidays();
      this.renderSettingsOverrides();
    });
  },

  hideModal() {
    document.getElementById('event-modal').classList.add('hidden');
    this._editingHoliday = null;
    this._editingOverride = null;
  },

  editOverride(overrideIndex) {
    const child = getChild();
    if (!child) return;

    this._editingOverride = overrideIndex !== undefined ? overrideIndex : null;
    document.getElementById('modal-title').textContent = this._editingOverride !== null ? 'Edit Override' : 'Add One-Time Change';
    document.getElementById('modal-delete').classList.toggle('hidden', this._editingOverride === null);

    const o = this._editingOverride !== null ? child.overrides[this._editingOverride] : { name: '', parent: 'mother', date: '', time: '' };
    const body = document.getElementById('modal-body');
    body.innerHTML = `
      <label>Description</label>
      <input type="text" id="override-name" value="${escapeHTML(o.name || '')}" placeholder="e.g., Camping trip with Mom">
      <label>Date(s)</label>
      <input type="date" id="override-date" value="${escapeHTML(o.date || o.startDate || '')}">
      <label>End date (optional, leave blank for single day)</label>
      <input type="date" id="override-end-date" value="${escapeHTML(o.endDate || '')}">
      <label>Time (optional)</label>
      <input type="time" id="override-time" value="${escapeHTML(o.time || '')}">
      <label>Assigned parent</label>
      <div class="parent-toggle">
        <button class="parent-btn ${o.parent === 'mother' ? 'active' : ''}" data-parent="mother" onclick="ui.selectModalParent(this)">Mother</button>
        <button class="parent-btn ${o.parent === 'father' ? 'active' : ''}" data-parent="father" onclick="ui.selectModalParent(this)">Father</button>
      </div>
    `;

    // Don't re-attach handlers — they're already set up in init()
    document.getElementById('event-modal').classList.remove('hidden');
  },

  async deleteHoliday(index) {
    const child = getChild();
    if (!child || !child.holidays) return;
    if (!confirm(`Delete "${child.holidays[index].name}"?`)) return;
    child.holidays.splice(index, 1);
    await saveChild(child);
    this.renderSettingsHolidays();
    renderCalendar();
  },

  // ===== Appearance Settings =====
  async renderSettingsAppearance() {
    const colors = await getConfig('colors').catch(() => null) || getDefaultColors();
    window._colors = colors;
    document.getElementById('setting-mother-color').value = colors.mother;
    document.getElementById('setting-father-color').value = colors.father;
  },

  async saveAppearance() {
    if (!window._colors) window._colors = {};
    var motherColor = document.getElementById('setting-mother-color').value;
    var fatherColor = document.getElementById('setting-father-color').value;
    window._colors.mother = motherColor;
    window._colors.father = fatherColor;

    try {
      await setConfig('colors', window._colors);
    } catch (e) {
      console.error('[saveAppearance] setConfig error:', e);
      alert('Failed to save colors: ' + e.message);
      return;
    }

    // Update CSS custom properties
    document.documentElement.style.setProperty('--mother-color', motherColor);
    document.documentElement.style.setProperty('--father-color', fatherColor);

    updateLegend();
    renderCalendar();
  },

  // ===== Overrides Settings =====
  async renderSettingsOverrides() {
    const child = getChild();
    if (!child) return;
    const container = document.getElementById('overrides-list');
    if (!container) return;

    let html = '';
    for (let i = 0; i < (child.overrides || []).length; i++) {
      const o = child.overrides[i];
      html += `<div class="override-list-item"><span>${escapeHTML(o.name || 'Schedule change')} (${escapeHTML(o.date || '')})</span><div class="override-actions"><button onclick="ui.editOverride(${i})" aria-label="Edit" title="Edit">✎</button><button onclick="ui.deleteOverride(${i})" aria-label="Delete" title="Delete">×</button></div></div>`;
    }
    container.innerHTML = html || '<p style="font-size:0.85rem;color:var(--text-muted);">No one-time changes.</p>';
  },

  async deleteOverride(index) {
    const child = getChild();
    if (!child || !child.overrides) return;
    if (!confirm('Delete this one-time change?')) return;
    child.overrides.splice(index, 1);
    await saveChild(child);
    this.renderSettingsOverrides();
    renderCalendar();
  },

  // ===== Export / Import =====
  showIOModal(mode, file = null) {
    this._backupFile = file;
    const modal = document.getElementById('io-modal');
    const title = document.getElementById('io-title');
    const body = document.getElementById('io-body');

    if (mode === 'export') {
      title.textContent = 'Export Data';
      const children = window._children || [];
      let html = '<div class="io-option"><h4>What to export:</h4>';
      for (const child of children) {
        html += `<label><input type="checkbox" class="export-child-check" value="${escapeHTML(child.id)}" checked> ${escapeHTML(child.name)}</label>`;
      }
      html += '</div>';
      html += '<div class="io-option"><h4>Include:</h4>';
      html += '<label><input type="checkbox" id="export-colors" checked> Colors &amp; appearance</label>';
      html += '</div>';
      html += '<p>The PNG contains private schedule data beyond what is visible in the image.</p>';
      html += '<button class="btn btn-primary" onclick="ui.doExport()">Download PNG backup</button>';
      body.innerHTML = html;
    } else {
      title.textContent = 'Import Data';
      let html = '<div class="io-option"><h4>Select what to import:</h4>';
      html += '<label><input type="checkbox" id="import-children" checked> Children &amp; schedules</label>';
      html += '<label><input type="checkbox" id="import-colors"> Colors &amp; appearance</label>';
      html += '</div>';
      html += '<div class="io-option"><h4>Merge or replace:</h4>';
      html += '<label><input type="radio" name="import-strategy" value="merge" checked> Merge (add new children, keep existing)</label>';
      html += '<label><input type="radio" name="import-strategy" value="replace"> Replace all</label>';
      html += '</div>';
      html += '<p style="font-size:0.85rem;color:var(--text-muted);margin:12px 0;">Choose a JSON or PNG backup to import:</p>';
      html += '<p id="io-backup-name"></p>';
      html += '<input type="file" id="io-file-input" accept=".json,.png,image/png" style="margin-bottom:12px;">';
      html += '<button class="btn btn-primary" onclick="ui.doImport()">Import</button>';
      body.innerHTML = html;

      if (file) document.getElementById('io-backup-name').textContent = file.name;
    }

    modal.classList.remove('hidden');
  },

  hideIOModal() {
    document.getElementById('io-modal').classList.add('hidden');
  },

  generateExportImage(data) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#4F46E5');
    gradient.addColorStop(1, '#7C3AED');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(60, 100, 392, 312, 16);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.roundRect(60, 100, 392, 50, [16, 16, 0, 0]);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    days.forEach((day, i) => {
      ctx.fillText(day, 96 + i * 56, 132);
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 7; col++) {
        ctx.beginPath();
        ctx.roundRect(64 + col * 56, 160 + row * 52, 52, 48, 8);
        ctx.fill();
      }
    }

    const motherColor = data.colors?.mother || '#FCA5A5';
    ctx.fillStyle = motherColor;
    ctx.beginPath();
    ctx.arc(100, 460, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Mother', 130, 466);

    const fatherColor = data.colors?.father || '#93C5FD';
    ctx.fillStyle = fatherColor;
    ctx.beginPath();
    ctx.arc(260, 460, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('Father', 290, 466);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Custody Calendar', 256, 70);

    const childCount = data.children?.length || 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`${childCount} child${childCount !== 1 ? 'ren' : ''} exported`, 256, 490);

    return canvas;
  },

  generateExportSvg(data) {
    const motherColor = data.colors?.mother || '#FCA5A5';
    const fatherColor = data.colors?.father || '#93C5FD';
    const childCount = data.children?.length || 0;

    // Embed JSON as metadata
    const jsonStr = JSON.stringify(data);
    const jsonEscaped = jsonStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#7C3AED"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" fill="url(#bg)"/>

  <!-- Calendar grid background -->
  <rect x="60" y="100" width="392" height="312" rx="16" fill="rgba(255,255,255,0.1)"/>

  <!-- Calendar header -->
  <rect x="60" y="100" width="392" height="50" rx="16" fill="rgba(255,255,255,0.2)"/>
  <rect x="60" y="130" width="392" height="20" fill="rgba(255,255,255,0.2)"/>

  <!-- Day headers -->
  ${['S','M','T','W','T','F','S'].map((d,i) => `<text x="${96 + i * 56}" y="132" fill="rgba(255,255,255,0.9)" font-size="18" font-weight="bold" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${d}</text>`).join('\n  ')}

  <!-- Calendar cells -->
  ${Array.from({length: 5}, (_, row) => Array.from({length: 7}, (_, col) => `<rect x="${64 + col * 56}" y="${160 + row * 52}" width="52" height="48" rx="8" fill="rgba(255,255,255,0.15)"/>`).join('\n  ')).join('\n  ')}

  <!-- Mother color dot -->
  <circle cx="100" cy="460" r="20" fill="${motherColor}"/>
  <text x="130" y="466" fill="rgba(255,255,255,0.9)" font-size="16" font-family="-apple-system,BlinkMacSystemFont,sans-serif">Mother</text>

  <!-- Father color dot -->
  <circle cx="260" cy="460" r="20" fill="${fatherColor}"/>
  <text x="290" y="466" fill="rgba(255,255,255,0.9)" font-size="16" font-family="-apple-system,BlinkMacSystemFont,sans-serif">Father</text>

  <!-- Title -->
  <text x="256" y="70" fill="white" font-size="28" font-weight="bold" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif">Custody Calendar</text>

  <!-- Child count -->
  <text x="256" y="490" fill="rgba(255,255,255,0.7)" font-size="16" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${childCount} child${childCount !== 1 ? 'ren' : ''} exported</text>

  <!-- Embedded JSON data -->
  <metadata>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description rdf:about="">
        <custody-calendar-export xmlns:c="https://custody-calendar.app">${jsonEscaped}</custody-calendar-export>
      </rdf:Description>
    </rdf:RDF>
  </metadata>
</svg>`;
  },

  async doExport() {
    const children = window._children || [];
    const exportChildren = [];
    const checks = document.querySelectorAll('.export-child-check:checked');
    for (const check of checks) {
      const child = children.find(c => c.id === check.value);
      if (child) exportChildren.push(child);
    }

    const ids = new Set(exportChildren.map(child => child.id));
    const fullExport = ids.size === children.length;
    const daysOff = exportChildren.length ? window.daysOff.filter(entry => !entry.deleted).flatMap(({ legacyKey, ...entry }) => {
      const childIds = entry.childIds === null && fullExport ? null :
        (entry.childIds || [...ids]).filter(id => ids.has(id));
      return childIds?.length === 0 ? [] : [{ ...entry, childIds }];
    }) : [];
    const data = { schemaVersion: 1, children: exportChildren.map(child => ({
      ...child, daysOff: daysOffForChild(child).filter(entry => entry.childIds === undefined)
    })), daysOff };
    if (document.getElementById('export-colors')?.checked) {
      data.colors = window._colors;
    }

    try {
      const canvas = this.generateExportImage(data);
      const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const pngBuffer = await pngBlob.arrayBuffer();
      const jsonStr = JSON.stringify(data);

      // Embed JSON into PNG metadata
      const pngWithMetadata = MetaPNG.addMetadata(new Uint8Array(pngBuffer), 'custody-calendar-export', jsonStr);
      const finalBlob = new Blob([pngWithMetadata], { type: 'image/png' });

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `custody-calendar-export-${localDateKey(new Date())}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
      // Fallback: JSON only
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `custody-calendar-export-${localDateKey(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  },

  async doImport() {
    const input = document.getElementById('io-file-input');
    const file = input.files[0] || this._backupFile;
    if (this._importing) return;
    if (!file) { alert('Choose a backup file first.'); return; }
    const replace = document.querySelector('input[name="import-strategy"]:checked')?.value === 'replace';
    const includeChildren = document.getElementById('import-children').checked;
    const includeColors = document.getElementById('import-colors').checked;
    if (replace && includeChildren && !confirm('Replace all saved children and schedules with this backup?')) return;
    this._importing = true;
    try {
      await importData(await readBackup(file), { replace, includeChildren, includeColors });
      this.hideIOModal();
      this.finishBackupImport();
    } catch (error) {
      alert('Could not import backup. ' + error.message);
    } finally {
      this._importing = false;
    }
  },

  finishBackupImport() {
    const wizard = document.getElementById('setup-wizard');
    if (!window._children.length) {
      localStorage.removeItem('custody-calendar-setup');
      showSetupWizard();
    } else if (!wizard.classList.contains('hidden')) {
      localStorage.setItem('custody-calendar-setup', '1');
      wizard.style.display = '';
      wizard.classList.add('hidden');
    }
    this.renderChildTabs();
    renderCalendar();
    updateLegend();
  },

  handleImport(event) {
    if (event.target.files[0]) this.showIOModal('import', event.target.files[0]);
  },

  handleDayClick(dateStr) {
    // Could open a quick-add modal for overrides — leaving as a future enhancement
    const date = new Date(dateStr + 'T00:00:00');
    _currentDate = date;
    setView('day');
    document.querySelector('.day-view-header button')?.focus();
  },

  // ===== Install Prompt =====
  setupInstallPrompt() {
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const banner = document.getElementById('install-banner');
      if (!banner.classList.contains('hidden')) return;
      banner.classList.remove('hidden');
    });

    document.getElementById('install-btn')?.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      document.getElementById('install-banner').classList.add('hidden');
    });

    document.getElementById('install-dismiss')?.addEventListener('click', () => {
      document.getElementById('install-banner').classList.add('hidden');
    });

    // Hide banner if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      document.getElementById('install-banner').classList.add('hidden');
    }
  },

  showBrowserNotice() {
    const shown = localStorage.getItem('custody-calendar-browser-notice');
    if (shown) return;
    // Show during setup or first visit
    setTimeout(() => {
      document.getElementById('browser-notice').classList.remove('hidden');
    }, 2000);
  },

  dismissBrowserNotice() {
    localStorage.setItem('custody-calendar-browser-notice', '1');
    document.getElementById('browser-notice').classList.add('hidden');
  }
};

window.ui = ui;
