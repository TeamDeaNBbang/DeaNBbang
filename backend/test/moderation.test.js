const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, scryptSync } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { initializeDatabase } = require('../db/init');
const { createWriting } = require('../src/repositories/writing.repository');

test('administrator APIs preserve participation APIs and queue deletion email atomically', async t => {
    const db = new DatabaseSync(':memory:');
    initializeDatabase(db);
    require.cache[require.resolve('../src/config/db')] = { exports: db };
    const app = require('../src/app');
    const mail = require('../src/services/email.service');
    const { deliverPending } = require('../src/services/notification.service');
    const notifications = require('../src/repositories/notification.repository');
    const deliveries = [];
    t.mock.method(mail, 'sendDeletionNotice', async job => { deliveries.push(job); });
    const server = app.listen(0, '127.0.0.1');
    t.after(async () => {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        db.close();
    });
    await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    const salt = randomBytes(16);
    const hash = scryptSync('test-password', salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
    const passwordHash = ['scrypt', salt.toString('hex'), hash.toString('hex')].join('$');
    const insertUser = db.prepare('INSERT INTO users (id, email, username, student_number, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)');
    for (const [id, name, role] of [[1, 'author', 'USER'], [2, 'reporter', 'USER'], [3, 'admin', 'ADMIN'], [4, 'disposable', 'ADMIN']]) {
        insertUser.run(id, name + '@example.test', name, '00' + id, passwordHash, role);
    }
    async function request(method, endpoint, body, cookie, rawBody) {
        const headers = { 'content-type': 'application/json' };
        if (cookie) headers.cookie = cookie;
        const response = await fetch(base + endpoint, {
            method, headers, body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)), signal: AbortSignal.timeout(5000)
        });
        return { status: response.status, body: response.status === 204 ? null : await response.json(), headers: response.headers };
    }
    async function login(name) {
        const response = await request('POST', '/auth/login', { email: name + '@example.test', password: 'test-password' });
        assert.equal(response.status, 200);
        return response.headers.get('set-cookie').split(';')[0];
    }
    const author = await login('author');
    const reporter = await login('reporter');
    const administrator = await login('admin');
    const disposable = await login('disposable');
    const validPost = {
        title: 'Order', content: 'Order details', photoUrl: '/images/order.png',
        productName: 'Water', productUrl: 'https://example.test/water', totalPrice: 12000, targetCount: 3, author_id: 1
    };
    const writingId = createWriting(db, validPost);
    const secondId = createWriting(db, { ...validPost, title: 'Second order' });

    await t.test('administrator role is checked from the database for every request', async () => {
        for (const [cookie, status, code] of [[undefined, 401, 'UNAUTHORIZED'], [reporter, 403, 'FORBIDDEN']]) {
            for (const [method, endpoint, body] of [
                ['GET', '/admin/accuse'], ['DELETE', '/admin/' + writingId, { reason: 'Violation' }]
            ]) {
                const response = await request(method, endpoint, body, cookie);
                assert.equal(response.status, status);
                assert.equal(response.body.code, code);
                assert.equal(typeof response.body.message, 'string');
            }
        }
        assert.equal((await request('GET', '/admin/accuse', undefined, administrator)).status, 200);
        db.prepare("UPDATE users SET role = 'USER' WHERE id = 3").run();
        assert.equal((await request('GET', '/admin/accuse', undefined, administrator)).status, 403);
        db.prepare("UPDATE users SET role = 'ADMIN' WHERE id = 3").run();
        db.prepare('DELETE FROM users WHERE id = 4').run();
        assert.equal((await request('GET', '/admin/accuse', undefined, disposable)).status, 401);
    });

    await t.test('report list groups reasons by post, counts reports and paginates by latest report', async () => {
        assert.deepEqual((await request('GET', '/admin/accuse', undefined, administrator)).body, {
            items: [], page: 0, size: 20, totalElements: 0, hasNext: false
        });
        assert.equal((await request('POST', '/writing/accuse/' + writingId, { reason: 'First reason' }, reporter)).status, 201);
        assert.equal((await request('POST', '/writing/accuse/' + writingId, { reason: 'Second reason' }, author)).status, 201);
        assert.equal((await request('POST', '/writing/accuse/' + secondId, { reason: 'Another post' }, reporter)).status, 201);
        db.prepare('UPDATE reports SET created_at = 20 WHERE writing_id = ?').run(secondId);
        db.prepare('UPDATE reports SET created_at = 30 WHERE writing_id = ?').run(writingId);
        const first = await request('GET', '/admin/accuse?size=1', undefined, administrator);
        assert.equal(first.headers.get('cache-control'), 'no-store');
        assert.equal(first.body.totalElements, 2);
        assert.equal(first.body.hasNext, true);
        assert.equal(first.body.items[0].writingId, writingId);
        assert.equal(first.body.items[0].reportCount, 2);
        assert.equal(first.body.items[0].reports.length, 2);
        assert.equal(first.body.items[0].reports[0].reason, 'Second reason');
        const next = (await request('GET', '/admin/accuse?page=1&size=1', undefined, administrator)).body;
        assert.equal(next.items[0].writingId, secondId);
        assert.equal(next.hasNext, false);
        const all = JSON.stringify(first.body);
        for (const privateField of ['password', 'email', 'studentNumber', 'student_number']) assert.ok(!all.includes(privateField));
        for (const query of ['page=-1', 'size=101', 'size=0', 'page=x', 'size=1&size=2', 'page=9007199254740991&size=100']) {
            const response = await request('GET', '/admin/accuse?' + query, undefined, administrator);
            assert.equal(response.status, 400, query);
            assert.equal(response.body.code, 'VALIDATION_ERROR');
        }
    });

    await t.test('delete validates reason and id and handles malformed JSON without deleting', async () => {
        for (const body of [undefined, null, [], {}, { reason: ' ' }, { reason: 42 }, { reason: 'a'.repeat(1001) }]) {
            const response = await request('DELETE', '/admin/writing/' + writingId, body, administrator);
            assert.equal(response.status, 400);
            assert.ok(response.body.fieldErrors.reason || response.body.fieldErrors.body);
        }
        for (const id of ['abc', '0', '-1', '1.2', '9007199254740992']) {
            assert.equal((await request('DELETE', '/admin/' + id, { reason: 'Reason' }, administrator)).status, 400);
        }
        const malformed = await request('DELETE', '/admin/' + writingId, undefined, administrator, '{');
        assert.equal(malformed.status, 400);
        assert.ok(malformed.body.fieldErrors.body);
        assert.equal((await request('DELETE', '/admin/' + writingId, { reason: 'a'.repeat(110000) }, administrator)).status, 413);
        assert.equal((await request('DELETE', '/admin/99999', { reason: 'Reason' }, administrator)).status, 404);
        assert.equal(db.prepare('SELECT deleted_at FROM writings WHERE id = ?').get(writingId).deleted_at, null);
        assert.equal(db.prepare('SELECT count(*) AS count FROM deletion_notifications').get().count, 0);
    });

    const deletionReason = '학교 규정에 어긋나는 물품입니다.\n규정을 확인해 주세요.';
    await t.test('concurrent deletion creates one notice and hides the post from existing APIs', async () => {
        assert.equal((await request('POST', '/writing/join', { writingId }, reporter)).status, 201);
        const results = await Promise.all([1, 2].map(() => request('DELETE', '/admin/' + writingId, {
            reason: '  ' + deletionReason + '  ', adminId: 2, recipient: 'attacker@example.test'
        }, administrator)));
        assert.deepEqual(results.map(result => result.status).sort(), [204, 404]);
        const deleted = db.prepare('SELECT deleted_at, deleted_by, deletion_reason FROM writings WHERE id = ?').get(writingId);
        assert.ok(deleted.deleted_at > 0);
        assert.equal(deleted.deleted_by, 3);
        assert.equal(deleted.deletion_reason, deletionReason);
        const notice = db.prepare('SELECT * FROM deletion_notifications').get();
        assert.equal(notice.recipient, 'author@example.test');
        assert.equal(notice.deletion_reason, deletionReason);
        assert.equal(notice.sent_at, null);
        assert.equal(db.prepare('SELECT count(*) AS count FROM deletion_notifications').get().count, 1);
        assert.equal((await request('GET', '/writing/' + writingId)).status, 404);
        for (const action of ['join', 'leave', 'close']) {
            assert.equal((await request('POST', '/writing/' + action, { writingId }, author)).status, 404);
        }
        assert.equal((await request('GET', '/writing')).body.some(item => item.id === writingId), false);
        assert.equal((await request('GET', '/other/main')).body.items.some(item => item.id === writingId), false);
        const mine = (await request('GET', '/other/mypage', undefined, author)).body;
        assert.equal(mine.written.some(item => item.id === writingId), false);
        assert.equal(mine.joined.some(item => item.id === writingId), false);
        assert.equal((await request('POST', '/writing/accuse/' + writingId, { reason: 'Deleted' }, reporter)).status, 404);
        assert.equal((await request('GET', '/admin/accuse', undefined, administrator)).body.totalElements, 1);
        assert.equal(db.prepare('SELECT count(*) AS count FROM reports WHERE writing_id = ?').get(writingId).count, 2);
        assert.equal(db.prepare('SELECT count(*) AS count FROM writing_participants WHERE writing_id = ?').get(writingId).count, 2);
    });

    await t.test('email outage is retried later; concurrent workers skip a claimed notice', async t => {
        t.mock.method(console, 'error', () => {});
        mail.sendDeletionNotice = async () => { throw new Error('Simulated SMTP outage'); };
        await deliverPending();
        const failed = db.prepare('SELECT * FROM deletion_notifications').get();
        assert.equal(failed.attempts, 1);
        assert.equal(failed.sent_at, null);
        assert.ok(failed.next_attempt_at > Date.now());
        mail.sendDeletionNotice = async job => { deliveries.push(job); };
        await deliverPending();
        assert.equal(deliveries.length, 0);
        db.prepare('UPDATE deletion_notifications SET next_attempt_at = 0').run();
        const reserved = notifications.claimNext();
        assert.equal(reserved.attempts, 2);
        assert.equal(notifications.claimNext(), undefined);
        db.prepare('UPDATE deletion_notifications SET next_attempt_at = 0').run();
        await Promise.all([deliverPending(), deliverPending()]);
        assert.equal(deliveries.length, 1);
        assert.equal(deliveries[0].reason, deletionReason);
        assert.equal(deliveries[0].recipient, 'author@example.test');
        assert.ok(db.prepare('SELECT sent_at FROM deletion_notifications').get().sent_at);
        await deliverPending();
        assert.equal(deliveries.length, 1);
    });

    await t.test('queue insertion failure rolls back deletion and repeat initialization preserves pending mail', async t => {
        t.mock.method(console, 'error', () => {});
        const id = createWriting(db, { ...validPost, title: 'Rollback' });
        db.exec("CREATE TRIGGER reject_notice BEFORE INSERT ON deletion_notifications BEGIN SELECT RAISE(ABORT, 'test rejection'); END");
        const result = await request('DELETE', '/admin/' + id, { reason: 'Reason' }, administrator);
        assert.equal(result.status, 500);
        assert.equal(result.body.code, 'INTERNAL_SERVER_ERROR');
        assert.equal(db.prepare('SELECT deleted_at FROM writings WHERE id = ?').get(id).deleted_at, null);
        db.exec('DROP TRIGGER reject_notice');
        assert.equal((await request('DELETE', '/admin/' + id, { reason: 'Reason' }, administrator)).status, 204);
        initializeDatabase(db);
        initializeDatabase(db);
        const pending = db.prepare('SELECT * FROM deletion_notifications WHERE writing_id = ?').get(id);
        assert.equal(pending.deletion_reason, 'Reason');
        assert.equal(pending.sent_at, null);
        db.prepare('UPDATE deletion_notifications SET attempts = 5, next_attempt_at = 0 WHERE id = ?').run(pending.id);
        await deliverPending();
        assert.equal(db.prepare('SELECT attempts FROM deletion_notifications WHERE id = ?').get(pending.id).attempts, 5);
        assert.equal(deliveries.length, 1);
    });
});
