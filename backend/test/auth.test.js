const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const path = require('node:path');

// Isolate authentication data and outgoing mail from the developer's database.
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
require.cache[require.resolve('../src/config/db')] = { exports: db };
const mail = require('../src/services/email.service');
const outbox = new Map();
mail.sendVerificationCode = async (email, code) => { outbox.set(email, code); };
const app = require('../src/app');

test('signup requires this session to verify the current email code', async t => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => {
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
        db.close();
    });
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    function browser() {
        let cookie = '';
        return {
            async post(endpoint, body = {}) {
                const response = await fetch(base + endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', cookie },
                    body: JSON.stringify(body),
                });
                const nextCookie = response.headers.get('set-cookie');
                if (nextCookie) cookie = nextCookie.split(';')[0];
                return response;
            },
            async status() {
                const response = await fetch(base + '/session', { headers: { cookie } });
                return response.json();
            },
        };
    }
    const owner = browser();
    const stranger = browser();
    const fields = {
        email: 'owner@example.test', username: 'owner', studentNumber: '0123',
        password: 'test-password', passwordConfirmation: 'test-password',
    };
    assert.equal((await owner.post('/email-verifications', fields)).status, 204);
    assert.equal((await owner.post('/signup', fields)).status, 400);
    const code = outbox.get(fields.email);
    const wrongCode = code === '000000' ? '000001' : '000000';
    assert.equal((await owner.post('/email-verifications/verify', {
        email: fields.email, code: wrongCode,
    })).status, 400);
    assert.equal((await owner.post('/email-verifications/verify', {
        email: fields.email, code,
    })).status, 204);
    const stolen = await stranger.post('/signup', fields);
    assert.equal(stolen.status, 400);
    assert.deepEqual(await stolen.json(), { code: 'EMAIL_NOT_VERIFIED' });
    assert.equal(db.prepare('SELECT count(*) AS count FROM users').get().count, 0);

    // Reissue without waiting a minute, preserving the normal API flow.
    db.prepare('UPDATE email_verifications SET expires_at = expires_at - 61000').run();
    assert.equal((await stranger.post('/email-verifications', fields)).status, 204);
    assert.equal((await owner.post('/signup', fields)).status, 400);
    assert.equal((await owner.post('/email-verifications/verify', {
        email: fields.email, code: outbox.get(fields.email),
    })).status, 204);
    const registered = await owner.post('/signup', { ...fields, role: 'ADMIN' });
    assert.equal(registered.status, 201);
    assert.deepEqual(await registered.json(), { id: 1, username: 'owner', role: 'USER' });
    assert.equal(db.prepare('SELECT count(*) AS count FROM email_verifications').get().count, 0);
    assert.equal((await owner.post('/signup', fields)).status, 409);
    assert.equal((await owner.post('/login', { ...fields, password: 'wrong' })).status, 401);
    assert.equal((await owner.post('/login', fields)).status, 200);
    assert.deepEqual(await owner.status(), { authenticated: true });
    assert.equal((await owner.post('/logout')).status, 204);
    assert.deepEqual(await owner.status(), { authenticated: false });

    // A uniqueness failure rolls back without consuming this browser's proof.
    const other = { ...fields, email: 'other@example.test', studentNumber: '0124' };
    assert.equal((await owner.post('/email-verifications', other)).status, 204);
    assert.equal((await owner.post('/email-verifications/verify', {
        email: other.email, code: outbox.get(other.email),
    })).status, 204);
    const duplicate = await owner.post('/signup', other);
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await duplicate.json(), { code: 'USERNAME_ALREADY_EXISTS' });
    assert.equal((await owner.post('/signup', { ...other, username: 'other' })).status, 201);
});
