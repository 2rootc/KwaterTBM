export function createAdmin(state, elements, callbacks) {
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

  function updateAdminUi() {
    elements.adminButton.textContent = state.isAdmin ? '🔓 관리자' : '🔒 관리자';
    elements.adminButton.setAttribute('aria-label', state.isAdmin ? '관리자 활성화' : '관리자 잠금');
    elements.adminButton.classList.toggle('admin-active', state.isAdmin);
    elements.clearAllLogsButton.style.display = state.isAdmin ? '' : 'none';
  }

  function toggleAdminMode() {
    if (state.isAdmin) {
      state.isAdmin = false;
      state.adminPassword = '';
      updateAdminUi();
      callbacks.renderLogList?.();
      return;
    }

    const password = window.prompt('관리자 비밀번호를 입력하세요.');
    if (password === null) return;

    verifyAdminPassword(password)
      .then(() => {
        state.isAdmin = true;
        state.adminPassword = password;
        updateAdminUi();
        callbacks.renderLogList?.();
      })
      .catch((error) => {
        console.error(error);
        window.alert('비밀번호가 올바르지 않습니다.');
      });
  }

  function requireAdminAccess() {
    if (state.isAdmin) return true;
    window.alert('삭제 기능은 관리자 권한 활성화 후 사용할 수 있습니다.');
    return false;
  }

  return { toggleAdminMode, updateAdminUi, requireAdminAccess, verifyAdminPassword };
}
