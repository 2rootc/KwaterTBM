const teams = [
  { code: 'flow-meter', name: '유량계 현장교정', description: '유량계 현장교정 작업' },
  { code: 'water-meter', name: '수우량계 현장교정', description: '수우량계 현장교정 작업' },
  { code: 'calibration', name: '수질계측기 정도검사', description: '수질계측기 정도검사 작업' },
  { code: 'other', name: '기타작업', description: '기타 현장 작업' },
];

const checklistItems = [
  { key: 'risk-1', category: '위험인지', label: '① 금일 작업에 대한 위험요인과 안전대책에 대해 대화하고 숙지하였다. (위험성평가)' },
  { key: 'risk-2', category: '위험인지', label: '② 금일 작업(혹은 유사작업)에서 발생한 안전사고 발생 사례를 공유받았다.' },
  { key: 'risk-3', category: '위험인지', label: '③ 금일 작업 내용, 작업방법, 작업 물량(범위) 및 필요한 안전보호구를 잘 알고 있다.' },
  { key: 'safety-1', category: '개인안전', label: '① 음주, 발열, 약물복용 등으로 금일 작업에 적합한 건강상태인지 확인하였다.' },
  { key: 'safety-2', category: '개인안전', label: '② 개인보호구를 지급받고 점검하였다.' },
  { key: 'safety-3', category: '개인안전', label: '③ 현장 위험요인 및 불안전한 상태 발견시 멈추고, 확인하고, 생각한 후 작업하도록 하였다.' },
  { key: 'safety-4', category: '개인안전', label: '④ 비상시 행동요령을 숙지하였다.' },
  { key: 'tbm-1', category: '올바른 TBM 정착', label: '① TBM 중 작업자가 제기한 불만사항, 질문, 제안 사항을 검토하고 반영한지 확인하였다.' },
];

const screens = {
  entry: document.getElementById('screen-entry'),
  team: document.getElementById('screen-team'),
  form: document.getElementById('screen-form'),
  detail: document.getElementById('screen-detail'),
  logs: document.getElementById('screen-logs'),
};

const state = {
  employeeType: null,
  selectedTeam: null,
  activeMeetingId: null,
  currentScreen: 'entry',
  currentFormStep: 1,
  isAdmin: false,
  adminPassword: '',
  logFilter: 'all',
  meetings: normalizeMeetings(loadMeetings()),
};

const elements = {
  internalButton: document.getElementById('internalButton'),
  externalButton: document.getElementById('externalButton'),
  goToLogsButton: document.getElementById('goToLogsButton'),
  adminButton: document.getElementById('adminButton'),
  teamList: document.getElementById('teamList'),
  form: document.getElementById('tbmForm'),
  formErrorSummary: document.getElementById('formErrorSummary'),
  formStepTitle: document.getElementById('formStepTitle'),
  formProgressBar: document.getElementById('formProgressBar'),
  formProgressSteps: [...document.querySelectorAll('.form-progress-step')],
  formSteps: [...document.querySelectorAll('.form-step')],
  formPrevStepButton: document.getElementById('formPrevStepButton'),
  formNextStepButton: document.getElementById('formNextStepButton'),
  formTitle: document.getElementById('formTitle'),
  checklistContainer: document.getElementById('checklistContainer'),
  clearSignatureButton: document.getElementById('clearSignatureButton'),
  signaturePad: document.getElementById('signaturePad'),
  signatureModal: document.getElementById('signatureModal'),
  sigModalClose: document.getElementById('sigModalClose'),
  sigModalConfirm: document.getElementById('sigModalConfirm'),
  meetingDetail: document.getElementById('meetingDetail'),
  printPdfButton: document.getElementById('printPdfButton'),
  savePdfButton: document.getElementById('savePdfButton'),
  deleteMeetingButton: document.getElementById('deleteMeetingButton'),
  clearAllLogsButton: document.getElementById('clearAllLogsButton'),
  logFilterList: document.getElementById('logFilterList'),
  logList: document.getElementById('logList'),
};

const signature = setupSignaturePad(elements.signaturePad);
renderTeamOptions();
renderChecklist();
renderLogFilters();
renderLogList();
seedDefaultDate();
wireEvents();
updateAdminUi();
initializeNavigation();
goToFormStep(1);
persistMeetings();
syncMeetingsFromServer();

function wireEvents() {
  elements.internalButton.addEventListener('click', () => {
    state.employeeType = 'internal';
    showScreen('team');
  });

  elements.goToLogsButton.addEventListener('click', () => {
    renderLogList();
    showScreen('logs');
  });

  elements.adminButton.addEventListener('click', () => {
    toggleAdminMode();
  });

  document.querySelectorAll('[data-back]').forEach((button) => {
    button.addEventListener('click', () => showScreen(button.dataset.back));
  });

  elements.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitMeeting();
  });
  elements.formPrevStepButton.addEventListener('click', () => {
    goToFormStep(state.currentFormStep - 1);
  });
  elements.formNextStepButton.addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    if (state.currentFormStep === 2) {
      openSignatureModal();
      return;
    }
    goToFormStep(state.currentFormStep + 1);
  });

  elements.clearSignatureButton.addEventListener('click', () => {
    signature.clear();
  });

  elements.sigModalClose.addEventListener('click', () => {
    closeSignatureModal();
  });

  elements.sigModalConfirm.addEventListener('click', async () => {
    if (signature.isEmpty()) {
      window.alert('서명을 입력해 주세요.');
      return;
    }
    elements.signatureModal.classList.add('hidden');
    document.body.style.overflow = '';
    await submitMeeting();
  });

  elements.printPdfButton.addEventListener('click', () => {
    const meeting = getActiveMeeting();
    if (!meeting) return;
    if (meeting.serverPdfUrl) {
      window.open(meeting.serverPdfUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    openPrintWindow(meeting);
  });

  elements.savePdfButton.addEventListener('click', async () => {
    const meeting = getActiveMeeting();
    if (!meeting) return;
    await savePdf(meeting);
  });

  elements.deleteMeetingButton.addEventListener('click', async () => {
    const meeting = getActiveMeeting();
    if (!meeting) return;
    await deleteMeeting(meeting.id);
  });

  elements.clearAllLogsButton.addEventListener('click', async () => {
    await clearAllMeetings();
  });

  window.addEventListener('popstate', (event) => {
    const screen = event.state?.screen;
    if (!screen || !screens[screen]) {
      showScreen('entry', { pushHistory: false });
      return;
    }
    showScreen(screen, { pushHistory: false });
  });
}

function renderTeamOptions() {
  elements.teamList.innerHTML = '';
  teams.forEach((team) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'team-card';
    button.innerHTML = `<strong>${team.name}</strong><span>${team.description}</span>`;
    button.addEventListener('click', () => {
      state.selectedTeam = team;
      elements.formTitle.textContent = formatTeamTbmTitle(team.name);
      resetFormForNewMeeting(team);
      showScreen('form');
    });
    elements.teamList.appendChild(button);
  });
}

function formatTeamTbmTitle(teamName) {
  const shortNameMap = {
    '유량계 현장교정': '유량계',
    '수우량계 현장교정': '수우량계',
    '수질계측기 정도검사': '정도검사',
  };
  const shortName = shortNameMap[teamName] ?? teamName;
  return `(${shortName})TBM 시행`;
}

function renderLogFilters() {
  const filters = [{ code: 'all', name: '전체' }, ...teams.map((team) => ({ code: team.code, name: team.name }))];
  elements.logFilterList.innerHTML = '';

  filters.forEach((filter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ghost-button filter-button ${state.logFilter === filter.code ? 'active' : ''}`;
    button.textContent = filter.name;
    button.addEventListener('click', () => {
      state.logFilter = filter.code;
      renderLogFilters();
      renderLogList();
    });
    elements.logFilterList.appendChild(button);
  });
}

function renderChecklist(existingResponses = {}) {
  elements.checklistContainer.innerHTML = '';
  let activeCategory = '';

  checklistItems.forEach((item, index) => {
    if (item.category !== activeCategory) {
      activeCategory = item.category;
      const heading = document.createElement('div');
      heading.className = 'check-category';
      heading.innerHTML = `<strong>${item.category}</strong>`;
      elements.checklistContainer.appendChild(heading);
    }

    const response = existingResponses[item.key] ?? { status: 'yes', action: '' };
    const wrapper = document.createElement('div');
    wrapper.className = 'check-item detailed';
    wrapper.dataset.itemKey = item.key;
    wrapper.innerHTML = `
      <div class="check-copy">
        <strong>${index + 1}. ${item.label}</strong>
      </div>
      <div class="choice-row" role="radiogroup" aria-label="${item.label}">
        ${renderChoice(item.key, 'yes', '네', response.status === 'yes')}
        ${renderChoice(item.key, 'no', '아니요', response.status === 'no')}
        ${renderChoice(item.key, 'na', '해당없음', response.status === 'na')}
      </div>
      <label class="field action-field ${response.status === 'no' ? '' : 'hidden'}">
        <span>아니요인 경우 필요한 조치내용</span>
        <textarea data-action-for="${item.key}" rows="3" placeholder="필요한 조치내용을 입력하세요.">${escapeHtml(response.action ?? '')}</textarea>
      </label>
    `;

    wrapper.querySelectorAll(`input[name="${item.key}"]`).forEach((input) => {
      input.addEventListener('change', () => {
        const actionField = wrapper.querySelector('.action-field');
        const textarea = wrapper.querySelector('textarea');
        if (input.value === 'no' && input.checked) {
          actionField.classList.remove('hidden');
        } else if (input.checked) {
          actionField.classList.add('hidden');
          textarea.value = '';
        }
      });
    });

    elements.checklistContainer.appendChild(wrapper);
  });
}

function renderChoice(name, value, label, checked) {
  return `
    <label class="choice-pill">
      <input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}>
      <span>${label}</span>
    </label>
  `;
}

function seedDefaultDate() {
  const now = new Date();
  elements.form.workDate.value = now.toISOString().slice(0, 10);
  elements.form.workTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function resetFormForNewMeeting(team) {
  elements.form.reset();
  clearValidationErrors();
  renderChecklist();
  seedDefaultDate();
  signature.clear();
  state.activeMeetingId = null;
  goToFormStep(1);
  elements.form.workerName.focus();
  if (team) {
    elements.form.workerName.value = '';
  }
}


function collectChecklistResponses() {
  const responses = {};
  checklistItems.forEach((item) => {
    const checked = elements.form.querySelector(`input[name="${item.key}"]:checked`);
    const textarea = elements.form.querySelector(`textarea[data-action-for="${item.key}"]`);
    responses[item.key] = {
      category: item.category,
      label: item.label,
      status: checked ? checked.value : '',
      action: textarea ? textarea.value.trim() : '',
    };
  });
  return responses;
}

function collectFormData() {
  return {
    id: state.activeMeetingId ?? crypto.randomUUID(),
    employeeType: state.employeeType,
    teamCode: state.selectedTeam?.code ?? null,
    teamName: state.selectedTeam?.name ?? '-',
    workerName: elements.form.workerName.value.trim(),
    workDate: elements.form.workDate.value,
    workTime: elements.form.workTime.value,
    workName: elements.form.workName.value.trim(),
    workLocation: elements.form.workLocation.value.trim(),
    checklistResponses: collectChecklistResponses(),
    signatureDataUrl: signature.isEmpty() ? '' : signature.toDataURL(),
    status: 'draft',
    updatedAt: new Date().toISOString(),
  };
}

function validateMeeting(meeting) {
  clearValidationErrors();

  const issues = [];
  const requiredFields = [
    ['workerName', '이름을 입력해 주세요.', 1],
    ['workDate', '작업 날짜를 선택해 주세요.', 1],
    ['workTime', '작업 시간을 선택해 주세요.', 1],
    ['workName', '작업명을 입력해 주세요.', 1],
    ['workLocation', '작업위치를 입력해 주세요.', 1],
  ];

  requiredFields.forEach(([fieldName, message, step]) => {
    const input = elements.form[fieldName];
    if (!meeting[fieldName]) {
      markFieldError(input, message);
      issues.push({ element: input, message, step });
    }
  });

  const missingStatus = checklistItems.filter((item) => !meeting.checklistResponses[item.key]?.status);
  if (missingStatus.length > 0) {
    const firstMissing = elements.form.querySelector(`input[name="${missingStatus[0].key}"]`);
    markChecklistError(
      missingStatus.map((item) => item.key),
      '체크리스트 8개 항목 모두에 대해 네, 아니요, 해당없음 중 하나를 선택해 주세요.',
    );
    issues.push({ element: firstMissing, message: '체크리스트 응답이 누락되었습니다.', step: 2 });
  }

  const missingAction = checklistItems.find((item) => {
    const response = meeting.checklistResponses[item.key];
    return response?.status === 'no' && !response.action;
  });
  if (missingAction) {
    const textarea = elements.form.querySelector(`textarea[data-action-for="${missingAction.key}"]`);
    markFieldError(textarea?.closest('.action-field'), '아니요를 선택한 항목에는 필요한 조치내용을 입력해 주세요.');
    issues.push({ element: textarea, message: '조치내용이 비어 있는 항목이 있습니다.', step: 2 });
  }

  if (issues.length > 0) {
    if (issues[0].step) {
      goToFormStep(issues[0].step);
    }
    renderValidationSummary(issues);
    focusFirstError(issues[0].element);
    return false;
  }

  return true;
}

function validateCurrentStep() {
  const meeting = collectFormData();
  clearValidationErrors();
  const issues = [];

  if (state.currentFormStep === 1) {
    const requiredFields = [
      ['workerName', '이름을 입력해 주세요.'],
      ['workDate', '작업 날짜를 선택해 주세요.'],
      ['workTime', '작업 시간을 선택해 주세요.'],
      ['workName', '작업명을 입력해 주세요.'],
      ['workLocation', '작업위치를 입력해 주세요.'],
    ];

    requiredFields.forEach(([fieldName, message]) => {
      const input = elements.form[fieldName];
      if (!meeting[fieldName]) {
        markFieldError(input, message);
        issues.push({ element: input, message, step: 1 });
      }
    });
  }

  if (state.currentFormStep === 2) {
    const missingStatus = checklistItems.filter((item) => !meeting.checklistResponses[item.key]?.status);
    if (missingStatus.length > 0) {
      const firstMissing = elements.form.querySelector(`input[name="${missingStatus[0].key}"]`);
      markChecklistError(
        missingStatus.map((item) => item.key),
        '체크리스트 8개 항목 모두에 대해 네, 아니요, 해당없음 중 하나를 선택해 주세요.',
      );
      issues.push({ element: firstMissing, message: '체크리스트 응답이 누락되었습니다.', step: 2 });
    }

    const missingAction = checklistItems.find((item) => {
      const response = meeting.checklistResponses[item.key];
      return response?.status === 'no' && !response.action;
    });
    if (missingAction) {
      const textarea = elements.form.querySelector(`textarea[data-action-for="${missingAction.key}"]`);
      markFieldError(textarea?.closest('.action-field'), '아니요를 선택한 항목에는 필요한 조치내용을 입력해 주세요.');
      issues.push({ element: textarea, message: '조치내용이 비어 있는 항목이 있습니다.', step: 2 });
    }
  }

  if (issues.length > 0) {
    renderValidationSummary(issues);
    focusFirstError(issues[0].element);
    return false;
  }

  return true;
}

function saveMeeting(status = 'draft') {
  const meeting = collectFormData();
  if (status === 'submitted' && !validateMeeting(meeting)) {
    return null;
  }
  meeting.status = status;
  const existingIndex = state.meetings.findIndex((item) => item.id === meeting.id);
  if (existingIndex >= 0) {
    state.meetings[existingIndex] = { ...state.meetings[existingIndex], ...meeting };
  } else {
    state.meetings.unshift(meeting);
  }
  state.activeMeetingId = meeting.id;
  persistMeetings();
  renderLogList();
  return meeting;
}

async function submitMeeting() {
  if (!validateCurrentStep()) return;
  clearValidationErrors();
  const meeting = saveMeeting('submitted');
  if (!meeting) return;

  try {
    const serverResult = await submitMeetingToServer(meeting);
    const mergedMeeting = {
      ...meeting,
      serverPdfUrl: serverResult.pdfUrl,
      serverLogUrl: serverResult.logUrl,
      serverSavedAt: serverResult.savedAt,
    };
    upsertMeeting(mergedMeeting);
    renderMeetingDetail(mergedMeeting);
  } catch (error) {
    console.error(error);
    renderMeetingDetail(meeting, '서버 PDF 생성에는 실패했습니다. 로컬 기록은 저장되었고, 브라우저 인쇄로 PDF 저장은 가능합니다.');
  }

  showScreen('detail');
}

function goToFormStep(step) {
  const nextStep = Math.max(1, Math.min(2, step));
  state.currentFormStep = nextStep;

  elements.formSteps.forEach((section) => {
    section.classList.toggle('is-active', Number(section.dataset.step) === nextStep);
  });
  elements.formProgressSteps.forEach((stepElement, index) => {
    const stepNumber = index + 1;
    stepElement.classList.toggle('is-active', stepNumber === nextStep);
    stepElement.classList.toggle('is-complete', stepNumber < nextStep);
  });

  elements.formProgressBar.style.width = `${((nextStep - 1) / 1) * 100}%`;
  elements.formPrevStepButton.disabled = nextStep === 1;
  elements.formNextStepButton.textContent = nextStep === 2 ? '서명 및 제출' : '다음';

  if (nextStep === 1) {
    elements.formStepTitle.textContent = '기본 정보를 먼저 입력하세요.';
  } else {
    elements.formStepTitle.textContent = '체크리스트 8개 항목을 빠짐없이 선택하세요.';
  }
}

function clearValidationErrors() {
  elements.formErrorSummary.textContent = '';
  elements.formErrorSummary.classList.add('hidden');

  elements.form.querySelectorAll('.has-error').forEach((node) => node.classList.remove('has-error'));
  elements.form.querySelectorAll('.field-error-text').forEach((node) => node.remove());
}

function markFieldError(target, message) {
  if (!target) return;

  const container = target.matches?.('.field, .action-field') ? target : target.closest?.('.field, .action-field');
  if (!container) return;

  container.classList.add('has-error');
  const messageNode = document.createElement('p');
  messageNode.className = 'field-error-text';
  messageNode.textContent = message;
  container.appendChild(messageNode);
}

function markChecklistError(itemKeys, message) {
  itemKeys.forEach((key) => {
    const wrapper = elements.checklistContainer.querySelector(`[data-item-key="${key}"]`);
    if (wrapper) {
      wrapper.classList.add('has-error');
      wrapper.querySelectorAll('.choice-pill').forEach((pill) => pill.classList.add('has-error'));
    }
  });

  const checklistCard = elements.checklistContainer.closest('.card');
  if (checklistCard) {
    const messageNode = document.createElement('p');
    messageNode.className = 'field-error-text';
    messageNode.textContent = message;
    checklistCard.appendChild(messageNode);
  }
}


function renderValidationSummary(issues) {
  const uniqueMessages = [...new Set(issues.map((issue) => issue.message))];
  elements.formErrorSummary.innerHTML = `입력 확인이 필요합니다. ${uniqueMessages.join(' ')}`;
  elements.formErrorSummary.classList.remove('hidden');
}

function focusFirstError(target) {
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (typeof target.focus === 'function') {
    target.focus({ preventScroll: true });
  }
}

async function submitMeetingToServer(meeting) {
  const response = await fetch('/api/meetings/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meeting),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'server submit failed');
  }
  return response.json();
}

async function syncMeetingsFromServer() {
  try {
    const response = await fetch('/api/meetings');
    if (!response.ok) {
      throw new Error(`server meetings sync failed: ${response.status}`);
    }

    const result = await response.json();
    const serverMeetings = normalizeMeetings((result.meetings ?? []).map((meeting) => ({
      ...meeting,
      serverPdfUrl: meeting.pdfUrl ?? (meeting.pdfFile ? `/storage/pdfs/${meeting.pdfFile}` : ''),
      serverLogUrl: meeting.logUrl ?? (meeting.id ? `/storage/logs/${meeting.id}.json` : ''),
      serverSavedAt: meeting.savedAt ?? '',
    })));

    // Server is the source of truth — replace local state entirely
    state.meetings = serverMeetings;
    persistMeetings();
    renderLogList();

    const activeMeeting = getActiveMeeting();
    if (activeMeeting && state.currentScreen === 'detail') {
      renderMeetingDetail(activeMeeting);
    }
  } catch (error) {
    console.error(error);
  }
}

async function deleteMeetingOnServer(meetingId) {
  const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Password': state.adminPassword },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'server delete failed');
  }
  return response.json();
}

async function verifyAdminPassword(password) {
  const response = await fetch('/api/admin/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'admin verify failed');
  }

  return response.json();
}

function upsertMeeting(meeting) {
  const existingIndex = state.meetings.findIndex((item) => item.id === meeting.id);
  if (existingIndex >= 0) {
    state.meetings[existingIndex] = meeting;
  } else {
    state.meetings.unshift(meeting);
  }
  state.activeMeetingId = meeting.id;
  persistMeetings();
  renderLogList();
}

async function deleteMeeting(meetingId) {
  if (!requireAdminAccess()) return;
  const meeting = state.meetings.find((item) => item.id === meetingId);
  if (!meeting) return;

  const confirmed = window.confirm('이 로그를 삭제할까요? 서버에 저장된 PDF와 JSON도 함께 삭제됩니다.');
  if (!confirmed) return;

  state.meetings = state.meetings.filter((item) => item.id !== meetingId);
  if (state.activeMeetingId === meetingId) {
    state.activeMeetingId = null;
  }
  persistMeetings();
  renderLogList();
  showScreen('logs');

  try {
    await deleteMeetingOnServer(meetingId);
  } catch (error) {
    console.error(error);
    window.alert('로컬 로그는 삭제했지만 서버 저장 파일 삭제는 실패했습니다. 다시 시도해 주세요.');
  }
}

async function clearAllMeetings() {
  if (!requireAdminAccess()) return;
  if (state.meetings.length === 0) {
    window.alert('삭제할 로그가 없습니다.');
    return;
  }

  const confirmed = window.confirm('저장된 로그를 전체 삭제할까요? 서버에 저장된 PDF와 JSON도 함께 삭제됩니다.');
  if (!confirmed) return;

  const meetingsToDelete = [...state.meetings];
  state.meetings = [];
  state.activeMeetingId = null;
  persistMeetings();
  renderLogList();

  let serverDeleteFailed = false;
  for (const meeting of meetingsToDelete) {
    try {
      await deleteMeetingOnServer(meeting.id);
    } catch (error) {
      console.error(error);
      serverDeleteFailed = true;
    }
  }

  if (serverDeleteFailed) {
    window.alert('로컬 로그는 전체 삭제했지만 일부 서버 저장 파일 삭제는 실패했습니다. 다시 시도해 주세요.');
  }
}

function renderMeetingDetail(meeting, warning = '') {
  const warningHtml = warning
    ? `<div class="card subtle-card"><p style="color: var(--danger); margin: 0;">${escapeHtml(warning)}</p></div>`
    : '';

  const infoHtml = `
    <div class="card subtle-card stack-md">
      <div>
        <p class="section-label">기본 정보</p>
        <div class="field-grid">
          <div class="field"><span>이름</span><p>${escapeHtml(meeting.workerName || '-')}</p></div>
          <div class="field"><span>날짜</span><p>${escapeHtml(meeting.workDate || '-')}</p></div>
          <div class="field"><span>시간</span><p>${escapeHtml(meeting.workTime || '-')}</p></div>
          <div class="field field-full"><span>작업명</span><p>${escapeHtml(meeting.workName || '-')}</p></div>
          <div class="field field-full"><span>작업위치</span><p>${escapeHtml(meeting.workLocation || '-')}</p></div>
          <div class="field"><span>팀</span><p>${escapeHtml(meeting.teamName || '-')}</p></div>
        </div>
      </div>
      <div>
        <p class="section-label">체크리스트</p>
        ${meeting.checklistResponses ? renderChecklistSummary(meeting.checklistResponses) : '<p class="muted">체크리스트 데이터 없음</p>'}
      </div>
      ${meeting.signatureDataUrl ? `<div><p class="section-label">서명</p><img src="${meeting.signatureDataUrl}" alt="서명" style="max-width:200px; border:1px solid var(--border);border-radius:8px;padding:8px;"></div>` : ''}
    </div>
  `;

  elements.meetingDetail.innerHTML = warningHtml + infoHtml;
  elements.printPdfButton.textContent = meeting.serverPdfUrl ? 'PDF열기' : 'PDF 미리보기';
  elements.savePdfButton.disabled = !meeting.serverPdfUrl;
  elements.deleteMeetingButton.style.display = state.isAdmin ? '' : 'none';
}

function renderChecklistSummary(responses) {
  return checklistItems.map((item) => {
    const response = responses[item.key] ?? { status: '', action: '' };
    const statusLabel = mapStatusLabel(response.status);
    return `
      <div class="check-summary-row">
        <strong>${escapeHtml(item.label)}</strong>
        <div class="check-summary-meta">
          <span class="summary-badge">${statusLabel}</span>
          ${response.status === 'no' && response.action ? `<p>조치내용: ${escapeHtml(response.action)}</p>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderLogList() {
  const visibleMeetings = state.logFilter === 'all'
    ? state.meetings
    : state.meetings.filter((meeting) => meeting.teamCode === state.logFilter);

  if (visibleMeetings.length === 0) {
    elements.logList.innerHTML = '<div class="empty-state">아직 저장된 TBM 로그가 없습니다.</div>';
    return;
  }
  elements.logList.innerHTML = '';
  visibleMeetings.forEach((meeting) => {
    const card = document.createElement('article');
    card.className = 'log-card';
    card.innerHTML = `
      <strong>${escapeHtml(meeting.workName)}(${escapeHtml(meeting.workLocation)})</strong>
      <p class="muted">${escapeHtml(meeting.workDate)} ${escapeHtml(meeting.workTime || '-')} · ${escapeHtml(meeting.workerName)}</p>
      <div class="log-actions">
        <button class="ghost-button" type="button" data-view="${meeting.id}">상세 보기</button>
        <button class="ghost-button" type="button" data-print="${meeting.id}">${meeting.serverPdfUrl ? 'PDF 열기' : 'PDF로 저장'}</button>
        <button class="ghost-button ghost-danger" type="button" data-delete="${meeting.id}" style="${state.isAdmin ? '' : 'display:none'}">삭제</button>
      </div>
    `;
    card.querySelector('[data-view]').addEventListener('click', () => {
      state.activeMeetingId = meeting.id;
      renderMeetingDetail(meeting);
      showScreen('detail');
    });
    card.querySelector('[data-print]').addEventListener('click', () => {
      if (meeting.serverPdfUrl) {
        window.open(meeting.serverPdfUrl, '_blank', 'noopener,noreferrer');
      } else {
        openPrintWindow(meeting);
      }
    });
    card.querySelector('[data-delete]').addEventListener('click', async () => {
      await deleteMeeting(meeting.id);
    });
    elements.logList.appendChild(card);
  });
}

function openPrintWindow(meeting) {
  const template = document.getElementById('printTemplate');
  const fragment = template.content.cloneNode(true);
  fragment.querySelector('.print-date').textContent = meeting.workDate;
  const grid = fragment.querySelector('.print-grid');
  [
    ['직원 구분', meeting.employeeType === 'internal' ? '내부직원' : meeting.employeeType],
    ['팀', meeting.teamName],
    ['이름', meeting.workerName],
    ['작업명', meeting.workName],
    ['작업위치', meeting.workLocation],
    ['저장 시각', formatDateTime(meeting.updatedAt)],
  ].forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `<strong>${escapeHtml(label)}</strong><div>${escapeHtml(value)}</div>`;
    grid.appendChild(item);
  });

  const checklist = fragment.querySelector('.print-checklist');
  checklistItems.forEach((item) => {
    const response = meeting.checklistResponses[item.key] ?? { status: '', action: '' };
    const row = document.createElement('div');
    row.className = `print-checklist-row status-${response.status || 'empty'}`;
    row.innerHTML = `
      <span>${escapeHtml(item.label)}</span>
      <span class="cell-yes">${response.status === 'yes' ? '●' : ''}</span>
      <span class="cell-no">${response.status === 'no' ? '●' : ''}</span>
      <span class="cell-na">${response.status === 'na' ? '●' : ''}</span>
      <span>${response.status === 'no' ? escapeHtml(response.action || '-') : '-'}</span>
    `;
    checklist.appendChild(row);
  });

  fragment.querySelector('.signature-image').src = meeting.signatureDataUrl;

  const printWindow = window.open('', '_blank', 'width=900,height=1200');
  if (!printWindow) {
    window.alert('팝업이 차단되어 인쇄 창을 열 수 없습니다.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <title>TBM PDF Preview</title>
        <link rel="stylesheet" href="${location.origin}${location.pathname.replace(/index\.html$/, '')}styles.css">
      </head>
      <body></body>
    </html>
  `);
  printWindow.document.body.appendChild(fragment);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
}

function downloadJson(meeting) {
  const blob = new Blob([JSON.stringify(meeting, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tbm-log-${meeting.workDate}-${meeting.teamCode}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildPdfFileName(meeting) {
  const teamShortName = {
    'flow-meter': '(유량계)',
    'water-meter': '(수우량계)',
    'calibration': '(정도검사)',
    'other': '(기타)',
  };
  const prefix = teamShortName[meeting.teamCode] || '';
  const workLocation = meeting.workLocation || 'TBM';
  const date = meeting.workDate || '';
  return `${prefix}${workLocation}_${date}.pdf`;
}

async function savePdf(meeting) {
  if (!meeting.serverPdfUrl) {
    window.alert('서버에서 생성된 PDF가 있을 때만 바로 저장할 수 있습니다.');
    return;
  }

  const suggestedName = buildPdfFileName(meeting);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    // 모바일: 새 탭에서 PDF를 열어서 브라우저 기본 저장/공유 기능 사용
    window.open(meeting.serverPdfUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    const response = await fetch(meeting.serverPdfUrl);
    if (!response.ok) {
      window.alert('PDF 파일을 불러오지 못했습니다.');
      return;
    }

    const blob = await response.blob();

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: 'PDF 파일', accept: { 'application/pdf': ['.pdf'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (error) {
        if (error?.name === 'AbortError') {
          return;
        }
        console.error(error);
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    window.alert('PDF 저장 중 네트워크 오류가 발생했습니다. 서버 연결 상태를 확인한 뒤 다시 시도해 주세요.');
  }
}

function getActiveMeeting() {
  return state.meetings.find((meeting) => meeting.id === state.activeMeetingId) ?? null;
}

function persistMeetings() {
  localStorage.setItem('tbm-meetings', JSON.stringify(state.meetings));
}

function loadMeetings() {
  try {
    return JSON.parse(localStorage.getItem('tbm-meetings') ?? '[]');
  } catch {
    return [];
  }
}

function normalizeMeetings(meetings) {
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

function mergeMeetings(primaryMeetings, secondaryMeetings) {
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

function getMeetingTimestamp(meeting) {
  const value = meeting.updatedAt || meeting.serverSavedAt || '';
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function summarizeChecklist(responses) {
  return checklistItems.reduce((acc, item) => {
    const status = responses?.[item.key]?.status;
    if (status === 'yes') acc.yes += 1;
    if (status === 'no') acc.no += 1;
    if (status === 'na') acc.na += 1;
    return acc;
  }, { yes: 0, no: 0, na: 0 });
}

function mapStatusLabel(status) {
  if (status === 'yes') return '네';
  if (status === 'no') return '아니요';
  if (status === 'na') return '해당없음';
  return '미입력';
}

function initializeNavigation() {
  const screen = history.state?.screen;
  if (screen && screens[screen]) {
    showScreen(screen, { pushHistory: false });
    return;
  }
  history.replaceState({ screen: state.currentScreen }, '');
}

function showScreen(name, options = {}) {
  const { pushHistory = true } = options;
  state.currentScreen = name;
  Object.entries(screens).forEach(([key, screen]) => {
    screen.classList.toggle('active', key === name);
  });
  if (pushHistory) {
    history.pushState({ screen: name }, '');
  }
}

function toggleAdminMode() {
  if (state.isAdmin) {
    state.isAdmin = false;
    state.adminPassword = '';
    updateAdminUi();
    renderLogList();
    const meeting = getActiveMeeting();
    if (meeting) {
      renderMeetingDetail(meeting);
    }
    return;
  }

  const password = window.prompt('관리자 비밀번호를 입력하세요.');
  if (password === null) return;

  verifyAdminPassword(password)
    .then(() => {
      state.isAdmin = true;
      state.adminPassword = password;
      updateAdminUi();
      renderLogList();
      const meeting = getActiveMeeting();
      if (meeting) {
        renderMeetingDetail(meeting);
      }
    })
    .catch((error) => {
      console.error(error);
      window.alert('비밀번호가 올바르지 않습니다.');
    });
}

function updateAdminUi() {
  elements.adminButton.textContent = state.isAdmin ? '🔓 관리자' : '🔒 관리자';
  elements.adminButton.setAttribute('aria-label', state.isAdmin ? '관리자 활성화' : '관리자 잠금');
  elements.adminButton.classList.toggle('admin-active', state.isAdmin);
  elements.deleteMeetingButton.style.display = state.isAdmin ? '' : 'none';
  elements.clearAllLogsButton.style.display = state.isAdmin ? '' : 'none';
}

function requireAdminAccess() {
  if (state.isAdmin) return true;
  window.alert('삭제 기능은 관리자 권한 활성화 후 사용할 수 있습니다.');
  return false;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setupSignaturePad(canvas) {
  const context = canvas.getContext('2d');
  let drawing = false;
  let hasStroke = false;

  function initContext() {
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 5;
    context.strokeStyle = '#111111';
  }
  initContext();

  const getPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    const source = event.touches?.[0] ?? event;
    return {
      x: ((source.clientX - rect.left) / rect.width) * canvas.width,
      y: ((source.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (event) => {
    event.preventDefault();
    const point = getPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    drawing = true;
  };

  const move = (event) => {
    if (!drawing) return;
    event.preventDefault();
    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    hasStroke = true;
  };

  const end = () => {
    drawing = false;
    context.closePath();
  };

  canvas.addEventListener('pointerdown', start, { passive: false });
  canvas.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', end);

  return {
    clear() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      hasStroke = false;
    },
    isEmpty() {
      return !hasStroke;
    },
    toDataURL() {
      return canvas.toDataURL('image/png');
    },
    resize() {
      const body = canvas.closest('.sig-modal-body');
      if (!body) return;
      const saved = hasStroke ? canvas.toDataURL() : null;
      canvas.width = body.clientWidth - 16;
      canvas.height = body.clientHeight - 16;
      initContext();
      if (saved) {
        const img = new Image();
        img.onload = () => {
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          hasStroke = true;
        };
        img.src = saved;
      }
    },
  };
}

let _savedSignatureDataUrl = '';

function openSignatureModal() {
  _savedSignatureDataUrl = signature.isEmpty() ? '' : signature.toDataURL();
  elements.signatureModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  signature.resize();
}

function closeSignatureModal() {
  elements.signatureModal.classList.add('hidden');
  document.body.style.overflow = '';
  // Restore previous signature on cancel
  if (_savedSignatureDataUrl) {
    signature.clear();
    const img = new Image();
    img.onload = () => {
      const canvas = elements.signaturePad;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = _savedSignatureDataUrl;
  } else {
    signature.clear();
  }
}
