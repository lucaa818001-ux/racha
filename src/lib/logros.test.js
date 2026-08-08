import { calcularLogrosDesbloqueados } from './logros';

test('sin ningun logro cuando las stats estan en cero', () => {
  const resultado = calcularLogrosDesbloqueados({ rachaMaxima: 0, objetivosCompletados: 0, totalEntrenamientos: 0 });
  expect(resultado).toEqual([]);
});

test('desbloquea racha_7 justo al llegar a 7 dias', () => {
  const resultado = calcularLogrosDesbloqueados({ rachaMaxima: 7, objetivosCompletados: 0, totalEntrenamientos: 0 });
  expect(resultado.map((l) => l.key)).toEqual(['racha_7']);
});

test('no desbloquea racha_7 con 6 dias', () => {
  const resultado = calcularLogrosDesbloqueados({ rachaMaxima: 6, objetivosCompletados: 0, totalEntrenamientos: 0 });
  expect(resultado.map((l) => l.key)).toEqual([]);
});

test('desbloquea varios logros de racha a la vez con 30 dias', () => {
  const resultado = calcularLogrosDesbloqueados({ rachaMaxima: 30, objetivosCompletados: 0, totalEntrenamientos: 0 });
  expect(resultado.map((l) => l.key)).toEqual(['racha_7', 'racha_14', 'racha_30']);
});

test('desbloquea logros de objetivos y entrenamientos independientemente de la racha', () => {
  const resultado = calcularLogrosDesbloqueados({ rachaMaxima: 0, objetivosCompletados: 3, totalEntrenamientos: 50 });
  expect(resultado.map((l) => l.key)).toEqual(['objetivo_1', 'objetivo_3', 'entrenos_10', 'entrenos_50']);
});
