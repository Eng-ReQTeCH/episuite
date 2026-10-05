export function formatTime(iso) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatTimeShort(iso) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatRelative(minutesFromNow) {
  const totalMinutes = Math.round(minutesFromNow);
  const h = Math.floor(Math.abs(totalMinutes) / 60);
  const m = Math.abs(totalMinutes) % 60;
  const sign = totalMinutes < 0 ? '-' : '+';
  if (h === 0) return `${sign}${String(m).padStart(2, '0')}m`;
  return `${sign}${h}h${String(m).padStart(2, '0')}m`;
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export function nowISO() {
  return new Date().toISOString();
}
