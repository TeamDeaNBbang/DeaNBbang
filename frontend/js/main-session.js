const loginLink = document.querySelector('#login-link');
const logoutButton = document.querySelector('#logout-button');
const sessionStatus = document.querySelector('#session-status');
const adminLink = document.querySelector('#admin-link');

function showSessionState(authenticated) {
    loginLink.hidden = authenticated;
    logoutButton.hidden = !authenticated;
    adminLink.hidden = true;
}

async function loadSession() {
    const response = await fetch('/api/auth/me');
    if (response.status === 401) {
        showSessionState(false);
        return;
    }
    if (!response.ok) {
        throw new Error('Could not load session');
    }

    const user = await response.json();
    showSessionState(true);
    adminLink.hidden = user.role !== 'ADMIN';
}

logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    sessionStatus.textContent = '';

    try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        if (!response.ok) {
            throw new Error('Could not end session');
        }

        showSessionState(false);
        sessionStatus.textContent = '로그아웃했어요.';
        loginLink.focus();
    } catch {
        sessionStatus.textContent = '로그아웃에 실패했어요. 다시 시도해 주세요.';
    } finally {
        logoutButton.disabled = false;
    }
});

loadSession().catch(() => {
    sessionStatus.textContent = '로그인 상태를 확인할 수 없어요.';
});
