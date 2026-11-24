const nodemailer = require('nodemailer');

function createTransport() {
    const { SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_FROM || Boolean(SMTP_USER) !== Boolean(SMTP_PASS)) {
        throw new Error('Configure SMTP_HOST, SMTP_FROM and provider credentials.');
    }

    const port = Number(SMTP_PORT);
    return nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        requireTLS: port !== 465,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
    });
}

async function sendVerificationCode(email, code) {
    await createTransport().sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: '대N 회원가입 인증 코드',
        text: `인증 코드: ${code}\n10분 안에 입력해 주세요.`,
    });
}

async function sendDeletionNotice({ recipient, title, writingId, deletedAt }) {
    await createTransport().sendMail({
        from: process.env.SMTP_FROM,
        to: recipient,
        subject: '대N 게시글 삭제 안내',
        text: [
            '안녕하세요. 대N입니다.',
            '',
            '작성하신 게시글이 관리자 검토 후 삭제되었습니다.',
            '게시글 번호: ' + writingId,
            '게시글 제목: ' + title,
            '삭제 시각: ' + new Date(deletedAt).toISOString(),
            '',
            '문의가 필요하면 이 메일에 답장해 주세요.',
        ].join('\n'),
    });
}

module.exports = { sendVerificationCode, sendDeletionNotice };
