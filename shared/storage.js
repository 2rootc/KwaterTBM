const STORAGE_KEY = 'tbm-meetings';

export function persistMeetings(meetings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
}

export function loadMeetings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function normalizeMeetings(meetings, checklistItems) {
  return meetings.map((meeting) => {
    const normalizedTime = meeting.workTime || (meeting.updatedAt ? new Date(meeting.updatedAt).toTimeString().slice(0, 5) : '');
    const serverPdfUrl = meeting.serverPdfUrl || meeting.pdfUrl || (meeting.pdfFile ? `/storage/pdfs/${meeting.pdfFile}` : '');
    const serverLogUrl = meeting.serverLogUrl || meeting.logUrl || (meeting.id ? `/storage/logs/${meeting.id}.json` : '');
    if (meeting.checklistResponses) {
      return { ...meeting, workTime: normalizedTime, serverPdfUrl, serverLogUrl };
    }
    const legacyChecked = Array.isArray(meeting.checklist) ? meeting.checklist : [];
    const checklistResponses = {};
    checklistItems.forEach((item) => {
      checklistResponses[item.key] = {
        category: item.category,
        label: item.label,
        status: legacyChecked.length ? (legacyChecked.includes(item.label) ? 'yes' : '') : '',
        action: '',
      };
    });
    return { ...meeting, workTime: normalizedTime, checklistResponses, serverPdfUrl, serverLogUrl };
  });
}

export function mergeMeetings(primaryMeetings, secondaryMeetings) {
  const merged = new Map();
  [...secondaryMeetings, ...primaryMeetings].forEach((meeting) => {
    const existing = merged.get(meeting.id);
    if (!existing) {
      merged.set(meeting.id, meeting);
      return;
    }

    const existingTimestamp = getMeetingTimestamp(existing);
    const candidateTimestamp = getMeetingTimestamp(meeting);
    merged.set(meeting.id, candidateTimestamp >= existingTimestamp ? { ...existing, ...meeting } : { ...meeting, ...existing });
  });

  return [...merged.values()].sort((left, right) => getMeetingTimestamp(right) - getMeetingTimestamp(left));
}

export function getMeetingTimestamp(meeting) {
  const value = meeting.updatedAt || meeting.serverSavedAt || '';
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

export function summarizeChecklist(responses, checklistItems) {
  return checklistItems.reduce((acc, item) => {
    const status = responses?.[item.key]?.status;
    if (status === 'yes') acc.yes += 1;
    if (status === 'no') acc.no += 1;
    if (status === 'na') acc.na += 1;
    return acc;
  }, { yes: 0, no: 0, na: 0 });
}
