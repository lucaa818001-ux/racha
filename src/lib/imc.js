export function calcularIMC(pesoKg, alturaCm) {
  const alturaM = alturaCm / 100;
  const imc = pesoKg / (alturaM * alturaM);
  return Math.round(imc * 10) / 10;
}
