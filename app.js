import { SERVICES, STAY, STARTS, newDraft, updateDraft, total, validate, availability, endTime, isStayDate, isAvailableDate, isSlotAvailable, stayDates } from './model.js';

const $ = s => document.querySelector(s);
const content = $('#app-content'), header = $('#app-header'), footer = $('#app-footer'), dialog = $('#picker');
const money = n => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) + ' RUB';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dateText = v => v ? new Date(v + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(' г.', '') : '';
const icons = {
  back: '<path d="m20 12H4m7-7-7 7 7 7"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>', chevron: '<path d="m8 10 4 4 4-4"/>', next: '<path d="m9 6 6 6-6 6"/>', calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 11h16"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', check: '<path d="m5 12 4 4L19 6"/>', bed: '<path d="M3 18v-7h18v7M3 15h18M5 11V6h14v5M8 8h3M14 8h3"/>', service: '<path d="M3 17h18M5 17a7 7 0 0 1 14 0M12 6v3M10 6h4"/>', trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>', edit: '<path d="m4 16-1 5 5-1L20 8l-4-4L4 16Z"/>', meal: '<path d="M5 3v6c0 3 5 3 5 0V3M7.5 3v18M19 3c-5 3-5 9 0 9v9M19 3v9"/>', car: '<path d="m4 11 2-6h12l2 6M3 11h18v7H3zM6 18v3M18 18v3M6 14h2M16 14h2"/>', left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.2"/>', reset: '<path d="M4 8a8 8 0 1 1 0 8M4 3v5h5"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.service}</svg>`;
const primary = (label, action, disabled = false) => `<button class="primary" data-action="${action}" ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;
const secondary = (label, action) => `<button class="secondary" data-action="${action}">${esc(label)}</button>`;
const initial = () => [{ id: 'breakfast', title: 'Завтрак (Взрослый)', price: 3000, description: '2 шт · за гостя в сутки', icon: 'meal' }, { id: 'parking', title: 'Парковка', price: 500, description: '1 шт · за использование', icon: 'car' }];
const storageKey = 'tl-hourly-prototype-v1';
let saved = initial(), restoredWarning = false;
try {
  const data = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(data)) {
    const accepted = [];
    for (const item of data) {
      if (item && typeof item.title === 'string' && Number.isFinite(item.price) && (!item.draft || !Object.keys(validate(item.draft, accepted)).length)) accepted.push(item);
      else restoredWarning = true;
    }
    saved = accepted;
  }
} catch { /* Browser storage is optional. */ }
let items = structuredClone(saved), view = 'list', draft = newDraft(), errors = {}, editingId = null, detailId = null, savedBanner = false, scenario = 'steam';
let modal = null, toastTimer;
const scenarios = [
  ['steam', 'Основной сценарий', '26 марта: 10:00 — один ресурс, 11:00 — несколько, 12:00 — занято. 27 марта свободных слотов нет. В день выезда 28 марта можно выбрать время после 12:00, в том числе 17:00.'],
  ['steam-extended', 'С продлением', '45 минут — 1 500 RUB. При выборе окончания до 12:00 доплата составит 500 RUB.'],
  ['pool', 'Возрастные тарифы', 'Выбор возраста определяет цену: взрослый — 1 500 RUB, ребёнок 2–10 лет — 750 RUB.'],
  ['bikes', 'Инвентарь', 'Можно выбрать несколько велосипедов. Цена — 500 RUB за одного гостя; количество гостей задаётся отдельно.'],
  ['gazebo', 'Дополнительные гости', 'Беседка включает 4 гостей за 5 000 RUB. Каждый дополнительный гость — ещё 500 RUB.'],
];
function reservations() { return items.filter(item => item.id !== editingId); }
function dirty() { return JSON.stringify(items) !== JSON.stringify(saved); }
function bookingTotal() { return items.reduce((sum, s) => sum + s.price, 0); }
function notify(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3200); }
function renderScenarios() {
  $('#scenarios').innerHTML = scenarios.map(([id, title]) => `<button class="scenario ${id === scenario ? 'active' : ''}" data-scenario="${id}" aria-pressed="${id === scenario}">${title}</button>`).join('');
  $('#case-note').textContent = scenarios.find(s => s[0] === scenario)?.[2] || '';
}
function appHeader(title, action = 'back') { header.innerHTML = `<button class="icon-button" aria-label="Назад" data-action="${action}">${icon('back')}</button><h2>${esc(title)}</h2>`; }
function renderFooter() {
  if (view === 'form') footer.innerHTML = `<div class="total-row"><span>Стоимость</span><strong id="draft-total">${money(total(draft, reservations()))}</strong></div>${primary(editingId ? 'Сохранить изменения' : 'Добавить услугу', 'submit', !!draft.start && !isSlotAvailable(draft, reservations()))}`;
  else if (view === 'list') footer.innerHTML = `${dirty() ? '<p class="dirty-note">Примените изменения к бронированию</p>' : ''}<div class="total-row"><span>Сумма за услуги</span><strong>${money(bookingTotal())}</strong></div>${primary('Применить', 'apply')}`;
  else if (view === 'detail') { const item = items.find(i => i.id === detailId); footer.innerHTML = `<div class="total-row"><span>Стоимость</span><strong>${money(item?.price || 0)}</strong></div>${primary('Готово', 'list')}`; }
  else footer.innerHTML = primary('Услуги в номере', 'list');
}
function field(key, label, value, opts = {}) {
  const error = errors[key], helpId = `help-${key}`, inputId = `field-${key}`;
  const cls = `field ${opts.read ? 'readonly' : ''} ${!value && value !== 0 ? 'empty' : ''} ${opts.disabled ? 'disabled' : ''}`;
  let inner = `<span class="field-label">${esc(label)}</span>`;
  const aria = `aria-label="${esc(label)}" ${error ? 'aria-invalid="true"' : ''} ${error || opts.help ? `aria-describedby="${helpId}"` : ''}`;
  if (opts.input) {
    inner += opts.textarea ? `<textarea id="${inputId}" data-input="${key}" ${aria} maxlength="500" rows="2">${esc(value)}</textarea>` : `<input id="${inputId}" data-input="${key}" ${aria} type="number" inputmode="decimal" min="${opts.min ?? 0}" max="${opts.max ?? 1000000}" step="${key === 'price' ? '.01' : '1'}" value="${esc(value)}">`;
  } else inner += `<span class="field-value">${esc(value || opts.empty || 'Не выбрано')}</span>${opts.read ? '' : `<span class="field-icon">${icon(opts.icon || 'chevron')}</span>`}`;
  const control = opts.input ? `<label class="${cls}" for="${inputId}">${inner}</label>` : opts.read ? `<div class="${cls}" ${aria}>${inner}</div>` : `<button type="button" class="${cls}" data-picker="${key}" ${aria} ${opts.disabled ? 'disabled' : ''}>${inner}</button>`;
  return `<div class="field-wrap ${error ? 'field-error' : ''}" data-field="${key}">${control}${error || opts.help ? `<p class="helper" id="${helpId}" ${error ? 'role="alert"' : ''}>${esc(error || opts.help)}</p>` : ''}</div>`;
}
const title = s => `<h3 class="section-title">${s}</h3>`;
function renderForm() {
  appHeader(editingId ? 'Изменение услуги' : 'Добавление услуги', 'cancel-form');
  const s = SERVICES[draft.service], a = availability(draft, reservations()), scheduled = Boolean(draft.start), freeSlot = isSlotAvailable(draft, reservations());
  let html = field('group', 'Группа услуг', draft.group, { empty: 'Не выбрана' }) + field('service', 'Услуга', s?.title, { disabled: !draft.group, empty: 'Не выбрана' });
  if (s) {
    html += field('tempo', 'Темп начисления', 'За использование', { read: true }) + title('Дата и время');
    html += field('date', 'Дата оказания услуги', dateText(draft.date), { icon: 'calendar', empty: 'Не выбрана', help: '26–28 марта включительно. В день выезда услуга доступна и после 12:00.' });
    html += `<div class="input-row">${field('start', 'Начало', draft.start, { icon: 'clock', disabled: !draft.date })}${field('extension', 'Окончание', endTime(draft) || '—', { read: !s.extend || !scheduled })}</div>`;
    html += `<p class="helper">${s.extend ? 'Базовая длительность' : 'Длительность'}: ${s.duration} ${s.duration === 60 ? 'минут' : 'минут'}${draft.extension ? ` · продление +${draft.extension} минут` : ''}</p>`;
    if (scheduled && freeSlot) {
      if (s.staff || s.place || s.inventory || s.age) html += title('Ресурсы и параметры');
      if (s.age) html += field('age', 'Возраст', draft.age === 'adult' ? 'Взрослый' : draft.age === 'child' ? 'Ребёнок (2–10 лет)' : '', { empty: 'Не выбран' });
      if (s.staff) html += field('staff', 'Сотрудник', draft.staff, { read: a.staff.length <= 1, empty: 'Не выбран', help: a.staff.length === 1 ? 'Единственный свободный сотрудник выбран автоматически' : `Свободных сотрудников: ${a.staff.length}` });
      if (s.place) html += field('place', 'Место', draft.place, { read: a.places.length <= 1, help: a.places.length === 1 ? 'Единственное свободное место выбрано автоматически' : `Свободных мест: ${a.places.length}` });
      if (s.inventory) html += field('inventory', 'Инвентарь', draft.inventory.join(', '), { read: a.inventory.length <= 1, empty: 'Не выбран', help: a.inventory.length === 1 ? 'Единственный свободный инвентарь выбран автоматически' : `Свободных единиц: ${a.inventory.length}. Можно выбрать несколько` });
      html += title('Количество и цена');
      html += field('guests', 'Кол-во гостей', draft.guests, { input: !s.baseGuests, read: !!s.baseGuests, min: 1, max: 100, help: s.baseGuests ? 'Базовое количество гостей' : '' });
      html += field('price', 'Цена (RUB)', draft.price, { input: !s.age && !s.inventory && !s.baseGuests, read: !!(s.age || s.inventory || s.baseGuests), help: s.baseGuests ? 'Стоимость за базовое количество гостей' : s.inventory ? 'Стоимость за одного гостя' : '' });
      if (s.baseGuests) {
        if (draft.extraEnabled) html += field('extra', 'Количество доп. гостей', draft.extra, { input: true, min: 1, max: 10, help: 'Не более 10 дополнительных гостей' }) + field('extraPrice', 'Цена за 1 доп. гостя (RUB)', s.extraPrice, { read: true }) + field('extraTotal', 'Итого за доп. гостей (RUB)', Math.max(0, Number(draft.extra) || 0) * s.extraPrice, { read: true }) + secondary('Убрать доп. гостей', 'remove-extra');
        else html += secondary('Добавить гостей', 'add-extra');
      }
      html += title('Детали начисления') + field('account', 'Счёт', draft.account ? '01 · «101» Комфорт' : '', { help: 'Иванов Иван Иванович' }) + field('comment', 'Комментарий', draft.comment, { input: true, textarea: true, help: 'Комментарий к услуге, до 500 символов' });
    } else html += `<p class="helper ${scheduled ? 'availability-error' : ''}">${scheduled ? 'На выбранный интервал нет свободных ресурсов. Выберите другое время.' : 'После выбора свободного времени появятся доступные ресурсы и параметры услуги.'}</p>`;
  } else html += '<p class="helper">Выберите группу и услугу, чтобы указать дату и время.</p>';
  content.innerHTML = `<form id="service-form" class="form-body" novalidate>${html}<button type="button" class="secondary" data-action="cancel-form">Отменить</button></form>`;
}
function renderList() {
  appHeader('Услуги в номере', 'booking');
  content.innerHTML = `${savedBanner ? `<div class="saved-banner">${icon('check')}Изменения применены к бронированию</div>` : ''}<div class="booking-info"><h3>«101» Комфорт</h3><p>Бронь № 4136985 · Иванов Иван Иванович</p><p>26–28 марта 2026 · 2 гостя</p></div><div class="service-list"><div class="list-title"><h3>Дополнительные услуги</h3><span>${items.length} шт.</span></div>${items.map(item => `<button class="service-card" data-detail="${esc(item.id)}"><span class="service-symbol">${icon(item.icon || 'clock')}</span><span class="service-info"><h4>${esc(item.title)}</h4><p>${esc(item.draft ? `${dateText(item.draft.date)} · ${item.draft.start}–${endTime(item.draft)}` : item.description)}</p>${item.draft ? `<p>${item.draft.guests}${SERVICES[item.draft.service].baseGuests && item.draft.extraEnabled ? ` + ${item.draft.extra}` : ''} гост. · ${esc(item.draft.place || item.draft.staff || item.draft.inventory.join(', '))}</p>` : ''}</span><span class="service-price">${money(item.price)}</span></button>`).join('')}<div class="list-add"><button class="text-button" data-action="choose-type">${icon('plus')}Добавить ещё услугу</button></div></div>`;
}
function renderDetail() {
  const item = items.find(i => i.id === detailId); if (!item) { view = 'list'; render(); return; }
  appHeader('Детали услуги', 'list'); const d = item.draft, s = d ? SERVICES[d.service] : null;
  const pair = (a, b) => `<div class="detail-pair"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`;
  content.innerHTML = `<div class="detail-body"><div class="detail-head"><h3>${esc(item.title)}</h3><p>${esc(d ? `${dateText(d.date)} · ${d.start}–${endTime(d)}` : item.description)}</p></div>${d ? `${pair('Темп начисления', 'За использование')}${pair('Длительность', `${s.duration + (s.extend ? d.extension : 0)} минут`)}${d.staff ? pair('Сотрудник', d.staff) : ''}${d.place ? pair('Место', d.place) : ''}${d.inventory.length ? pair('Инвентарь', d.inventory.join('\n')) : ''}${d.age ? pair('Возраст', d.age === 'adult' ? 'Взрослый' : 'Ребёнок (2–10 лет)') : ''}${pair('Количество гостей', `${d.guests}${s.baseGuests && d.extraEnabled ? ` + ${d.extra} доп.` : ''}`)}${pair('Цена', money(d.price))}${d.extension ? pair('Продление', `+${d.extension} мин · ${money(d.extension / 15 * 500)}`) : ''}${s.baseGuests && d.extraEnabled ? pair('Дополнительные гости', `${d.extra} × ${money(s.extraPrice)}`) : ''}${pair('Счёт', '01 · «101» Комфорт')}${d.comment ? pair('Комментарий', d.comment) : ''}${secondary('Изменить услугу', 'edit')}` : ''}<button class="danger-button" data-action="delete">${icon('trash')}Удалить услугу</button></div>`;
}
function renderBooking() {
  appHeader('Детали бронирования', 'list');
  content.innerHTML = `<div class="detail-body"><div class="detail-head"><h3>Иванов Иван Иванович</h3><p>Бронь № 4136985</p></div><div class="detail-notice">«101» Комфорт · 26–28 марта 2026<br>2 гостя · 2 ночи</div><h3 class="section-title">Услуги</h3><button class="service-card" data-action="list"><span class="service-symbol">${icon('service')}</span><span class="service-info"><h4>Услуги в номере</h4><p>${items.length} шт. · ${money(bookingTotal())}</p></span>${icon('next')}</button>${dirty() ? '<p class="helper">В списке услуг есть неприменённые изменения.</p>' : ''}</div>`;
}
function render(keepScroll = false) {
  const top = content.scrollTop;
  if (view === 'form') renderForm(); else if (view === 'detail') renderDetail(); else if (view === 'booking') renderBooking(); else renderList();
  renderFooter(); content.scrollTop = keepScroll ? top : 0; renderScenarios();
}
function change(key, value) {
  const before = [draft.staff, draft.place, ...draft.inventory].filter(Boolean).join('|');
  draft = updateDraft(draft, key, value, reservations()); delete errors[key];
  if (Object.keys(errors).length) errors = validate(draft, reservations());
  render(true);
  if (key === 'extension' && before && before !== [draft.staff, draft.place, ...draft.inventory].filter(Boolean).join('|')) notify('Доступные ресурсы обновлены для нового интервала');
}

function positionSheet() {
  const r = $('#phone').getBoundingClientRect();
  Object.assign(dialog.style, { left: `${r.left}px`, bottom: `${Math.max(0, innerHeight - r.bottom + 32)}px`, width: `${r.width}px`, maxWidth: `${r.width}px`, maxHeight: `${Math.min(690, r.height - 96)}px` });
}
function showSheet() {
  const m = modal; if (!m) return;
  let body = '', controls = '';
  if (m.kind === 'calendar') {
    const year = m.month.getFullYear(), month = m.month.getMonth(), count = new Date(year, month + 1, 0).getDate(), offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    body = `<div class="calendar"><div class="month-nav"><button class="icon-button" aria-label="Предыдущий месяц" data-month="-1" ${monthKey <= STAY.arrival.slice(0, 7) ? 'disabled' : ''}>${icon('left')}</button><strong>${m.month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '')}</strong><button class="icon-button" aria-label="Следующий месяц" data-month="1" ${monthKey >= STAY.departure.slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button></div><div class="calendar-grid">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => `<span class="weekday">${d}</span>`).join('')}${'<span></span>'.repeat(offset)}${Array.from({ length: count }, (_, i) => {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, inStay = isStayDate(date), free = isAvailableDate(draft.service, date, reservations());
      const reason = !inStay ? 'вне дат проживания' : !free ? 'нет свободных слотов' : date === STAY.departure ? 'день выезда, доступен весь день' : 'есть свободное время';
      return `<button class="day ${!inStay ? 'outside' : !free ? 'busy' : 'free'} ${m.selected === date ? 'selected' : ''}" data-date="${date}" aria-label="${dateText(date)} — ${reason}" aria-pressed="${m.selected === date}" ${!free ? 'disabled' : ''}>${i + 1}</button>`;
    }).join('')}</div><div class="calendar-legend"><span>Серые — вне проживания</span><span>Зачёркнутые — всё занято</span></div><p class="calendar-caption">Проживание: 26–28 марта включительно.<br>28 марта — день выезда. Можно выбрать время и после 12:00.</p></div>`;
    controls = primary(m.selected ? `Выбрать ${dateText(m.selected)}` : 'Нет свободных дат', 'confirm-date', !isAvailableDate(draft.service, m.selected, reservations()));
  } else if (m.kind === 'confirm') { body = `<p class="confirm-body">${esc(m.text)}</p>`; controls = `<div class="button-row">${secondary('Отменить', 'close-sheet')}${primary(m.label, 'confirm-action')}</div>`; }
  else {
    body = m.options.map(o => { const selected = Array.isArray(m.selected) ? m.selected.includes(o.value) : m.selected === o.value; return `<button class="option ${selected ? 'selected' : ''}" data-option="${esc(o.value)}" ${o.disabled ? 'disabled' : ''} aria-pressed="${selected}"><span class="option-main">${esc(o.label)}${o.description ? `<small>${esc(o.description)}</small>` : ''}</span>${o.side ? `<span class="option-side">${esc(o.side)}</span>` : ''}<span class="radio ${m.multiple ? 'check' : ''}" aria-hidden="true"></span></button>`; }).join('');
    if (m.help) body += `<p class="sheet-help">${esc(m.help)}</p>`;
    if (m.kind === 'type') controls = primary('Добавить', 'confirm-type', m.selected !== 'hourly');
    else if (m.multiple) controls = primary(m.selected.length ? `Выбрать ${m.selected.length}` : 'Выбрать инвентарь', 'confirm-inventory', !m.selected.length);
    else controls = secondary('Отменить', 'close-sheet');
  }
  dialog.innerHTML = `<div class="sheet-handle"></div><div class="sheet-head"><h3 id="sheet-title">${esc(m.title)}</h3><button class="icon-button" aria-label="Закрыть" data-action="close-sheet">${icon('close')}</button></div><div class="sheet-body">${body}</div><div class="sheet-footer">${controls}</div>`;
  positionSheet(); if (!dialog.open) dialog.showModal();
}
function closeSheet() { dialog.close(); modal = null; }
function pick(key) {
  const s = SERVICES[draft.service], a = availability(draft, reservations()); let options = [], selected = draft[key], name = '';
  if (['staff', 'place', 'inventory'].includes(key) && (!isSlotAvailable(draft, reservations()) || a[key === 'place' ? 'places' : key].length <= 1)) return;
  if (key === 'date') { const selected = isAvailableDate(draft.service, draft.date, reservations()) ? draft.date : stayDates().find(date => isAvailableDate(draft.service, date, reservations())) || ''; modal = { kind: 'calendar', title: 'Дата оказания услуги', selected, month: new Date((selected || STAY.arrival).slice(0, 7) + '-01T12:00:00') }; showSheet(); return; }
  if (key === 'group') { name = 'Группа услуг'; options = ['Бани', 'Бассейн', 'Аренда'].map(value => ({ value, label: value })); }
  if (key === 'service') { name = 'Услуга'; options = Object.entries(SERVICES).filter(([, s]) => s.group === draft.group).map(([value, s]) => ({ value, label: s.title, description: `${s.duration} минут${s.extend ? ' · доступно продление' : ''}` })); }
  if (key === 'start') { name = 'Начало оказания'; options = STARTS.map(value => {
    const slot = { ...draft, start: value, extension: 0 }, free = isSlotAvailable(slot, reservations()), resources = availability(slot, reservations());
    const counts = [s.staff ? `Сотрудников: ${resources.staff.length}` : '', s.place ? `Мест: ${resources.places.length}` : '', s.inventory ? `Инвентаря: ${resources.inventory.length}` : ''].filter(Boolean).join(' · ');
    return { value, label: value, disabled: !free, description: free ? counts : 'Нет свободных ресурсов на весь интервал' };
  }); }
  if (key === 'extension') { name = 'Окончание и продление'; options = [0, 15, 30].map(n => ({ value: String(n), label: endTime({ ...draft, extension: n }), disabled: !isSlotAvailable({ ...draft, extension: n }, reservations()), description: isSlotAvailable({ ...draft, extension: n }, reservations()) ? '' : 'Нет свободных ресурсов на весь интервал', side: n ? `+${money(n / 15 * 500)}` : 'Без доплаты' })); selected = String(draft.extension); }
  if (key === 'staff') { name = 'Сотрудник'; options = a.staff.map(value => ({ value, label: value })); }
  if (key === 'place') { name = 'Место'; options = a.places.map(value => ({ value, label: value })); }
  if (key === 'inventory') { name = 'Инвентарь'; options = a.inventory.map(value => ({ value, label: value })); }
  if (key === 'age') { name = 'Возраст гостя'; options = [{ value: 'adult', label: 'Взрослый', side: money(1500) }, { value: 'child', label: 'Ребёнок (2–10 лет)', side: money(750) }]; }
  if (key === 'account') { name = 'Счёт'; options = [{ value: '01', label: '01 · «101» Комфорт', description: 'Иванов Иван Иванович' }]; }
  modal = { kind: 'options', title: name, key, options, selected: Array.isArray(selected) ? [...selected] : selected, multiple: key === 'inventory', help: key === 'inventory' ? 'Выберите одну или несколько единиц инвентаря' : '' }; showSheet();
}
function chooseType() { modal = { kind: 'type', title: 'Выбор типа услуги', selected: '', options: [{ value: 'general', label: 'Общая услуга и питание', description: 'Услуги без привязки ко времени', disabled: true }, { value: 'hourly', label: 'Почасовая услуга', description: 'Баня, массаж, прокат и другие услуги с фиксированной длительностью' }] }; showSheet(); }
function openForm(service = null) { draft = service ? updateDraft(newDraft(), 'service', service) : newDraft(); errors = {}; editingId = null; view = 'form'; savedBanner = false; render(); }
function submit() {
  errors = validate(draft, reservations());
  if (Object.keys(errors).length) { render(true); requestAnimationFrame(() => { const el = content.querySelector('.field-error'); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); el?.querySelector('button,input')?.focus({ preventScroll: true }); }); notify('Заполните обязательные поля'); return; }
  const item = { id: editingId || crypto.randomUUID(), title: SERVICES[draft.service].title, draft: structuredClone(draft), price: total(draft, reservations()), icon: 'clock' };
  if (editingId) items = items.map(i => i.id === editingId ? item : i); else items.push(item);
  const edited = Boolean(editingId); view = 'list'; editingId = null; savedBanner = false; render(); notify(edited ? 'Изменения услуги сохранены' : 'Услуга добавлена');
}
function confirmAction(title, text, label, run) { modal = { kind: 'confirm', title, text, label, run }; showSheet(); }
function run(action) {
  if (action === 'close-sheet') return closeSheet();
  if (action === 'confirm-date') { const val = modal.selected; if (!isAvailableDate(draft.service, val, reservations())) return; closeSheet(); return change('date', val); }
  if (action === 'confirm-type') { closeSheet(); return openForm(); }
  if (action === 'confirm-inventory') { const val = [...modal.selected]; closeSheet(); return change('inventory', val); }
  if (action === 'confirm-action') { const fn = modal.run; closeSheet(); return fn(); }
  if (action === 'choose-type') return chooseType();
  if (action === 'submit') return submit();
  if (action === 'cancel-form') { const edited = Boolean(editingId); view = edited ? 'detail' : 'list'; errors = {}; editingId = null; render(); return; }
  if (action === 'list' || action === 'back') { view = 'list'; return render(); }
  if (action === 'booking') { view = 'booking'; return render(); }
  if (action === 'add-extra' || action === 'remove-extra') return change('extraEnabled', action === 'add-extra');
  if (action === 'apply') { if (items.some(item => item.draft && Object.keys(validate(item.draft, items.filter(other => other.id !== item.id))).length)) return notify('Проверьте даты, время и ресурсы добавленных услуг'); saved = structuredClone(items); let durable = true; try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { durable = false; } savedBanner = true; render(true); return notify(durable ? 'Изменения применены к бронированию' : 'Применено в текущем сеансе; хранилище браузера недоступно'); }
  if (action === 'edit') { const item = items.find(i => i.id === detailId); draft = structuredClone(item.draft); editingId = item.id; errors = {}; view = 'form'; return render(); }
  if (action === 'delete') return confirmAction('Удалить услугу?', 'Услуга будет удалена из списка. Чтобы сохранить изменения в бронировании, нажмите «Применить».', 'Удалить', () => { items = items.filter(i => i.id !== detailId); view = 'list'; savedBanner = false; render(); notify('Услуга удалена'); });
}
document.addEventListener('click', event => {
  const b = event.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.action) return run(b.dataset.action);
  if (b.dataset.picker) return pick(b.dataset.picker);
  if (b.dataset.detail) { detailId = b.dataset.detail; view = 'detail'; return render(); }
  if (b.dataset.scenario) { const selected = b.dataset.scenario; const launch = () => { scenario = selected; openForm(selected); draft = updateDraft(draft, 'date', '2026-03-26', reservations()); draft = updateDraft(draft, 'start', '11:00', reservations()); render(); }; if (view === 'form' && (draft.service || draft.group)) return confirmAction('Сменить демонстрационный кейс?', 'Текущая незавершённая форма будет заменена выбранным кейсом. Добавленные услуги останутся в списке.', 'Перейти', launch); return launch(); }
  if (b.hasAttribute('data-option')) {
    const val = b.dataset.option;
    if (modal.multiple) { modal.selected = modal.selected.includes(val) ? modal.selected.filter(v => v !== val) : [...modal.selected, val]; showSheet(); }
    else if (modal.kind === 'type') { modal.selected = val; showSheet(); }
    else { const key = modal.key; closeSheet(); change(key, key === 'extension' ? Number(val) : val); }
  }
  if (b.dataset.date && isAvailableDate(draft.service, b.dataset.date, reservations())) { modal.selected = b.dataset.date; showSheet(); }
  if (b.dataset.month) { modal.month.setMonth(modal.month.getMonth() + Number(b.dataset.month)); showSheet(); }
});
content.addEventListener('input', event => {
  const key = event.target.dataset.input; if (!key) return;
  const value = key === 'comment' ? event.target.value : event.target.value === '' ? '' : Number(event.target.value);
  draft = updateDraft(draft, key, value, reservations()); delete errors[key]; renderFooter();
  const w = event.target.closest('.field-wrap'); w?.classList.remove('field-error');
  if (key === 'extra') { const el = content.querySelector('[data-field="extraTotal"] .field-value'); if (el) el.textContent = String(Math.max(0, Number(draft.extra) || 0) * SERVICES[draft.service].extraPrice); }
});
content.addEventListener('submit', event => { event.preventDefault(); if (view === 'form') submit(); });
dialog.addEventListener('cancel', () => { modal = null; });
dialog.addEventListener('click', event => { if (event.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (event.clientY < r.top || event.clientY > r.bottom || event.clientX < r.left || event.clientX > r.right) closeSheet(); });
window.addEventListener('resize', () => { if (dialog.open) positionSheet(); });
$('#reset-demo').addEventListener('click', () => confirmAction('Начать заново?', 'Демонстрационные изменения будут сброшены. В списке останутся завтрак и парковка.', 'Начать заново', () => { saved = initial(); items = structuredClone(saved); try { localStorage.removeItem(storageKey); } catch {} scenario = 'steam'; draft = newDraft(); errors = {}; editingId = null; view = 'list'; savedBanner = false; render(); notify('Можно пройти сценарий заново'); }));
render();
if (restoredWarning) notify('Ранее сохранённые услуги с недоступными датами или ресурсами исключены из демонстрации');
