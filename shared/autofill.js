const AUTOFILL_KEY = 'autofill-last';

export function saveLastInput(data) {
  const saved = { workerName: data.workerName, workLocation: data.workLocation };
  localStorage.setItem(AUTOFILL_KEY, JSON.stringify(saved));
}

export function loadLastInput() {
  try {
    return JSON.parse(localStorage.getItem(AUTOFILL_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function applyAutofill(form) {
  const last = loadLastInput();
  if (last.workerName && form.workerName && !form.workerName.value) {
    form.workerName.value = last.workerName;
  }
  if (last.workLocation && form.workLocation && !form.workLocation.value) {
    form.workLocation.value = last.workLocation;
  }
}
