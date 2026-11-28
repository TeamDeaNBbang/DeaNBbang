const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const nodemailer = require('nodemailer');
const { initializeDatabase } = require('../db/init');
const db = new DatabaseSync(':memory:');
initializeDatabase(db);
require.cache[require.resolve('../src/config/db')] = { exports: db };
const mail = require('../src/services/email.service');
const app = require('../src/app');
const clientFetch = globalThis.fetch;

function configure(t) {
    const values = {
        MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'test-only-api-key',
        BREVO_FROM_EMAIL: 'sender@example.test', BREVO_FROM_NAME: '대N',
    };
    const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
    Object.assign(process.env, values);
    t.after(() => {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });
    t.mock.method(nodemailer, 'createTransport', () => { throw new Error('SMTP must not be used for Brevo'); });
}

test('Brevo sends verification and deletion messages as plain text to the intended recipient', async t => {
    configure(t);
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
        assert.equal(options.headers['api-key'], 'test-only-api-key');
        assert.equal(options.redirect, 'error');
        assert.ok(options.signal instanceof AbortSignal);
        requests.push(JSON.parse(options.body));
        return Response.json({ messageId: '<test-message>' }, { status: 201 });
    });
    await mail.sendVerificationCode('student@example.test', '001234');
    assert.deepEqual(requests[0].sender, { email: 'sender@example.test', name: '대N' });
    assert.deepEqual(requests[0].to, [{ email: 'student@example.test' }]);
    assert.ok(requests[0].textContent.includes('001234'));
    const reason = '규정 위반\n<script>plain text</script>';
    await mail.sendDeletionNotice({ recipient: 'author@example.test', title: 'Order', writingId: 42, deletedAt: 1700000000000, reason });
    assert.deepEqual(requests[1].to, [{ email: 'author@example.test' }]);
    assert.ok(requests[1].textContent.includes('삭제 사유: ' + reason));
    assert.equal(requests[1].htmlContent, undefined);
    assert.deepEqual(requests[1].replyTo, { email: 'sender@example.test' });
});

test('Brevo rejects configuration, provider failures and unconfirmed success without leaking provider content', async t => {
    configure(t);
    const sensitive = 'private-response-content';
    let status = 401;
    let timeout = false;
    t.mock.method(globalThis, 'fetch', async () => {
        if (timeout) throw new DOMException(sensitive, 'TimeoutError');
        return Response.json({ message: sensitive }, { status });
    });
    for (status of [401, 403, 429, 500, 200, 201]) {
        await assert.rejects(mail.sendVerificationCode('student@example.test', '001234'), error => {
            assert.ok(!error.message.includes(sensitive));
            assert.ok(!error.message.includes(process.env.BREVO_API_KEY));
            return true;
        });
    }
    timeout = true;
    await assert.rejects(mail.sendVerificationCode('student@example.test', '001234'), /connection failed or timed out/);
    delete process.env.BREVO_API_KEY;
    await assert.rejects(mail.sendVerificationCode('student@example.test', '001234'), /Configure BREVO_API_KEY/);
    process.env.MAIL_PROVIDER = 'unknown';
    await assert.rejects(mail.sendVerificationCode('student@example.test', '001234'), /Unsupported MAIL_PROVIDER/);
});

test('Brevo acceptance permits verified signup; a rejected email returns 503 and leaves no usable code', async t => {
    configure(t);
    let accepted = true;
    let issuedCode;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
        issuedCode = JSON.parse(options.body).textContent.match(/\d{6}/)[0];
        return Response.json(accepted ? { messageId: '<test-message>' } : { message: 'provider unavailable' }, { status: accepted ? 201 : 503 });
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        db.close();
    });
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    let cookie = '';
    async function post(endpoint, body) {
        const response = await clientFetch(base + endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body),
        });
        const nextCookie = response.headers.get('set-cookie');
        if (nextCookie) cookie = nextCookie.split(';')[0];
        return response;
    }
    const email = 'student@example.test';
    assert.equal((await post('/email-verifications', { email })).status, 204);
    assert.equal((await post('/email-verifications/verify', { email, code: issuedCode })).status, 204);
    assert.equal((await post('/signup', { email, username: 'brevo-student', studentNumber: '0101', password: 'test-password', passwordConfirmation: 'test-password' })).status, 201);
    accepted = false;
    const failedEmail = 'failed@example.test';
    const failure = await post('/email-verifications', { email: failedEmail });
    assert.equal(failure.status, 503);
    assert.deepEqual(await failure.json(), { code: 'EMAIL_DELIVERY_FAILED' });
    assert.equal(db.prepare('SELECT count(*) AS count FROM email_verifications WHERE email = ?').get(failedEmail).count, 0);
    assert.equal((await post('/email-verifications/verify', { email: failedEmail, code: issuedCode })).status, 400);
    accepted = true;
    assert.equal((await post('/email-verifications', { email: failedEmail })).status, 204);
});
