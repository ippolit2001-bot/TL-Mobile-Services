export const SERVICES = {
  steam: { title: 'Аренда парной', group: 'Бани', duration: 45, price: 1500, staff: true, place: true },
  'steam-extended': { title: 'Аренда парной с продлением', group: 'Бани', duration: 45, price: 1500, staff: true, place: true, extend: true },
  pool: { title: 'Плавание (1 час)', group: 'Бассейн', duration: 45, price: 1500, staff: true, age: true },
  bikes: { title: 'Аренда велосипеда', group: 'Аренда', duration: 60, price: 500, inventory: true },
  gazebo: { title: 'Аренда беседки', group: 'Аренда', duration: 60, price: 5000, place: true, baseGuests: 4, extraPrice: 500 },
};
export const STARTS = ['10:00', '11:00', '12:00', '13:00', '14:00'];
export function newDraft() {
  return { group: '', service: '', date: '', start: '', staff: '', place: '', inventory: [], age: '', guests: 1, price: 0, extension: 0, extraEnabled: false, extra: 1, account: '01', comment: '' };
}
export function availability(d) {
  if (!d.date || !STARTS.includes(d.start) || !SERVICES[d.service]) return { staff: [], places: [], inventory: [] };
  return { staff: d.start === '10:00' ? ['Петров В.И.'] : ['Архипов М.А.', 'Петров В.И.'], places: d.service === 'gazebo' ? ['Беседка №5'] : d.start === '10:00' ? ['Парная №2'] : ['Парная №1', 'Парная №2'], inventory: ['Велосипед №1', 'Велосипед №2', 'Велосипед №3'] };
}
export function updateDraft(d, key, value) {
  if (d[key] === value) return { ...d };
  if (key === 'group') return { ...newDraft(), group: value, account: d.account, comment: d.comment };
  if (key === 'service') { const s = SERVICES[value]; return { ...newDraft(), group: s?.group || d.group, service: value, price: s?.price || 0, guests: s?.baseGuests || 1, account: d.account, comment: d.comment }; }
  const next = { ...d, [key]: value };
  if (key === 'date') Object.assign(next, { start: '', staff: '', place: '', inventory: [], extension: 0 });
  if (key === 'start') { Object.assign(next, { staff: '', place: '', inventory: [], extension: 0 }); const a = availability(next), s = SERVICES[next.service]; if (s?.staff && a.staff.length === 1) next.staff = a.staff[0]; if (s?.place && a.places.length === 1) next.place = a.places[0]; }
  if (key === 'age') next.price = value === 'adult' ? 1500 : value === 'child' ? 750 : 0;
  return next;
}
export function total(d) {
  const s = SERVICES[d.service]; if (!s || !d.date || !STARTS.includes(d.start) || (s.age && !['adult', 'child'].includes(d.age))) return 0;
  const price = Number(d.price), guests = Number(d.guests), extra = Number(d.extra);
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(guests) || guests < 1) return 0;
  const added = d.extraEnabled && Number.isInteger(extra) && extra > 0 ? extra : 0;
  return s.baseGuests ? price + added * s.extraPrice : price * guests + (s.extend && [15, 30].includes(d.extension) ? d.extension / 15 * 500 : 0);
}
export function endTime(d) {
  const s = SERVICES[d.service]; if (!s || !STARTS.includes(d.start)) return '';
  const [h, m] = d.start.split(':').map(Number), end = h * 60 + m + s.duration + (s.extend ? d.extension : 0);
  return `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}
export function validate(d) {
  const e = {}, s = SERVICES[d.service];
  if (!['Бани', 'Бассейн', 'Аренда'].includes(d.group)) e.group = 'Выберите группу услуг';
  if (!s || s.group !== d.group) e.service = 'Выберите услугу'; if (!s) return e;
  const parsed = new Date(d.date + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== d.date) e.date = 'Выберите дату оказания услуги';
  if (!STARTS.includes(d.start)) e.start = 'Выберите время начала';
  const a = availability(d);
  if (s.staff && !a.staff.includes(d.staff)) e.staff = 'Заполните поле';
  if (s.place && !a.places.includes(d.place)) e.place = 'Заполните поле';
  if (s.inventory && (!Array.isArray(d.inventory) || !d.inventory.length || d.inventory.some(v => !a.inventory.includes(v)))) e.inventory = 'Выберите хотя бы одну единицу инвентаря';
  if (s.age && !['adult', 'child'].includes(d.age)) e.age = 'Выберите возрастную категорию';
  if (!Number.isInteger(Number(d.guests)) || Number(d.guests) < 1 || Number(d.guests) > 100) e.guests = 'Введите целое число от 1 до 100';
  if (d.price === '' || !Number.isFinite(Number(d.price)) || Number(d.price) < 0 || Number(d.price) > 1000000) e.price = 'Введите цену от 0 до 1 000 000 RUB';
  if (s.baseGuests && d.extraEnabled && (!Number.isInteger(Number(d.extra)) || Number(d.extra) < 1 || Number(d.extra) > 10)) e.extra = 'Введите от 1 до 10 дополнительных гостей';
  if (s.extend && ![0, 15, 30].includes(d.extension)) e.extension = 'Выберите вариант продления';
  if (d.account !== '01') e.account = 'Выберите счёт'; return e;
}
