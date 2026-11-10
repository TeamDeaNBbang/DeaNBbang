const { promisify } = require('node:util');
const auth = require('../services/auth.service');
const { sessionCookieName } = require('../config/session');

async function login(req, res) {
    const user = await auth.authenticate(req.body ?? {});
    if (!user) {
        return res.status(401).json({ code: 'INVALID_CREDENTIALS' });
    }

    const regenerate = promisify(req.session.regenerate.bind(req.session));
    await regenerate();
    req.session.userId = user.id;
    await promisify(req.session.save.bind(req.session))();

    return res.json(user);
}

async function logout(req, res) {
    await promisify(req.session.destroy.bind(req.session))();
    return res.clearCookie(sessionCookieName, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
    }).status(204).end();
}

function getSessionStatus(req, res) {
    return res.set('Cache-Control', 'no-store').json({
        authenticated: req.session.userId != null,
    });
}

function sendResult(res, { status, code, user }) {
    if (code) return res.status(status).json({ code });
    if (user) return res.status(status).json(user);
    return res.status(status).end();
}

async function issueVerification(req, res) {
    return sendResult(res, await auth.issueVerification(req.body ?? {}));
}

function verifyEmail(req, res) {
    return sendResult(res, auth.verifyEmail(req.body ?? {}));
}

async function signup(req, res) {
    return sendResult(res, await auth.signup(req.body ?? {}));
}

module.exports = { login, logout, getSessionStatus, issueVerification, verifyEmail, signup };
