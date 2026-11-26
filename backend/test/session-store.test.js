const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const SqliteSessionStore = require('../src/config/sqlite-session-store');

function read(store, sid) {
    return new Promise((resolve, reject) => store.get(sid, (error, data) => error ? reject(error) : resolve(data)));
}

test('SQLite sessions survive reopening, extend expiry and remove expired sessions', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'daen-session-'));
    const filename = path.join(directory, 'sessions.sqlite');
    let store = new SqliteSessionStore(filename);
    try {
        store.set('active', { userId: 12, cookie: { expires: new Date(Date.now() + 60000) } });
        store.close();
        store = new SqliteSessionStore(filename);
        assert.equal((await read(store, 'active')).userId, 12);
        store.touch('active', { cookie: { expires: new Date(Date.now() - 1) } });
        assert.equal(await read(store, 'active'), null);
        assert.equal(store.db.prepare('SELECT count(*) AS count FROM sessions').get().count, 0);
    } finally {
        store.close();
        rmSync(directory, { recursive: true, force: true });
    }
});

test('secure proxy cookies preserve login across restart and logout removes the stored session', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'daen-proxy-session-'));
    const filename = path.join(directory, 'sessions.sqlite');
    let store;
    let server;
    async function start() {
        store = new SqliteSessionStore(filename);
        const app = express();
        app.set('trust proxy', 1);
        app.use(session({
            name: 'daen.sid', secret: 'test-secret-with-more-than-thirty-two-characters',
            store, resave: false, saveUninitialized: false,
            cookie: { secure: true, httpOnly: true, sameSite: 'lax', maxAge: 3600000 },
        }));
        app.post('/login', (req, res) => req.session.regenerate(error => {
            if (error) return res.sendStatus(500);
            req.session.userId = 12;
            res.sendStatus(204);
        }));
        app.get('/session', (req, res) => res.json({ userId: req.session.userId || null }));
        app.post('/logout', (req, res) => req.session.destroy(error => res.sendStatus(error ? 500 : 204)));
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        return `http://127.0.0.1:${server.address().port}`;
    }
    async function stop() {
        await new Promise(resolve => server.close(resolve));
        store.close();
        server = null;
    }
    try {
        let base = await start();
        const insecure = await fetch(base + '/login', { method: 'POST' });
        assert.equal(insecure.headers.get('set-cookie'), null);
        const login = await fetch(base + '/login', { method: 'POST', headers: { 'X-Forwarded-Proto': 'https' } });
        const setCookie = login.headers.get('set-cookie');
        assert.match(setCookie, /; Secure/);
        assert.match(setCookie, /; HttpOnly/);
        assert.match(setCookie, /; SameSite=Lax/);
        const cookie = setCookie.split(';')[0];
        await stop();
        base = await start();
        const headers = { cookie, 'X-Forwarded-Proto': 'https' };
        assert.deepEqual(await (await fetch(base + '/session', { headers })).json(), { userId: 12 });
        assert.equal((await fetch(base + '/logout', { method: 'POST', headers })).status, 204);
        await stop();
        base = await start();
        assert.deepEqual(await (await fetch(base + '/session', { headers })).json(), { userId: null });
    } finally {
        if (server) await stop();
        rmSync(directory, { recursive: true, force: true });
    }
});
