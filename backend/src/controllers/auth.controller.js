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

async function verifyEmail(req, res) {
    const result = auth.verifyEmail(req.body ?? {});
    if (result.verification) {
        req.session.emailVerification = result.verification;
        await promisify(req.session.save.bind(req.session))();
    }
    return sendResult(res, result);
}

async function signup(req, res) {
    const result = await auth.signup(req.body ?? {}, req.session.emailVerification);
    if (result.status === 201) {
        delete req.session.emailVerification;
        await promisify(req.session.save.bind(req.session))();
    }
    return sendResult(res, result);
}

module.exports = { login, logout, getSessionStatus, issueVerification, verifyEmail, signup };
