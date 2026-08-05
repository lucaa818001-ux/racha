import { calcularIMC } from './imc';

test('peso 70kg y altura 175cm da IMC 22.9', () => {
  expect(calcularIMC(70, 175)).toBe(22.9);
});

test('peso 100kg y altura 200cm da IMC 25.0', () => {
  expect(calcularIMC(100, 200)).toBe(25);
});

test('redondea a un decimal', () => {
  expect(calcularIMC(68, 170)).toBe(23.5);
});
