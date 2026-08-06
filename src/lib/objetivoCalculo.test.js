import { calcularProgreso, estimarFechaLogro, calcularRitmoSemanal } from './objetivoCalculo';

test('bajar de peso: progreso a mitad de camino es 50', () => {
  const goal = { type: 'bajar', target_value: 70, start_value: 80 };
  expect(calcularProgreso(goal, 75)).toBe(50);
});

test('bajar de peso: sin avance todavia es 0', () => {
  const goal = { type: 'bajar', target_value: 70, start_value: 80 };
  expect(calcularProgreso(goal, 80)).toBe(0);
});

test('bajar de peso: superar la meta se limita a 100', () => {
  const goal = { type: 'bajar', target_value: 70, start_value: 80 };
  expect(calcularProgreso(goal, 65)).toBe(100);
});

test('subir de peso: progreso a mitad de camino es 50', () => {
  const goal = { type: 'subir', target_value: 70, start_value: 60 };
  expect(calcularProgreso(goal, 65)).toBe(50);
});

test('estimarFechaLogro: con menos de 3 registros devuelve null', () => {
  const goal = { type: 'bajar', target_value: 70, start_date: '2026-01-01' };
  const logs = [{ date: '2026-01-01', weight: 80 }, { date: '2026-01-08', weight: 78 }];
  expect(estimarFechaLogro(goal, logs)).toBeNull();
});

test('estimarFechaLogro: tendencia correcta calcula una fecha', () => {
  const goal = { type: 'bajar', target_value: 70, start_date: '2026-01-01' };
  const logs = [
    { date: '2026-01-01', weight: 80 },
    { date: '2026-01-08', weight: 78 },
    { date: '2026-01-15', weight: 76 },
  ];
  const fecha = estimarFechaLogro(goal, logs);
  expect(fecha.getFullYear()).toBe(2026);
  expect(fecha.getMonth()).toBe(1);
  expect(fecha.getDate()).toBe(5);
});

test('estimarFechaLogro: tendencia en contra devuelve null', () => {
  const goal = { type: 'bajar', target_value: 70, start_date: '2026-01-01' };
  const logs = [
    { date: '2026-01-01', weight: 80 },
    { date: '2026-01-08', weight: 82 },
    { date: '2026-01-15', weight: 84 },
  ];
  expect(estimarFechaLogro(goal, logs)).toBeNull();
});

test('calcularRitmoSemanal: con menos de 3 registros devuelve null', () => {
  const logs = [{ date: '2026-01-01', weight: 80 }, { date: '2026-01-08', weight: 78 }];
  expect(calcularRitmoSemanal('2026-01-01', logs)).toBeNull();
});

test('calcularRitmoSemanal: bajando 2kg cada 7 dias da -2', () => {
  const logs = [
    { date: '2026-01-01', weight: 80 },
    { date: '2026-01-08', weight: 78 },
    { date: '2026-01-15', weight: 76 },
  ];
  expect(calcularRitmoSemanal('2026-01-01', logs)).toBe(-2);
});
