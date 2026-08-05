function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calcularEstadisticas(checkinsDelAnio, hoy = new Date()) {
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const hace28Dias = new Date(hoy);
  hace28Dias.setDate(hace28Dias.getDate() - 27);

  const totalMes = checkinsDelAnio.filter(
    (c) => c.date >= formatDate(inicioMes) && c.date <= formatDate(hoy)
  ).length;
  const totalAnio = checkinsDelAnio.length;
  const totalUltimas4Semanas = checkinsDelAnio.filter(
    (c) => c.date >= formatDate(hace28Dias) && c.date <= formatDate(hoy)
  ).length;
  const promedioSemanal = Math.round((totalUltimas4Semanas / 4) * 10) / 10;

  return { totalMes, totalAnio, promedioSemanal };
}
