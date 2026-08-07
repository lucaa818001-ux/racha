import {
  calcularDuracionMinutos,
  calcularVolumenTotal,
  calcularTiempoTotalSegundos,
  esRecordPersonal,
} from './workoutsCalculo';

test('calcularDuracionMinutos redondea los minutos transcurridos', () => {
  const inicio = new Date('2026-08-07T10:00:00');
  const fin = new Date('2026-08-07T10:45:30');
  expect(calcularDuracionMinutos(inicio, fin)).toBe(46);
});

test('calcularDuracionMinutos con menos de un minuto redondea a 0', () => {
  const inicio = new Date('2026-08-07T10:00:00');
  const fin = new Date('2026-08-07T10:00:20');
  expect(calcularDuracionMinutos(inicio, fin)).toBe(0);
});

test('calcularVolumenTotal suma peso x reps solo de las entradas peso_reps', () => {
  const entradas = [
    { type: 'peso_reps', sets: [{ weight: 40, reps: 10 }, { weight: 40, reps: 8 }] },
    { type: 'tiempo', sets: [{ duration_seg: 60 }] },
  ];
  expect(calcularVolumenTotal(entradas)).toBe(720);
});

test('calcularVolumenTotal con entradas vacias devuelve 0', () => {
  expect(calcularVolumenTotal([])).toBe(0);
});

test('calcularTiempoTotalSegundos suma la duracion solo de las entradas tiempo', () => {
  const entradas = [
    { type: 'tiempo', sets: [{ duration_seg: 60 }, { duration_seg: 30 }] },
    { type: 'peso_reps', sets: [{ weight: 40, reps: 10 }] },
  ];
  expect(calcularTiempoTotalSegundos(entradas)).toBe(90);
});

test('esRecordPersonal es true cuando supera la marca anterior', () => {
  expect(esRecordPersonal(55, 50)).toBe(true);
});

test('esRecordPersonal es false cuando no supera la marca anterior', () => {
  expect(esRecordPersonal(45, 50)).toBe(false);
});

test('esRecordPersonal es false cuando no hay marca anterior', () => {
  expect(esRecordPersonal(45, null)).toBe(false);
});
