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
    productName: 'Water', productUrl: 'https://example.test/water', totalPrice: 12000,
    targetParticipantCount: 2
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
    `);

    initializeDatabase(db);
    initializeDatabase(db);
    assert.deepEqual({ ...findWritingById(db, 3) }, {
        id: 3, title: 'Older post', author_id: 1, content: null, photoUrl: null,
        productName: null, productUrl: null, totalPrice: null, targetParticipantCount: null,
        recruitmentEndsAt: null, participantCount: 1
    });

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
        return { status: response.status, body: await response.json(), headers: response.headers };
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

    const created = await request('POST', '/writing', { ...validFields, photoUrl, author_id: 2 }, author);
    assert.equal(created.status, 201);
    const id = created.body.writingId;
    const endpoint = '/writing/' + id;
    const expected = { id, ...validFields, photoUrl, author_id: 1, recruitmentEndsAt: null, participantCount: 1 };
    assert.deepEqual((await request('GET', '/writing')).body, [{ id, title: validFields.title, photoUrl }]);
    assert.deepEqual((await request('GET', endpoint)).body, expected);

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
    assert.deepEqual(edited.body, { ...expected, content });
    const replacement = '/images/replacement.png';
    const changedPhoto = await request('PATCH', endpoint, { photoUrl: replacement }, author);
    assert.equal(changedPhoto.status, 200);
    assert.deepEqual(changedPhoto.body, { ...expected, content, photoUrl: replacement });
    assert.deepEqual((await request('GET', '/writing')).body, [{ id, title: validFields.title, photoUrl: replacement }]);
});
