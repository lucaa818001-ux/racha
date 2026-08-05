import { calcularEstadisticas } from './estadisticas';

const hoy = new Date('2026-08-05T12:00:00');

test('sin check-ins, todo en 0', () => {
  expect(calcularEstadisticas([], hoy)).toEqual({ totalMes: 0, totalAnio: 0, promedioSemanal: 0 });
});

test('cuenta check-ins del mes actual', () => {
  const checkins = [{ date: '2026-08-01' }, { date: '2026-08-03' }, { date: '2026-07-15' }];
  expect(calcularEstadisticas(checkins, hoy).totalMes).toBe(2);
});

test('cuenta el total del anio incluyendo otros meses', () => {
  const checkins = [{ date: '2026-01-05' }, { date: '2026-08-01' }];
  expect(calcularEstadisticas(checkins, hoy).totalAnio).toBe(2);
});

test('promedio semanal usa los ultimos 28 dias', () => {
  const checkins = [
    { date: '2026-08-05' }, { date: '2026-08-04' }, { date: '2026-08-03' }, { date: '2026-08-02' },
    { date: '2026-01-01' },
  ];
  expect(calcularEstadisticas(checkins, hoy).promedioSemanal).toBe(1);
});
