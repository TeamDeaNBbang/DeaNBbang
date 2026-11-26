const { randomBytes } = require('node:crypto');
const session = require('express-session');

if (process.env.NODE_ENV === 'production') {
    throw new Error('Configure a persistent session store before deploying.');
}

const sessionCookieName = 'daen.sid';
const sessionMiddleware = session({
    name: sessionCookieName,
    secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
    },
});

module.exports = { sessionMiddleware, sessionCookieName };
