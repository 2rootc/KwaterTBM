import { loadMeetings } from './shared/storage.js';
import { normalizeMeetings } from './shared/storage.js';
import { setupSignaturePad, createSignatureModal } from './shared/signature.js';
import { createAdmin } from './shared/auth.js';
import { initTbm, checklistItems } from './modules/tbm/tbm.js';

const screens = {
  entry: document.getElementById('screen-entry'),
  employeeType: document.getElementById('screen-employee-type'),
  team: document.getElementById('screen-team'),
  form: document.getElementById('screen-form'),
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
  logSelectMode: false,
  logSelectedIds: new Set(),
  meetings: normalizeMeetings(loadMeetings(), checklistItems),
};

const elements = {
  heroCopy: document.querySelector('.hero-copy'),
  heroTitlePrimary: document.querySelector('.hero-title-line-primary'),
  heroTitleLines: [...document.querySelectorAll('.hero-title-line')],
  tbmButton: document.getElementById('tbmButton'),
  employeeInternalButton: document.getElementById('employeeInternalButton'),
  employeeExternalButton: document.getElementById('employeeExternalButton'),
  formBackButton: document.getElementById('formBackButton'),
  permitButton: document.getElementById('permitButton'),
  preCheckButton: document.getElementById('preCheckButton'),
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
  clearAllLogsButton: document.getElementById('clearAllLogsButton'),
  logSelectBar: document.getElementById('logSelectBar'),
  logSelectAllCheckbox: document.getElementById('logSelectAllCheckbox'),
  logSelectDeleteButton: document.getElementById('logSelectDeleteButton'),
  logSelectCancelButton: document.getElementById('logSelectCancelButton'),
  logFilterList: document.getElementById('logFilterList'),
  logList: document.getElementById('logList'),
};

function showScreen(name, options = {}) {
  const { pushHistory = true } = options;
  state.currentScreen = name;
  Object.entries(screens).forEach(([key, screen]) => {
    screen.classList.toggle('active', key === name);
  });
  elements.goToLogsButton.classList.toggle('hidden', name === 'entry');
  if (pushHistory) {
    history.pushState({ screen: name }, '');
  }
}

function initializeNavigation() {
  const screen = history.state?.screen;
  if (screen && screens[screen]) {
    showScreen(screen, { pushHistory: false });
    return;
  }
  history.replaceState({ screen: state.currentScreen }, '');
}

function fitTitleLineToContainer(titleLine, containerWidth) {
  if (!titleLine || !containerWidth) return;

  titleLine.style.fontSize = '';
  titleLine.style.transform = '';

  let nextSize = parseFloat(getComputedStyle(titleLine).fontSize);
  const minSize = 14;

  while (titleLine.scrollWidth > containerWidth && nextSize > minSize) {
    nextSize -= 1;
    titleLine.style.fontSize = `${nextSize}px`;
  }

  if (titleLine.scrollWidth > containerWidth) {
    const scale = Math.max(containerWidth / titleLine.scrollWidth, 0.75);
    titleLine.style.transform = `scale(${scale})`;
    titleLine.style.transformOrigin = 'left top';
  }
}

function fitHeroTitleLine() {
  const container = elements.heroCopy;
  if (!container) return;

  const containerWidth = Math.floor(container.clientWidth);
  if (!containerWidth) return;

  elements.heroTitleLines.forEach((titleLine) => {
    fitTitleLineToContainer(titleLine, containerWidth);
  });
}

const signature = setupSignaturePad(elements.signaturePad);
const signatureModal = createSignatureModal(signature, elements);

const tbmCallbacks = {};
const admin = createAdmin(state, elements, {
  renderLogList: () => tbmCallbacks.renderLogList?.(),
});

const tbm = initTbm({
  state,
  elements,
  signature,
  signatureModal,
  showScreen,
  admin,
});

tbmCallbacks.renderLogList = tbm.renderLogList;

admin.updateAdminUi();
initializeNavigation();
fitHeroTitleLine();

if (document.fonts?.ready) {
  document.fonts.ready.then(() => {
    fitHeroTitleLine();
  });
}

window.addEventListener('resize', fitHeroTitleLine);

window.addEventListener('popstate', (event) => {
  const screen = event.state?.screen;
  if (!screen || !screens[screen]) {
    showScreen('entry', { pushHistory: false });
    return;
  }
  showScreen(screen, { pushHistory: false });
});
