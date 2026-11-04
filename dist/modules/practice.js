/** Local practice data: penalties are applied before trimming timed averages. */
export function effectiveTime(solve) {
  if (!solve || solve.penalty === 'dnf') return Infinity;
  return solve.ms + (solve.penalty === 'plus2' ? 2000 : 0);
}
export function formatTime(milliseconds) {
  if (milliseconds === Infinity) return 'DNF';
  if (!Number.isFinite(milliseconds)) return '—';
  const centiseconds = Math.max(0, Math.floor(milliseconds / 10));
  const seconds = Math.floor(centiseconds / 100);
  const fraction = String(centiseconds % 100).padStart(2, '0');
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${fraction}` : `${seconds}.${fraction}`;
}
/** Singles are truncated; an aggregate is rounded to the nearest centisecond. */
export function formatAverage(milliseconds) {
  if (milliseconds === Infinity) return 'DNF';
  if (!Number.isFinite(milliseconds)) return '—';
  return formatTime(Math.max(0, Math.round(milliseconds / 10)) * 10);
}
export function trimmedAverage(solves, count) {
  if (solves.length < count) return null;
  // Average the recorded single results, which are shown to hundredths. Keep
  // the original high-resolution milliseconds on each solve for data export.
  const values = solves.slice(-count).map(solve => Math.floor(effectiveTime(solve) / 10) * 10).sort((a, b) => a - b);
  const remaining = values.slice(1, -1);
  return remaining.some(v => !Number.isFinite(v)) ? Infinity : remaining.reduce((a, b) => a + b, 0) / remaining.length;
}
export function sessionStats(solves) {
  const finite = solves.map(effectiveTime).filter(Number.isFinite);
  return {
    count: solves.length,
    best: finite.length ? Math.min(...finite) : null,
    mean: finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : null,
    ao5: trimmedAverage(solves, 5), ao12: trimmedAverage(solves, 12),
  };
}
export function inspectionPenalty(milliseconds) {
  return milliseconds >= 17000 ? 'dnf' : milliseconds >= 15000 ? 'plus2' : 'none';
}
export function csvForSolves(solves) {
  const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return ['Solve,Time,RawMilliseconds,Penalty,Size,Date,Scramble', ...solves.map((s, i) => [i + 1, formatTime(effectiveTime(s)), s.ms, s.penalty, s.size, s.date, s.scramble].map(cell).join(','))].join('\r\n');
}
