const nodemailer = require('nodemailer');

async function sendVerificationCode(email, code) {
    const { SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_FROM || Boolean(SMTP_USER) !== Boolean(SMTP_PASS)) {
        throw new Error('Configure SMTP_HOST, SMTP_FROM and provider credentials.');
    }

    const port = Number(SMTP_PORT);
    const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        requireTLS: port !== 465,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
    await transport.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: '대N 회원가입 인증 코드',
        text: `인증 코드: ${code}\n10분 안에 입력해 주세요.`,
    });
}

module.exports = { sendVerificationCode };
