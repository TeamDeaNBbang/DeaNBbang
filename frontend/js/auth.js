const loginForm = document.querySelector('#login-form');
const loginStatus = document.querySelector('#login-status');

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const fields = new FormData(loginForm);
    submitButton.disabled = true;
    loginStatus.textContent = '';

    try {
        const response = await fetch(loginForm.action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: fields.get('email'),
                password: fields.get('password'),
            }),
        });

        if (response.ok) {
            window.location.assign('/');
            return;
        }

        loginStatus.textContent = response.status === 401
            ? '이메일 또는 비밀번호를 확인해 주세요.'
            : '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.';
    } catch {
        loginStatus.textContent = '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.';
    } finally {
        submitButton.disabled = false;
    }
});
