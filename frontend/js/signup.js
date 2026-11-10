const form = document.querySelector('#signup-form');
const email = form.elements.email;
const sendButton = document.querySelector('#send-code');
const verifyButton = document.querySelector('#verify-code');
const signupButton = document.querySelector('#signup-button');
const statusMessage = document.querySelector('#signup-status');
let verifiedEmail = null;
let busy = false;

const errors = {
    EMAIL_ALREADY_EXISTS: '이미 가입된 이메일이에요.',
    EMAIL_VERIFICATION_NOT_FOUND: '먼저 인증 코드를 요청해 주세요.',
    EMAIL_VERIFICATION_EXPIRED: '인증 코드가 만료됐어요. 새 코드를 받아 주세요.',
    EMAIL_NOT_VERIFIED: '이메일 인증을 다시 완료해 주세요.',
    INVALID_VERIFICATION_CODE: '인증 코드가 올바르지 않아요.',
    TOO_MANY_REQUESTS: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.',
    EMAIL_DELIVERY_FAILED: '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.',
    USERNAME_ALREADY_EXISTS: '이미 사용 중인 아이디예요.',
    STUDENT_NUMBER_ALREADY_EXISTS: '이미 가입된 학번이에요.',
    VALIDATION_ERROR: '입력 내용을 확인해 주세요.',
};

function updateButtons() {
    sendButton.disabled = busy;
    verifyButton.disabled = busy;
    signupButton.disabled = busy || verifiedEmail !== email.value;
}

async function submit(path, body, onSuccess) {
    if (busy) return;
    busy = true;
    updateButtons();
    statusMessage.textContent = '';
    try {
        const response = await fetch('/api/auth/' + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (response.ok) {
            onSuccess();
            return;
        }
        const { code } = await response.json().catch(() => ({}));
        statusMessage.textContent = errors[code] ?? '요청에 실패했어요.';
    } catch {
        statusMessage.textContent = '서버에 연결할 수 없어요.';
    } finally {
        busy = false;
        updateButtons();
    }
}

email.addEventListener('input', () => {
    verifiedEmail = null;
    updateButtons();
});

sendButton.addEventListener('click', () => {
    if (!email.reportValidity()) return;
    verifiedEmail = null;
    submit('email-verifications', { email: email.value }, () => {
        statusMessage.textContent = '인증 코드를 보냈어요.';
    });
});

verifyButton.addEventListener('click', () => {
    if (!email.reportValidity()) return;
    const code = form.elements.code.value;
    if (!/^[0-9]{6}$/.test(code)) {
        statusMessage.textContent = '인증 코드 6자리를 입력해 주세요.';
        return;
    }

    const address = email.value;
    submit('email-verifications/verify', { email: address, code }, () => {
        verifiedEmail = address;
        statusMessage.textContent = '이메일 인증을 완료했어요.';
    });
});

form.addEventListener('submit', event => {
    event.preventDefault();
    if (verifiedEmail !== email.value) return;
    const { code, ...fields } = Object.fromEntries(new FormData(form));
    if (fields.password !== fields.passwordConfirmation) {
        statusMessage.textContent = '비밀번호와 비밀번호 확인이 일치하지 않아요.';
        return;
    }
    submit('signup', fields, () => window.location.assign('/html/login.html'));
});
