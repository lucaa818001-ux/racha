export function mejorMarcaSesion(sets, type) {
  if (!sets || sets.length === 0) return null;
  if (type === 'tiempo') {
    return sets.reduce((total, s) => total + s.duration_seg, 0);
  }
  return Math.max(...sets.map((s) => s.weight));
}
