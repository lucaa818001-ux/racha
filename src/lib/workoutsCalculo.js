export function calcularDuracionMinutos(startedAt, endedAt) {
  const ms = endedAt.getTime() - startedAt.getTime();
  return Math.round(ms / (1000 * 60));
}

export function calcularVolumenTotal(entradas) {
  return entradas
    .filter((e) => e.type === 'peso_reps')
    .reduce((total, e) => total + e.sets.reduce((sub, s) => sub + s.weight * s.reps, 0), 0);
}

export function calcularTiempoTotalSegundos(entradas) {
  return entradas
    .filter((e) => e.type === 'tiempo')
    .reduce((total, e) => total + e.sets.reduce((sub, s) => sub + s.duration_seg, 0), 0);
}

export function esRecordPersonal(marcaNueva, mejorMarcaAnterior) {
  if (mejorMarcaAnterior === null || mejorMarcaAnterior === undefined) return false;
  return marcaNueva > mejorMarcaAnterior;
}
