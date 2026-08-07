import { mejorMarcaSesion } from './exerciciosCalculo';

test('peso_reps: devuelve el peso maximo entre los sets', () => {
  const sets = [{ weight: 40, reps: 10 }, { weight: 50, reps: 8 }, { weight: 45, reps: 8 }];
  expect(mejorMarcaSesion(sets, 'peso_reps')).toBe(50);
});

test('peso_reps: un solo set devuelve su peso', () => {
  const sets = [{ weight: 60, reps: 5 }];
  expect(mejorMarcaSesion(sets, 'peso_reps')).toBe(60);
});

test('tiempo: suma la duracion de todos los sets', () => {
  const sets = [{ duration_seg: 30 }, { duration_seg: 45 }, { duration_seg: 60 }];
  expect(mejorMarcaSesion(sets, 'tiempo')).toBe(135);
});

test('sets vacios devuelve null', () => {
  expect(mejorMarcaSesion([], 'peso_reps')).toBeNull();
  expect(mejorMarcaSesion([], 'tiempo')).toBeNull();
});
