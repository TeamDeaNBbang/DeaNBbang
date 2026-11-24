const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomBytes, scryptSync } = require('node:crypto');

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
db.exec(readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
require.cache[require.resolve('../src/config/db')] = { exports: db };
const app = require('../src/app');
const mail = require('../src/services/email.service');
const { deliverPending } = require('../src/services/notification.service');

test('moderation enforces live roles and removes deleted posts from public entry points', async t => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        db.close();
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const salt = randomBytes(16);
    const hash = scryptSync('test-password', salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
    const passwordHash = ['scrypt', salt.toString('hex'), hash.toString('hex')].join('$');
    function seedUser(username, role = 'USER') {
        return db.prepare('INSERT INTO users (email, username, student_number, password_hash, role) VALUES (?, ?, ?, ?, ?)')
            .run(username + '@example.test', username, username, passwordHash, role).lastInsertRowid;
    }
    async function login(username) {
        const response = await fetch(base + '/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: username + '@example.test', password: 'test-password' }),
        });
        assert.equal(response.status, 200);
        return response.headers.get('set-cookie').split(';')[0];
    }
    const request = (url, cookie = '', method = 'GET', body, extraHeaders = {}) => fetch(base + url, {
        method, headers: { cookie, 'Content-Type': 'application/json', ...extraHeaders },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const authorId = seedUser('author');
    const reporterId = seedUser('reporter');
    const adminId = seedUser('admin', 'ADMIN');
    seedUser('disposable');
    const writingId = db.prepare('INSERT INTO writings (author_id, title, content, created_at) VALUES (?, ?, ?, ?)')
        .run(authorId, '<script>alert(1)</script>', '내용 <img src=x onerror=alert(1)>', Date.now()).lastInsertRowid;
    const adminCookie = await login('admin');
    const reporterCookie = await login('reporter');
    const authorCookie = await login('author');
    const disposableCookie = await login('disposable');

    await t.test('anonymous and regular accounts cannot view reports or delete posts', async () => {
        assert.equal((await request('/api/admin/reports')).status, 401);
        assert.equal((await request('/api/admin/reports', reporterCookie)).status, 403);
        assert.equal((await request('/api/admin/writing/' + writingId, reporterCookie, 'DELETE')).status, 403);
        assert.equal((await request('/api/writing/accuse/' + writingId, '', 'POST', { reason: '위반' })).status, 401);
        assert.equal((await request('/api/admin/reports', adminCookie)).status, 200);
        db.prepare("UPDATE users SET role = 'USER' WHERE id = ?").run(adminId);
        assert.equal((await request('/api/admin/reports', adminCookie)).status, 403);
        db.prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?").run(adminId);
        db.prepare("DELETE FROM users WHERE username = 'disposable'").run();
        assert.equal((await request('/api/auth/me', disposableCookie)).status, 401);
    });

    await t.test('reports validate inputs and identity and reject foreign browser origins', async () => {
        assert.equal((await request('/api/writing/accuse/abc', reporterCookie, 'POST', { reason: '위반' })).status, 400);
        assert.equal((await request('/api/writing/accuse/' + writingId, reporterCookie, 'POST', { reason: ' ' })).status, 400);
        assert.equal((await request('/api/writing/accuse/' + writingId, reporterCookie, 'POST', { reason: 'a'.repeat(1001) })).status, 400);
        assert.equal((await request('/api/writing/accuse/99999', reporterCookie, 'POST', { reason: '위반' })).status, 404);
        assert.equal((await request('/api/writing/accuse/' + writingId, reporterCookie, 'POST', { reason: '위반' }, {
            Origin: 'https://unrelated.example', 'Sec-Fetch-Site': 'cross-site',
        })).status, 403);
        const report = await request('/api/writing/accuse/' + writingId, reporterCookie, 'POST', {
            reason: '학교 규정 위반', reporterId: adminId,
        }, { Origin: base, 'Sec-Fetch-Site': 'same-origin' });
        assert.equal(report.status, 201);
        assert.equal(db.prepare('SELECT reporter_id FROM reports').get().reporter_id, reporterId);
        assert.equal((await request('/api/writing/accuse/' + writingId, reporterCookie, 'POST', { reason: '중복' })).status, 409);
        assert.equal((await request('/api/writing/accuse/' + writingId, authorCookie, 'POST', { reason: '다른 신고' })).status, 201);
        const response = await request('/api/admin/reports', adminCookie);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const pending = await response.json();
        assert.equal(pending.reports.length, 2);
        assert.equal(pending.reports[0].writingId, writingId);
        assert.equal(pending.nextCursor, null);
        assert.ok(!JSON.stringify(pending).includes('password'));
    });

    await t.test('delete is atomic and hides all reports and public reads for the post', async () => {
        const before = await (await request('/api/writing')).json();
        assert.equal(before.writings.length, 1);
        const results = await Promise.all([
            request('/api/admin/writing/' + writingId, adminCookie, 'DELETE'),
            request('/api/admin/writing/' + writingId, adminCookie, 'DELETE'),
        ]);
        assert.deepEqual(results.map(r => r.status).sort(), [204, 404]);
        const record = db.prepare('SELECT deleted_at, deleted_by FROM writings WHERE id = ?').get(writingId);
        assert.ok(record.deleted_at > 0);
        assert.equal(record.deleted_by, adminId);
        assert.equal((await (await request('/api/writing')).json()).writings.length, 0);
        assert.equal((await request('/api/writing/' + writingId)).status, 404);
        assert.equal((await request('/api/writing/accuse/' + writingId, reporterCookie, 'POST', { reason: '삭제 후' })).status, 404);
        assert.equal((await (await request('/api/admin/reports', adminCookie)).json()).reports.length, 0);
        assert.equal(db.prepare('SELECT count(*) AS count FROM reports').get().count, 2);
        const notice = db.prepare('SELECT * FROM deletion_notifications').get();
        assert.equal(notice.writing_id, writingId);
        assert.equal(notice.recipient, 'author@example.test');
        assert.equal(notice.sent_at, null);
    });

    await t.test('failed deletion mail is retried without sending a completed notice again', async () => {
        const deliveries = [];
        mail.sendDeletionNotice = async () => { throw new Error('Simulated mail outage'); };
        await deliverPending();
        const failed = db.prepare('SELECT * FROM deletion_notifications').get();
        assert.equal(failed.attempts, 1);
        assert.equal(failed.sent_at, null);
        assert.ok(failed.next_attempt_at > Date.now());
        assert.ok(db.prepare('SELECT deleted_at FROM writings WHERE id = ?').get(writingId).deleted_at);
        mail.sendDeletionNotice = async notice => { deliveries.push(notice); };
        await deliverPending();
        assert.equal(deliveries.length, 0);
        db.prepare('UPDATE deletion_notifications SET next_attempt_at = 0').run();
        await Promise.all([deliverPending(), deliverPending()]);
        assert.equal(deliveries.length, 1);
        assert.equal(deliveries[0].recipient, 'author@example.test');
        const sent = db.prepare('SELECT * FROM deletion_notifications').get();
        assert.equal(sent.attempts, 2);
        assert.ok(sent.sent_at);
        await deliverPending();
        assert.equal(deliveries.length, 1);
    });

    await t.test('notification insertion failure rolls back the post deletion', async () => {
        const postId = db.prepare('INSERT INTO writings (author_id, title, created_at) VALUES (?, ?, ?)')
            .run(authorId, '알림 저장 실패 확인', Date.now()).lastInsertRowid;
        db.exec(`
            CREATE TRIGGER reject_notification BEFORE INSERT ON deletion_notifications
            BEGIN SELECT RAISE(ABORT, 'simulated notification failure'); END;
        `);
        try {
            assert.equal((await request('/api/admin/writing/' + postId, adminCookie, 'DELETE')).status, 500);
            assert.equal(db.prepare('SELECT deleted_at FROM writings WHERE id = ?').get(postId).deleted_at, null);
        } finally {
            db.exec('DROP TRIGGER reject_notification');
            db.prepare('DELETE FROM writings WHERE id = ?').run(postId);
        }
    });

    await t.test('report cursor pages return each report exactly once', async () => {
        const insertWriting = db.prepare('INSERT INTO writings (author_id, title, created_at) VALUES (?, ?, ?)');
        const insertReport = db.prepare('INSERT INTO reports (writing_id, reporter_id, reason, created_at) VALUES (?, ?, ?, ?)');
        for (let i = 0; i < 55; i++) {
            const id = insertWriting.run(authorId, '글 ' + i, Date.now()).lastInsertRowid;
            insertReport.run(id, reporterId, '사유 ' + i, Date.now());
        }
        const first = await (await request('/api/admin/reports', adminCookie)).json();
        assert.equal(first.reports.length, 50);
        const second = await (await request('/api/admin/reports?before=' + first.nextCursor, adminCookie)).json();
        assert.equal(second.reports.length, 5);
        assert.equal(new Set([...first.reports, ...second.reports].map(r => r.id)).size, 55);
        assert.equal(second.nextCursor, null);
        const publicFirst = await (await request('/api/writing')).json();
        const publicSecond = await (await request('/api/writing?before=' + publicFirst.nextCursor)).json();
        assert.equal(publicFirst.writings.length, 50);
        assert.equal(publicSecond.writings.length, 5);
        assert.equal((await request('/api/admin/reports?before=bad', adminCookie)).status, 400);
        assert.equal((await request('/api/writing?before=bad')).status, 400);
    });
});
