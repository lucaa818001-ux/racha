import { calcularRachaActual } from './rachaCalculo';

const hoy = new Date('2026-08-05T12:00:00');

test('sin check-ins, la racha es 0', () => {
  expect(calcularRachaActual([], hoy)).toBe(0);
});

test('con check-in de hoy y ayer, la racha es 2', () => {
  expect(calcularRachaActual(['2026-08-05', '2026-08-04'], hoy)).toBe(2);
});

test('sin check-in de hoy pero si de ayer, cuenta desde ayer', () => {
  expect(calcularRachaActual(['2026-08-04', '2026-08-03'], hoy)).toBe(2);
});

test('un hueco corta la racha antes de ese hueco', () => {
  expect(calcularRachaActual(['2026-08-05', '2026-08-03'], hoy)).toBe(1);
});

test('sin check-in de hoy ni ayer, la racha es 0', () => {
  expect(calcularRachaActual(['2026-08-01'], hoy)).toBe(0);
});
