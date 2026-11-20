import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft, updateDraft, total, validate, endTime, availability } from '../model.js';

function ready(service = 'steam') {
  let d = updateDraft(newDraft(), 'service', service);
  d = updateDraft(d, 'date', '2026-03-26');
  d = updateDraft(d, 'start', '11:00');
  return { ...d, staff: 'Петров В.И.', place: service === 'gazebo' ? 'Беседка №5' : 'Парная №2' };
}

test('до выбора даты и времени итог остаётся нулевым', () => {
  const d = updateDraft(newDraft(), 'service', 'steam');
  assert.equal(total(d), 0);
  assert.equal(total(updateDraft(d, 'date', '2026-03-26')), 0);
});

test('парная 45 минут стоит 1500, продление на 15 минут добавляет 500', () => {
  const d = ready();
  assert.equal(total(d), 1500);
  assert.equal(endTime(d), '11:45');
  const extended = { ...ready('steam-extended'), extension: 15 };
  assert.equal(total(extended), 2000);
  assert.equal(endTime(extended), '12:00');
});

test('возраст определяет цену, без возраста услуга не добавляется', () => {
  const d = ready('pool');
  assert.equal(total(d), 0);
  assert.ok(validate(d).age);
  assert.equal(total(updateDraft(d, 'age', 'adult')), 1500);
  assert.equal(total(updateDraft(d, 'age', 'child')), 750);
});

test('беседка с двумя дополнительными гостями стоит 6000, лимит валидируется', () => {
  const d = { ...ready('gazebo'), extraEnabled: true, extra: 2 };
  assert.equal(total(d), 6000);
  assert.equal(validate(d).extra, undefined);
  assert.ok(validate({ ...d, extra: 11 }).extra);
  assert.ok(validate({ ...d, extra: -1 }).extra);
});

test('дата сбрасывает время и ресурсы, начало сбрасывает ресурсы и продление', () => {
  const d = { ...ready('steam-extended'), extension: 15 };
  const date = updateDraft(d, 'date', '2026-03-27');
  assert.equal(date.start, '');
  assert.equal(date.staff, '');
  assert.equal(date.place, '');
  const start = updateDraft(d, 'start', '12:00');
  assert.equal(start.staff, '');
  assert.equal(start.place, '');
  assert.equal(start.extension, 0);
});

test('единственные ресурсы подставляются автоматически', () => {
  const d = updateDraft(ready(), 'start', '10:00');
  assert.equal(availability(d).staff.length, 1);
  assert.equal(d.staff, 'Петров В.И.');
  assert.equal(d.place, 'Парная №2');
});

test('несколько ресурсов требуют выбора; количество должно быть целым положительным', () => {
  const d = updateDraft(updateDraft(newDraft(), 'service', 'steam'), 'date', '2026-03-26');
  const scheduled = updateDraft(d, 'start', '11:00');
  assert.ok(validate(scheduled).staff);
  assert.ok(validate(scheduled).place);
  assert.deepEqual(validate(ready()), {});
  assert.ok(validate({ ...ready(), guests: 0 }).guests);
  assert.ok(validate({ ...ready(), guests: 1.5 }).guests);
  assert.ok(validate({ ...ready(), price: -1 }).price);
});

test('инвентарь выбирается множественно, стоимость зависит от количества гостей', () => {
  const d = { ...ready('bikes'), age: 'adult', inventory: ['Велосипед №1', 'Велосипед №2'], guests: 2 };
  assert.equal(total(d), 1000);
  assert.equal(validate(d).inventory, undefined);
  assert.ok(validate({ ...d, inventory: [] }).inventory);
  assert.equal(total({ ...d, guests: 1 }), 500);
});

test('неполные и некорректные даты и время не допускаются', () => {
  assert.ok(validate(newDraft()).group);
  assert.ok(validate(newDraft()).service);
  assert.ok(validate({ ...ready(), date: '2026-02-31' }).date);
  assert.ok(validate({ ...ready(), start: '25:00' }).start);
  assert.ok(validate({ ...ready(), account: '' }).account);
});

test('даты до заезда и после выезда не допускаются', () => {
  assert.ok(validate({ ...ready(), date: '2026-03-25' }).date);
  assert.ok(validate({ ...ready(), date: '2026-03-29' }).date);
});

test('дата выезда доступна после времени выезда 12:00', () => {
  const d = { ...ready(), date: '2026-03-28', start: '17:00' };
  assert.deepEqual(validate(d), {});
  assert.equal(endTime(d), '17:45');
});

test('занятые дата и время не дают создать услугу', () => {
  assert.ok(validate({ ...ready(), date: '2026-03-27' }).date);
  assert.ok(validate({ ...ready(), start: '12:00' }).start);
  assert.deepEqual(availability({ ...ready(), start: '12:00' }).staff, []);
});

test('единственный свободный инвентарь выбирается автоматически', () => {
  const d = updateDraft(ready('bikes'), 'start', '10:00');
  assert.deepEqual(d.inventory, ['Велосипед №1']);
  assert.deepEqual(availability(d).inventory, ['Велосипед №1']);
});

test('занятый ресурс нельзя выбрать даже при наличии других свободных', () => {
  const d = { ...ready(), start: '10:00', staff: 'Архипов М.А.', place: 'Парная №1' };
  assert.ok(validate(d).staff);
  assert.ok(validate(d).place);
  assert.deepEqual(availability(d).staff, ['Петров В.И.']);
});

test('продление проверяет весь интервал и заменяет ставшие занятыми ресурсы', () => {
  const d = { ...ready('steam-extended'), staff: 'Архипов М.А.', place: 'Парная №1' };
  assert.deepEqual(validate(d), {});
  const extended = updateDraft(d, 'extension', 15);
  assert.equal(extended.staff, 'Петров В.И.');
  assert.equal(extended.place, 'Парная №2');
  assert.ok(validate({ ...d, extension: 15 }).staff);
  assert.ok(validate({ ...d, extension: 15 }).place);
});

test('добавленная услуга занимает ресурсы, остальные свободные варианты остаются доступны', () => {
  const occupied = [{ id: 'one', draft: ready() }];
  assert.ok(validate(ready(), occupied).staff);
  assert.ok(validate(ready(), occupied).place);
  assert.deepEqual(availability(ready(), occupied).staff, ['Архипов М.А.']);
  assert.deepEqual(validate({ ...ready(), staff: 'Архипов М.А.', place: 'Парная №1' }, occupied), {});
});

test('при занятости всех ресурсов слот полностью закрывается', () => {
  const occupied = [{ draft: ready() }, { draft: { ...ready(), staff: 'Архипов М.А.', place: 'Парная №1' } }];
  assert.deepEqual(availability(ready(), occupied).staff, []);
  assert.ok(validate(ready(), occupied).start);
});

test('продление за часы работы услуги не допускается даже в дату выезда', () => {
  const d = { ...ready('steam-extended'), date: '2026-03-28', start: '17:00', extension: 30 };
  assert.ok(validate(d).start);
});
