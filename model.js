export const SERVICES = {
  steam: { title: 'Аренда парной', group: 'Бани', duration: 45, price: 1500, staff: true, place: true },
  'steam-extended': { title: 'Аренда парной с продлением', group: 'Бани', duration: 45, price: 1500, staff: true, place: true, extend: true },
  pool: { title: 'Плавание (1 час)', group: 'Бассейн', duration: 45, price: 1500, staff: true, age: true },
  bikes: { title: 'Аренда велосипеда', group: 'Аренда', duration: 60, price: 500, inventory: true },
  gazebo: { title: 'Аренда беседки', group: 'Аренда', duration: 60, price: 5000, place: true, baseGuests: 4, extraPrice: 500 },
};
export const STAY = { arrival: '2026-03-26', departure: '2026-03-28', departureTime: '12:00' };
export const STARTS = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const CATALOG = {
  staff: ['Архипов М.А.', 'Петров В.И.'],
  places: ['Парная №1', 'Парная №2', 'Беседка №5'],
  inventory: ['Велосипед №1', 'Велосипед №2', 'Велосипед №3'],
};
// Demonstration occupancy, shared by every service using the same resource.
const OCCUPIED = [
  { date: '2026-03-26', start: 600, end: 660, resources: ['Архипов М.А.', 'Парная №1', 'Велосипед №2', 'Велосипед №3'] },
  { date: '2026-03-26', start: 705, end: 720, resources: ['Архипов М.А.', 'Парная №1'] },
  { date: '2026-03-26', start: 720, end: 780, resources: Object.values(CATALOG).flat() },
  { date: '2026-03-26', start: 960, end: 1080, resources: ['Архипов М.А.', 'Парная №1', 'Велосипед №2', 'Велосипед №3'] },
  { date: '2026-03-27', start: 600, end: 1080, resources: Object.values(CATALOG).flat() },
];
const minutes = time => /^\d{2}:\d{2}$/.test(time || '') ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN;
export function isStayDate(date) {
  const parsed = new Date(date + 'T12:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') && !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date && date >= STAY.arrival && date <= STAY.departure;
}
function interval(d) {
  const s = SERVICES[d.service], start = minutes(d.start);
  const extra = s?.extend ? Number(d.extension) : 0;
  return { start, end: start + (s?.duration || 0) + extra };
}
function occupiedIntervals(reservations) {
  return [...OCCUPIED, ...reservations.flatMap(item => {
    const d = item.draft;
    if (!d || !SERVICES[d.service]) return [];
    return [{ date: d.date, ...interval(d), resources: [d.staff, d.place, ...(d.inventory || [])].filter(Boolean) }];
  })];
}
export function newDraft() {
  return { group: '', service: '', date: '', start: '', staff: '', place: '', inventory: [], age: '', guests: 1, price: 0, extension: 0, extraEnabled: false, extra: 1, account: '01', comment: '' };
}
export function availability(d, reservations = []) {
  const s = SERVICES[d.service], span = interval(d);
  if (!isStayDate(d.date) || !STARTS.includes(d.start) || !s || span.start < 600 || span.end > 1080 || !Number.isFinite(span.end) || (s.extend && ![0, 15, 30].includes(d.extension))) return { staff: [], places: [], inventory: [] };
  const busy = occupiedIntervals(reservations).filter(b => b.date === d.date && span.start < b.end && b.start < span.end);
  const free = resources => resources.filter(resource => !busy.some(b => b.resources.includes(resource)));
  return { staff: s.staff ? free(CATALOG.staff) : [], places: s.place ? free(s.baseGuests ? ['Беседка №5'] : ['Парная №1', 'Парная №2']) : [], inventory: s.inventory ? free(CATALOG.inventory) : [] };
}
export function isSlotAvailable(d, reservations = []) {
  const s = SERVICES[d.service], a = availability(d, reservations);
  return !!s && (!s.staff || a.staff.length > 0) && (!s.place || a.places.length > 0) && (!s.inventory || a.inventory.length > 0);
}
export function availableStarts(d, reservations = []) {
  return STARTS.filter(start => isSlotAvailable({ ...d, start, extension: 0 }, reservations));
}
export function isAvailableDate(service, date, reservations = []) {
  return isStayDate(date) && availableStarts({ ...newDraft(), service, date }, reservations).length > 0;
}
export function stayDates() {
  const result = [];
  for (let date = new Date(STAY.arrival + 'T12:00:00Z'); date.toISOString().slice(0, 10) <= STAY.departure; date.setUTCDate(date.getUTCDate() + 1)) result.push(date.toISOString().slice(0, 10));
  return result;
}
export function updateDraft(d, key, value, reservations = []) {
  if (d[key] === value) return { ...d };
  if (key === 'group') return { ...newDraft(), group: value, account: d.account, comment: d.comment };
  if (key === 'service') { const s = SERVICES[value]; return { ...newDraft(), group: s?.group || d.group, service: value, price: s?.price || 0, guests: s?.baseGuests || 1, account: d.account, comment: d.comment }; }
  const next = { ...d, [key]: value };
  if (key === 'date') Object.assign(next, { start: '', staff: '', place: '', inventory: [], extension: 0 });
  if (key === 'start') Object.assign(next, { staff: '', place: '', inventory: [], extension: 0 });
  if (key === 'start' || key === 'extension') {
    const a = availability(next, reservations), s = SERVICES[next.service];
    if (s?.staff) next.staff = a.staff.length === 1 ? a.staff[0] : a.staff.includes(next.staff) ? next.staff : '';
    if (s?.place) next.place = a.places.length === 1 ? a.places[0] : a.places.includes(next.place) ? next.place : '';
    if (s?.inventory) next.inventory = a.inventory.length === 1 ? [...a.inventory] : next.inventory.filter(resource => a.inventory.includes(resource));
  }
  if (key === 'age') next.price = value === 'adult' ? 1500 : value === 'child' ? 750 : 0;
  return next;
}
export function total(d, reservations = []) {
  const s = SERVICES[d.service]; if (!s || !isSlotAvailable(d, reservations) || (s.age && !['adult', 'child'].includes(d.age))) return 0;
  const price = Number(d.price), guests = Number(d.guests), extra = Number(d.extra);
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(guests) || guests < 1) return 0;
  const added = d.extraEnabled && Number.isInteger(extra) && extra > 0 ? extra : 0;
  return s.baseGuests ? price + added * s.extraPrice : price * guests + (s.extend && [15, 30].includes(d.extension) ? d.extension / 15 * 500 : 0);
}
export function endTime(d) {
  const s = SERVICES[d.service]; if (!s || !STARTS.includes(d.start)) return '';
  const { end } = interval(d);
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}
export function validate(d, reservations = []) {
  const e = {}, s = SERVICES[d.service];
  if (!['Бани', 'Бассейн', 'Аренда'].includes(d.group)) e.group = 'Выберите группу услуг';
  if (!s || s.group !== d.group) e.service = 'Выберите услугу'; if (!s) return e;
  if (!isStayDate(d.date)) e.date = 'Выберите дату проживания с 26 по 28 марта включительно';
  else if (!isAvailableDate(d.service, d.date, reservations)) e.date = 'На эту дату нет свободного времени и ресурсов';
  if (!STARTS.includes(d.start)) e.start = 'Выберите время начала';
  else if (!isSlotAvailable(d, reservations)) e.start = 'На весь выбранный интервал нет свободных ресурсов';
  const a = availability(d, reservations);
  if (s.staff && !a.staff.includes(d.staff)) e.staff = d.staff ? 'Сотрудник занят в выбранное время' : 'Заполните поле';
  if (s.place && !a.places.includes(d.place)) e.place = d.place ? 'Место занято в выбранное время' : 'Заполните поле';
  if (s.inventory && (!Array.isArray(d.inventory) || !d.inventory.length || d.inventory.some(v => !a.inventory.includes(v)))) e.inventory = 'Выберите хотя бы одну единицу инвентаря';
  if (s.age && !['adult', 'child'].includes(d.age)) e.age = 'Выберите возрастную категорию';
  if (!Number.isInteger(Number(d.guests)) || Number(d.guests) < 1 || Number(d.guests) > 100) e.guests = 'Введите целое число от 1 до 100';
  if (d.price === '' || !Number.isFinite(Number(d.price)) || Number(d.price) < 0 || Number(d.price) > 1000000) e.price = 'Введите цену от 0 до 1 000 000 RUB';
  if (s.baseGuests && d.extraEnabled && (!Number.isInteger(Number(d.extra)) || Number(d.extra) < 1 || Number(d.extra) > 10)) e.extra = 'Введите от 1 до 10 дополнительных гостей';
  if (s.extend && ![0, 15, 30].includes(d.extension)) e.extension = 'Выберите вариант продления';
  if (d.account !== '01') e.account = 'Выберите счёт'; return e;
}
