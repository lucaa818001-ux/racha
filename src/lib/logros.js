export const LOGROS = [
  { key: 'racha_7', emoji: '🔥', label: '7 días seguidos', check: (s) => s.rachaMaxima >= 7 },
  { key: 'racha_14', emoji: '🔥', label: '14 días seguidos', check: (s) => s.rachaMaxima >= 14 },
  { key: 'racha_30', emoji: '🔥', label: '30 días seguidos', check: (s) => s.rachaMaxima >= 30 },
  { key: 'objetivo_1', emoji: '🎯', label: 'Primer objetivo cumplido', check: (s) => s.objetivosCompletados >= 1 },
  { key: 'objetivo_3', emoji: '🎯', label: '3 objetivos cumplidos', check: (s) => s.objetivosCompletados >= 3 },
  { key: 'entrenos_10', emoji: '💪', label: '10 entrenamientos', check: (s) => s.totalEntrenamientos >= 10 },
  { key: 'entrenos_50', emoji: '💪', label: '50 entrenamientos', check: (s) => s.totalEntrenamientos >= 50 },
];

export function calcularLogrosDesbloqueados(stats) {
  return LOGROS.filter((logro) => logro.check(stats));
}
