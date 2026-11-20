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
