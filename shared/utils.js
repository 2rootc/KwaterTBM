export function formatDateTime(value) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function mapStatusLabel(status) {
  if (status === 'yes') return '네';
  if (status === 'no') return '아니요';
  if (status === 'na') return '해당없음';
  return '미입력';
}

export function generateMeetingId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `meeting-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
