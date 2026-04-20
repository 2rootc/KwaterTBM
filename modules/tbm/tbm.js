import { escapeHtml, formatDateTime, generateMeetingId } from '../../shared/utils.js';
import { persistMeetings, normalizeMeetings } from '../../shared/storage.js';
import { saveLastInput, applyAutofill } from '../../shared/autofill.js';

export const teams = [
  { code: 'flow-meter', name: '유량계 현장교정', description: '유량계 현장교정 작업' },
  { code: 'water-meter', name: '수우량계 현장교정', description: '수우량계 현장교정 작업' },
  { code: 'calibration', name: '수질계측기 정도검사', description: '수질계측기 정도검사 작업' },
  { code: 'other', name: '기타작업', description: '기타 현장 작업' },
];

export const checklistItems = [
  { key: 'risk-1', category: '위험인지', label: '① 금일 작업에 대한 위험요인과 안전대책에 대해 대화하고 숙지하였다. (위험성평가)' },
  { key: 'risk-2', category: '위험인지', label: '② 금일 작업(혹은 유사작업)에서 발생한 안전사고 발생 사례를 공유받았다.' },
  { key: 'risk-3', category: '위험인지', label: '③ 금일 작업 내용, 작업방법, 작업 물량(범위) 및 필요한 안전보호구를 잘 알고 있다.' },
  { key: 'safety-1', category: '개인안전', label: '① 음주, 발열, 약물복용 등으로 금일 작업에 적합한 건강상태인지 확인하였다.' },
  { key: 'safety-2', category: '개인안전', label: '② 개인보호구를 지급받고 점검하였다.' },
  { key: 'safety-3', category: '개인안전', label: '③ 현장 위험요인 및 불안전한 상태 발견시 멈추고, 확인하고, 생각한 후 작업하도록 하였다.' },
  { key: 'safety-4', category: '개인안전', label: '④ 비상시 행동요령을 숙지하였다.' },
  { key: 'tbm-1', category: '올바른 TBM 정착', label: '① TBM 중 작업자가 제기한 불만사항, 질문, 제안 사항을 검토하고 반영한지 확인하였다.' },
];

export function initTbm(app) {
  const { state, elements, signature, signatureModal, showScreen, admin } = app;

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
    const shortFilterName = {
      'flow-meter': '유량계',
      'water-meter': '수우량계',
      'calibration': '정도검사',
      'other': '기타',
    };
    const filters = [{ code: 'all', name: '전체' }, ...teams.map((team) => ({ code: team.code, name: shortFilterName[team.code] ?? team.name }))];
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
    applyAutofill(elements.form);
    elements.form.workerName.focus();
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
      id: state.activeMeetingId ?? generateMeetingId(),
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
    persistMeetings(state.meetings);
    renderLogList();

    if (status === 'submitted') {
      saveLastInput({ workerName: meeting.workerName, workLocation: meeting.workLocation });
    }

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
    } catch (error) {
      console.error(error);
      window.alert('서버 PDF 생성에는 실패했습니다. 로컬 기록은 저장되었고, 브라우저 인쇄로 PDF 저장은 가능합니다.');
    }

    showScreen('logs');
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
      })), checklistItems);

      state.meetings = serverMeetings;
      persistMeetings(state.meetings);
      renderLogList();
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

  function upsertMeeting(meeting) {
    const existingIndex = state.meetings.findIndex((item) => item.id === meeting.id);
    if (existingIndex >= 0) {
      state.meetings[existingIndex] = meeting;
    } else {
      state.meetings.unshift(meeting);
    }
    state.activeMeetingId = meeting.id;
    persistMeetings(state.meetings);
    renderLogList();
  }

  async function deleteMeeting(meetingId) {
    if (!admin.requireAdminAccess()) return;
    const meeting = state.meetings.find((item) => item.id === meetingId);
    if (!meeting) return;

    const confirmed = window.confirm('이 로그를 삭제할까요? 서버에 저장된 PDF와 JSON도 함께 삭제됩니다.');
    if (!confirmed) return;

    state.meetings = state.meetings.filter((item) => item.id !== meetingId);
    if (state.activeMeetingId === meetingId) {
      state.activeMeetingId = null;
    }
    persistMeetings(state.meetings);
    renderLogList();
    showScreen('logs');

    try {
      await deleteMeetingOnServer(meetingId);
    } catch (error) {
      console.error(error);
      window.alert('로컬 로그는 삭제했지만 서버 저장 파일 삭제는 실패했습니다. 다시 시도해 주세요.');
    }
  }

  function renderLogList() {
    const visibleMeetings = state.logFilter === 'all'
      ? state.meetings
      : state.meetings.filter((meeting) => meeting.teamCode === state.logFilter);

    updateSelectBarUi(visibleMeetings);

    if (visibleMeetings.length === 0) {
      elements.logList.innerHTML = '<div class="empty-state">아직 저장된 TBM 로그가 없습니다.</div>';
      return;
    }
    elements.logList.innerHTML = '';
    visibleMeetings.forEach((meeting) => {
      const row = document.createElement('article');
      row.className = `log-row${state.logSelectMode ? ' log-row-selectable' : ''}`;
      const checked = state.logSelectedIds.has(meeting.id);
      row.innerHTML = `
        ${state.logSelectMode ? `<label class="log-row-check"><input type="checkbox" data-select="${meeting.id}" ${checked ? 'checked' : ''}></label>` : ''}
        <div class="log-row-info">
          <strong>${escapeHtml(meeting.workName || '-')}(${escapeHtml(meeting.workLocation || '-')})</strong>
          <span class="muted">${escapeHtml(meeting.workDate)} · ${escapeHtml(meeting.workerName || '-')}</span>
        </div>
        <div class="log-row-actions">
          <button class="ghost-button" type="button" data-print="${meeting.id}">PDF 열기</button>
        </div>
      `;
      row.querySelector('[data-print]').addEventListener('click', () => {
        if (meeting.serverPdfUrl) {
          window.open(meeting.serverPdfUrl, '_blank', 'noopener,noreferrer');
        } else {
          openPrintWindow(meeting);
        }
      });
      row.querySelector('[data-select]')?.addEventListener('change', (event) => {
        if (event.target.checked) {
          state.logSelectedIds.add(meeting.id);
        } else {
          state.logSelectedIds.delete(meeting.id);
        }
        updateSelectBarUi(visibleMeetings);
      });
      elements.logList.appendChild(row);
    });
  }

  function updateSelectBarUi(visibleMeetings) {
    const bar = elements.logSelectBar;
    if (!bar) return;
    if (!state.isAdmin && state.logSelectMode) {
      state.logSelectMode = false;
      state.logSelectedIds = new Set();
    }
    bar.classList.toggle('hidden', !state.logSelectMode);
    elements.clearAllLogsButton.textContent = state.logSelectMode ? '삭제 모드' : '삭제하기';
    elements.clearAllLogsButton.disabled = state.logSelectMode;
    if (!state.logSelectMode) return;

    const visibleIds = visibleMeetings.map((m) => m.id);
    const selectedVisibleCount = visibleIds.filter((id) => state.logSelectedIds.has(id)).length;
    elements.logSelectAllCheckbox.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
    elements.logSelectDeleteButton.textContent = `선택 삭제${state.logSelectedIds.size ? ` (${state.logSelectedIds.size})` : ''}`;
    elements.logSelectDeleteButton.disabled = state.logSelectedIds.size === 0;
  }

  function enterSelectMode() {
    if (!admin.requireAdminAccess()) return;
    if (state.meetings.length === 0) {
      window.alert('삭제할 로그가 없습니다.');
      return;
    }
    state.logSelectMode = true;
    state.logSelectedIds = new Set();
    renderLogList();
  }

  function exitSelectMode() {
    state.logSelectMode = false;
    state.logSelectedIds = new Set();
    renderLogList();
  }

  async function deleteSelectedMeetings() {
    if (!admin.requireAdminAccess()) return;
    const ids = [...state.logSelectedIds];
    if (ids.length === 0) return;

    const confirmed = window.confirm(`선택한 ${ids.length}건을 삭제할까요? 서버에 저장된 PDF와 JSON도 함께 삭제됩니다.`);
    if (!confirmed) return;

    state.meetings = state.meetings.filter((meeting) => !state.logSelectedIds.has(meeting.id));
    if (state.logSelectedIds.has(state.activeMeetingId)) {
      state.activeMeetingId = null;
    }
    persistMeetings(state.meetings);
    exitSelectMode();

    let serverDeleteFailed = false;
    for (const id of ids) {
      try {
        await deleteMeetingOnServer(id);
      } catch (error) {
        console.error(error);
        serverDeleteFailed = true;
      }
    }
    if (serverDeleteFailed) {
      window.alert('로컬 로그는 삭제했지만 일부 서버 저장 파일 삭제는 실패했습니다. 다시 시도해 주세요.');
    }
  }

  function openPrintWindow(meeting) {
    const template = document.getElementById('printTemplate');
    const fragment = template.content.cloneNode(true);
    fragment.querySelector('.print-date').textContent = meeting.workDate;
    const grid = fragment.querySelector('.print-grid');
    [
      ['직원 구분', meeting.employeeType === 'internal' ? '내부직원' : meeting.employeeType === 'external' ? '외부인력' : (meeting.employeeType ?? '-')],
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

  function getActiveMeeting() {
    return state.meetings.find((meeting) => meeting.id === state.activeMeetingId) ?? null;
  }

  // --- Event wiring ---

  elements.tbmButton.addEventListener('click', () => {
    state.employeeType = null;
    state.workType = 'tbm';
    showScreen('employeeType');
  });

  elements.employeeInternalButton.addEventListener('click', () => {
    state.employeeType = 'internal';
    elements.formBackButton.dataset.back = 'team';
    showScreen('team');
  });

  elements.employeeExternalButton.addEventListener('click', () => {
    state.employeeType = 'external';
    state.selectedTeam = null;
    elements.formTitle.textContent = '(외부인력)TBM 시행';
    elements.formBackButton.dataset.back = 'employeeType';
    resetFormForNewMeeting(null);
    showScreen('form');
  });

  elements.goToLogsButton.addEventListener('click', () => {
    renderLogList();
    showScreen('logs');
  });

  elements.adminButton.addEventListener('click', () => {
    admin.toggleAdminMode();
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
      signatureModal.open();
      return;
    }
    goToFormStep(state.currentFormStep + 1);
  });

  elements.clearSignatureButton.addEventListener('click', () => {
    signature.clear();
  });

  elements.sigModalClose.addEventListener('click', () => {
    signatureModal.close();
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

  elements.clearAllLogsButton.addEventListener('click', () => {
    enterSelectMode();
  });

  elements.logSelectCancelButton.addEventListener('click', () => {
    exitSelectMode();
  });

  elements.logSelectDeleteButton.addEventListener('click', async () => {
    await deleteSelectedMeetings();
  });

  elements.logSelectAllCheckbox.addEventListener('change', (event) => {
    const visibleMeetings = state.logFilter === 'all'
      ? state.meetings
      : state.meetings.filter((meeting) => meeting.teamCode === state.logFilter);
    if (event.target.checked) {
      visibleMeetings.forEach((meeting) => state.logSelectedIds.add(meeting.id));
    } else {
      visibleMeetings.forEach((meeting) => state.logSelectedIds.delete(meeting.id));
    }
    renderLogList();
  });

  // --- Initial render ---

  renderTeamOptions();
  renderChecklist();
  renderLogFilters();
  renderLogList();
  seedDefaultDate();
  goToFormStep(1);
  syncMeetingsFromServer();

  return {
    getActiveMeeting,
    renderLogList,
  };
}
