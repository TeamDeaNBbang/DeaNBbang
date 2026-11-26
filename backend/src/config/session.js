const { randomBytes } = require('node:crypto');
const session = require('express-session');
const path = require('node:path');
const { dataDir } = require('./paths');
const SqliteSessionStore = require('./sqlite-session-store');
const production = process.env.NODE_ENV === 'production';

if (production && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
}

const sessionCookieName = 'daen.sid';
const sessionMiddleware = session({
    name: sessionCookieName,
    secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    store: production ? new SqliteSessionStore(path.join(dataDir, 'sessions.sqlite')) : undefined,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: production,
        maxAge: 8 * 60 * 60 * 1000,
    },
});

module.exports = { sessionMiddleware, sessionCookieName };
