const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, scryptSync } = require('node:crypto');
const { rm } = require('node:fs/promises');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { initializeDatabase } = require('../db/init');
const { createWriting, findAllWritings, findWritingById } = require('../src/repositories/writing.repository');

const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/tFcAAAAASUVORK5CYII=', 'base64'
);
const validFields = {
    title: 'Group order', content: 'Order details', photoUrl: '/images/photo.png',
    productName: 'Water', productUrl: 'https://example.test/water', totalPrice: 10001,
    targetCount: 2
};

function seedUsers(db) {
    const password = 'test-password';
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
    const passwordHash = ['scrypt', salt.toString('hex'), hash.toString('hex')].join('$');
    const insert = db.prepare(`
        INSERT INTO users (id, email, username, student_number, password_hash)
        VALUES (?, ?, ?, ?, ?)
    `);
    insert.run(1, 'author@example.test', 'author', '001', passwordHash);
    insert.run(2, 'other@example.test', 'other', '002', passwordHash);
    insert.run(3, 'third@example.test', 'third', '003', passwordHash);
    return password;
}

test('database initialization preserves older posts and can run again', t => {
    const db = new DatabaseSync(':memory:');
    t.after(() => db.close());
    db.exec(`
        CREATE TABLE writings (id INTEGER PRIMARY KEY, title TEXT NOT NULL, author_id INTEGER NOT NULL REFERENCES users(id));
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL UNIQUE,
            student_number TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'USER'
        );
        INSERT INTO users (id, email, username, student_number, password_hash)
        VALUES (1, 'author@example.test', 'author', '001', 'test-hash');
        INSERT INTO writings (id, title, author_id) VALUES (3, 'Older post', 1);
        CREATE TABLE writing_participants (
            writing_id INTEGER NOT NULL REFERENCES writings(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            PRIMARY KEY (writing_id, user_id)
        );
        INSERT INTO writing_participants (writing_id, user_id) VALUES (3, 1);
    `);

    initializeDatabase(db);
    initializeDatabase(db);
    assert.deepEqual({ ...findWritingById(db, 3) }, {
        id: 3, title: 'Older post', author_id: 1, content: null, photoUrl: null,
        productName: null, productUrl: null, totalPrice: null, targetCount: null,
        recruitmentStatus: 'OPEN', participantCount: 1
    });

    assert.ok(Number.isSafeInteger(db.prepare('SELECT joined_at FROM writing_participants WHERE writing_id = 3').get().joined_at));
    const id = createWriting(db, { ...validFields, author_id: 1 });
    assert.deepEqual({ ...findAllWritings(db).find(row => row.id === id) }, {
        id, title: validFields.title, photoUrl: validFields.photoUrl
    });
    assert.equal(findWritingById(db, id).participantCount, 1);

    db.exec(`
        CREATE TRIGGER reject_participant BEFORE INSERT ON writing_participants
        BEGIN SELECT RAISE(ABORT, '가입 저장 실패'); END;
    `);
    assert.throws(() => createWriting(db, { ...validFields, author_id: 1 }), /가입 저장 실패/);
    assert.equal(db.prepare('SELECT count(*) AS count FROM writings').get().count, 2);
});

test('writing API requires title, content and photo on creation and supports partial updates', async t => {
    const db = new DatabaseSync(':memory:');
    initializeDatabase(db);
    const password = seedUsers(db);
    require.cache[require.resolve('../src/config/db')] = { exports: db };

    const app = require('../src/app');
    const { writingPhotoDir } = require('../src/services/writing-photo.service');
    const server = app.listen(0, '127.0.0.1');
    const uploadedFiles = [];
    t.after(async () => {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        db.close();
        await Promise.all(uploadedFiles.map(file => rm(file, { force: true })));
    });
    await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;

    async function request(method, endpoint, body, cookie) {
        const headers = {};
        if (cookie) headers.cookie = cookie;
        if (body !== undefined && !(body instanceof FormData)) {
            headers['content-type'] = 'application/json';
            body = JSON.stringify(body);
        }
        const response = await fetch(origin + '/api' + endpoint, {
            method, headers, body, signal: AbortSignal.timeout(5000)
        });
        const payload = response.status === 204 ? null : await response.json();
        return { status: response.status, body: payload, headers: response.headers };
    }

    async function login(email) {
        const result = await request('POST', '/auth/login', { email, password });
        assert.equal(result.status, 200);
        return result.headers.get('set-cookie').split(';')[0];
    }

    function photoForm(bytes) {
        const form = new FormData();
        form.set('photo', new File([bytes], 'test.png', { type: 'image/png' }));
        return form;
    }

    const author = await login('author@example.test');
    const other = await login('other@example.test');
    assert.equal((await request('POST', '/writing', validFields)).status, 401);
    assert.equal((await request('POST', '/writing/photo', photoForm(png))).status, 401);
    const wrongPhoto = await request('POST', '/writing/photo', photoForm(Buffer.from('not a PNG')), author);
    assert.equal(wrongPhoto.status, 400);
    assert.equal(wrongPhoto.body.code, 'VALIDATION_ERROR');

    const uploaded = await request('POST', '/writing/photo', photoForm(png), author);
    assert.equal(uploaded.status, 201);
    const { photoUrl } = uploaded.body;
    assert.match(photoUrl, /^\/api\/writing\/photo\/[\da-f-]+\.png$/);
    uploadedFiles.push(path.join(writingPhotoDir, path.basename(photoUrl)));
    const image = await fetch(origin + photoUrl);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);

    const malformed = await fetch(origin + '/api/writing', {
        method: 'POST',
        headers: { cookie: author, 'content-type': 'application/json' },
        body: '{'
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).code, 'VALIDATION_ERROR');

    for (const field of Object.keys(validFields)) {
        const fields = { ...validFields, photoUrl };
        delete fields[field];
        const result = await request('POST', '/writing', fields, author);
        assert.equal(result.status, 400);
        assert.deepEqual(Object.keys(result.body.fieldErrors), [field]);
    }
    assert.deepEqual((await request('GET', '/writing')).body, []);
    assert.deepEqual((await request('GET', '/other/main')).body, {
        items: [], page: 0, size: 20, totalElements: 0, hasNext: false
    });
    const invalidPage = await request('GET', '/other/main?page=-1&size=101');
    assert.equal(invalidPage.status, 400);
    assert.deepEqual(Object.keys(invalidPage.body.fieldErrors).sort(), ['page', 'size']);
    assert.equal((await request('GET', '/other/main?size=1&size=2')).status, 400);

    const invalidPurchase = await request('POST', '/writing', { ...validFields, totalPrice: '10001', targetCount: 1 }, author);
    assert.equal(invalidPurchase.status, 400);
    assert.deepEqual(Object.keys(invalidPurchase.body.fieldErrors).sort(), ['targetCount', 'totalPrice']);

    const created = await request('POST', '/writing', {
        ...validFields, photoUrl, author_id: 2, participantCount: 7, recruitmentStatus: 'CLOSED'
    }, author);
    assert.equal(created.status, 201);
    const id = created.body.writingId;
    const endpoint = '/writing/' + id;
    const expected = {
        id, ...validFields, photoUrl, author_id: 1, recruitmentStatus: 'OPEN', participantCount: 1,
        pricePerPerson: 10001, expectedPricePerPerson: 5001, isJoined: false
    };
    const joinedAt = db.prepare('SELECT joined_at FROM writing_participants WHERE writing_id = ? AND user_id = 1').get(id).joined_at;
    assert.ok(Number.isSafeInteger(joinedAt));
    assert.deepEqual((await request('GET', '/writing')).body, [{ id, title: validFields.title, photoUrl }]);
    assert.deepEqual((await request('GET', endpoint)).body, expected);
    assert.equal((await request('GET', endpoint, undefined, author)).body.isJoined, true);

    const withoutLogin = await request('PATCH', endpoint, { title: 'Denied' });
    assert.equal(withoutLogin.status, 401);
    assert.equal(withoutLogin.body.code, 'UNAUTHORIZED');
    const denied = await request('PATCH', endpoint, { title: 'Denied' }, other);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'POST_ACCESS_DENIED');
    const missing = await request('PATCH', '/writing/9000', { title: 'Missing' }, author);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'POST_NOT_FOUND');

    const invalid = await request('PATCH', endpoint, { totalPrice: 20, photoUrl: null }, author);
    assert.equal(invalid.status, 400);
    assert.deepEqual(Object.keys(invalid.body.fieldErrors).sort(), ['photoUrl', 'totalPrice']);
    assert.deepEqual((await request('GET', endpoint)).body, expected);

    const content = 'Edited body';
    const edited = await request('PATCH', endpoint, { content }, author);
    assert.equal(edited.status, 200);
    assert.deepEqual(edited.body, { ...expected, content, isJoined: true });
    const replacement = '/images/replacement.png';
    const changedPhoto = await request('PATCH', endpoint, { photoUrl: replacement }, author);
    assert.equal(changedPhoto.status, 200);
    assert.deepEqual(changedPhoto.body, { ...expected, content, photoUrl: replacement, isJoined: true });
    assert.deepEqual((await request('GET', '/writing')).body, [{ id, title: validFields.title, photoUrl: replacement }]);

    const third = await login('third@example.test');
    assert.equal((await request('POST', '/writing/join', { writingId: id })).status, 401);
    assert.equal((await request('POST', '/writing/join', { writingId: '1' }, author)).status, 400);
    assert.equal((await request('POST', '/writing/join', { writingId: 999 }, author)).body.code, 'POST_NOT_FOUND');
    assert.equal((await request('POST', '/writing/join', { writingId: id }, author)).body.code, 'ALREADY_JOINED');
    assert.equal((await request('POST', '/writing/leave', { writingId: id }, author)).body.code, 'OWNER_CANNOT_LEAVE');

    const competing = await Promise.all([
        request('POST', '/writing/join', { writingId: id }, other),
        request('POST', '/writing/join', { writingId: id }, third)
    ]);
    assert.deepEqual(competing.map(result => result.status).sort(), [201, 409]);
    const winner = competing[0].status === 201 ? other : third;
    assert.deepEqual(competing.find(result => result.status === 201).body, {
        writingId: id, participantCount: 2, joined: true
    });
    assert.equal(competing.find(result => result.status === 409).body.code, 'CAPACITY_EXCEEDED');
    const full = (await request('GET', endpoint, undefined, winner)).body;
    assert.equal(full.recruitmentStatus, 'OPEN');
    assert.equal(full.pricePerPerson, 5001);
    assert.equal(full.isJoined, true);

    const listItem = { id, title: validFields.title, photoUrl: replacement };
    assert.equal((await request('GET', '/writing/me')).status, 401);
    assert.deepEqual((await request('GET', '/writing/me', undefined, author)).body, {
        written: [listItem], joined: [listItem]
    });
    assert.deepEqual((await request('GET', '/writing/me?userId=1', undefined, winner)).body, {
        written: [], joined: [listItem]
    });
    assert.equal((await request('GET', '/other/mypage')).status, 401);
    assert.deepEqual((await request('GET', '/other/mypage?userId=2', undefined, author)).body, {
        user: { id: 1, username: 'author', role: 'USER' },
        written: [listItem], joined: [listItem]
    });
    const main = await request('GET', '/other/main');
    assert.equal(main.status, 200);
    const createdAt = db.prepare('SELECT created_at FROM writings WHERE id = ?').get(id).created_at;
    assert.deepEqual(main.body, {
        items: [{
            ...listItem, createdAt, totalPrice: 10001, targetCount: 2, recruitmentStatus: 'OPEN',
            participantCount: 2, pricePerPerson: 5001, expectedPricePerPerson: 5001
        }],
        page: 0, size: 20, totalElements: 1, hasNext: false
    });
    assert.equal((await request('POST', '/writing/join', { writingId: id }, winner)).body.code, 'ALREADY_JOINED');

    assert.equal((await request('POST', '/writing/leave', { writingId: id }, winner)).status, 204);
    assert.equal((await request('POST', '/writing/leave', { writingId: id }, winner)).status, 204);
    assert.equal((await request('GET', endpoint)).body.participantCount, 1);

    assert.equal((await request('GET', endpoint, undefined, winner)).body.isJoined, false);
    assert.equal((await request('POST', '/writing/close', { writingId: id })).status, 401);
    assert.equal((await request('POST', '/writing/close', { writingId: id }, other)).status, 403);
    assert.equal((await request('POST', '/writing/close', { writingId: 0 }, author)).status, 400);
    assert.equal((await request('POST', '/writing/close', { writingId: 999 }, author)).status, 404);
    assert.equal((await request('POST', '/writing/close', { writingId: id }, author)).status, 204);
    assert.equal((await request('POST', '/writing/close', { writingId: id }, author)).status, 204);
    const closed = (await request('GET', endpoint)).body;
    assert.equal(closed.recruitmentStatus, 'CLOSED');
    assert.equal(closed.participantCount, 1);
    assert.equal(closed.pricePerPerson, 10001);
    assert.equal((await request('POST', '/writing/join', { writingId: id }, author)).body.code, 'RECRUITMENT_CLOSED');
    assert.equal((await request('POST', '/writing/join', { writingId: id }, other)).body.code, 'RECRUITMENT_CLOSED');
    assert.equal((await request('POST', '/writing/leave', { writingId: id }, other)).body.code, 'RECRUITMENT_CLOSED');
    assert.equal((await request('POST', '/writing/leave', { writingId: id }, author)).body.code, 'OWNER_CANNOT_LEAVE');

    const reportEndpoint = '/writing/accuse/' + id;
    assert.equal((await request('POST', reportEndpoint, { reason: 'Check this post' })).status, 401);
    assert.equal((await request('POST', reportEndpoint, { reason: '  ' }, other)).status, 400);
    const reported = await request('POST', reportEndpoint, { reason: ' Check this post ', reporterId: 3 }, other);
    assert.equal(reported.status, 201);
    assert.deepEqual({ ...db.prepare('SELECT writing_id, reporter_id, reason FROM reports WHERE id = ?').get(reported.body.id) }, {
        writing_id: id, reporter_id: 2, reason: 'Check this post'
    });
    assert.equal((await request('POST', reportEndpoint, { reason: 'Again' }, other)).body.code, 'ALREADY_REPORTED');

    assert.equal((await request('DELETE', endpoint)).status, 401);
    assert.equal((await request('DELETE', endpoint, undefined, other)).status, 403);
    assert.equal((await request('DELETE', endpoint, undefined, author)).status, 204);
    assert.equal((await request('DELETE', endpoint, undefined, author)).status, 404);
    assert.equal((await request('GET', endpoint)).status, 404);
    assert.equal((await request('POST', '/writing/close', { writingId: id }, author)).status, 404);
    assert.deepEqual((await request('GET', '/writing')).body, []);
    assert.equal((await request('POST', '/writing/join', { writingId: id }, other)).status, 404);
    assert.equal(db.prepare('SELECT deleted_by FROM writings WHERE id = ?').get(id).deleted_by, 1);
    assert.equal((await request('POST', reportEndpoint, { reason: 'Deleted post' }, third)).status, 404);
    assert.deepEqual((await request('GET', '/writing/me', undefined, author)).body, { written: [], joined: [] });
    assert.equal((await request('GET', '/other/main')).body.totalElements, 0);

    const olderId = db.prepare(`
        INSERT INTO writings (title, content, photo_url, author_id, created_at)
        VALUES ('Legacy', 'Older details', '/old.png', 1, 100)
    `).run().lastInsertRowid;
    initializeDatabase(db);
    const otherId = createWriting(db, { ...validFields, author_id: 2 });
    db.prepare('UPDATE writings SET created_at = 100 WHERE id = ?').run(otherId);

    const firstPage = (await request('GET', '/other/main?size=1')).body;
    assert.equal(firstPage.totalElements, 2);
    assert.equal(firstPage.hasNext, true);
    assert.equal(firstPage.items[0].id, otherId);
    const lastPage = (await request('GET', '/other/main?page=1&size=1')).body;
    assert.equal(lastPage.items[0].id, olderId);
    assert.equal(lastPage.hasNext, false);
    assert.equal(lastPage.items[0].pricePerPerson, null);
    assert.equal(lastPage.items[0].expectedPricePerPerson, null);
    const older = (await request('GET', '/writing/' + olderId)).body;
    assert.equal(older.pricePerPerson, null);
    assert.equal(older.expectedPricePerPerson, null);
    assert.equal((await request('POST', '/writing/join', { writingId: olderId }, other)).body.code, 'RECRUITMENT_CLOSED');
});
