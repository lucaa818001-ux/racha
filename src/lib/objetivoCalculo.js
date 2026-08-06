export function calcularProgreso(goal, pesoActual) {
  const { type, target_value, start_value } = goal;
  if (target_value === start_value) {
    const llego = type === 'bajar' ? pesoActual <= target_value : pesoActual >= target_value;
    return llego ? 100 : 0;
  }
  let progreso;
  if (type === 'bajar') {
    progreso = ((start_value - pesoActual) / (start_value - target_value)) * 100;
  } else {
    progreso = ((pesoActual - start_value) / (target_value - start_value)) * 100;
  }
  return Math.max(0, Math.min(100, Math.round(progreso)));
}

export function estimarFechaLogro(goal, logsDesdeInicio) {
  if (logsDesdeInicio.length < 3) return null;

  const startDate = new Date(goal.start_date + 'T00:00:00');
  const puntos = logsDesdeInicio.map((log) => {
    const dias = Math.round((new Date(log.date + 'T00:00:00') - startDate) / (1000 * 60 * 60 * 24));
    return { x: dias, y: log.weight };
  });

  const n = puntos.length;
  const sumX = puntos.reduce((acc, p) => acc + p.x, 0);
  const sumY = puntos.reduce((acc, p) => acc + p.y, 0);
  const sumXY = puntos.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumX2 = puntos.reduce((acc, p) => acc + p.x * p.x, 0);

  const denominador = n * sumX2 - sumX * sumX;
  if (denominador === 0) return null;

  const pendiente = (n * sumXY - sumX * sumY) / denominador;
  const ordenada = (sumY - pendiente * sumX) / n;

  const direccionCorrecta = goal.type === 'bajar' ? pendiente < 0 : pendiente > 0;
  if (!direccionCorrecta) return null;

  const diasHastaMeta = (goal.target_value - ordenada) / pendiente;
  if (!Number.isFinite(diasHastaMeta)) return null;

  const fechaEstimada = new Date(startDate);
  fechaEstimada.setDate(fechaEstimada.getDate() + Math.round(diasHastaMeta));
  return fechaEstimada;
}
