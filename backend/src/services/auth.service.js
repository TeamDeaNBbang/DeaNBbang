const { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const users = require('../repositories/user.repository');
const verifications = require('../repositories/verification.repository');
const mail = require('./email.service');
const db = require('../config/db');

const deriveKey = promisify(scrypt);
const scryptOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const hashPattern = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/;
const verificationSecret = process.env.EMAIL_VERIFICATION_SECRET || randomBytes(32);
const codeLifetime = 10 * 60 * 1000;
const resendDelay = 60 * 1000;

function normalizeEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validEmail(email) {
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function codeHashFor(email, code) {
    return createHmac('sha256', verificationSecret).update(email + '\n' + code).digest('hex');
}

async function authenticate({ email, password }) {
    if (typeof email !== 'string' || !email.trim() ||
        typeof password !== 'string' || !password || password.length > 256) {
        return null;
    }

    const user = users.findByEmail(normalizeEmail(email));
    const storedHash = user?.password_hash.match(hashPattern);
    const salt = Buffer.from(storedHash?.[1] ?? '0'.repeat(32), 'hex');
    const expected = Buffer.from(storedHash?.[2] ?? '0'.repeat(128), 'hex');
    const actual = await deriveKey(password, salt, expected.length, scryptOptions);

    if (!timingSafeEqual(actual, expected) || !storedHash) {
        return null;
    }

    return { id: user.id, username: user.username, role: user.role };
}

async function issueVerification(body) {
    const email = normalizeEmail(body.email);
    if (!validEmail(email)) return { status: 400, code: 'VALIDATION_ERROR' };
    if (users.findByEmail(email)) return { status: 409, code: 'EMAIL_ALREADY_EXISTS' };

    const now = Date.now();
    const previous = verifications.findByEmail(email);
    if (previous && previous.expiresAt - codeLifetime + resendDelay > now) {
        return { status: 429, code: 'TOO_MANY_REQUESTS' };
    }

    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const codeHash = codeHashFor(email, code);
    verifications.saveVerification({ email, codeHash, expiresAt: now + codeLifetime });
    try {
        await mail.sendVerificationCode(email, code);
    } catch {
        verifications.deleteVerification(email, codeHash);
        return { status: 503, code: 'EMAIL_DELIVERY_FAILED' };
    }

    return { status: 204 };
}

function verifyEmail(body) {
    const email = normalizeEmail(body.email);
    const { code } = body;
    if (!validEmail(email) || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
        return { status: 400, code: 'VALIDATION_ERROR' };
    }

    const record = verifications.findByEmail(email);
    if (!record) return { status: 400, code: 'EMAIL_VERIFICATION_NOT_FOUND' };
    const now = Date.now();
    if (record.expiresAt <= now) return { status: 400, code: 'EMAIL_VERIFICATION_EXPIRED' };
    const codeHash = codeHashFor(email, code);
    const storedCode = Buffer.from(record.codeHash, 'hex');
    const submittedCode = Buffer.from(codeHash, 'hex');
    if (storedCode.length !== submittedCode.length || !timingSafeEqual(storedCode, submittedCode)) {
        return { status: 400, code: 'INVALID_VERIFICATION_CODE' };
    }
    if (record.verifiedAt == null) {
        verifications.markVerified({ email, codeHash, verifiedAt: now });
    }

    return { status: 204 };
}

function signupEligibility(email) {
    if (users.findByEmail(email)) return { status: 409, code: 'EMAIL_ALREADY_EXISTS' };
    const record = verifications.findByEmail(email);
    if (!record) return { status: 400, code: 'EMAIL_VERIFICATION_NOT_FOUND' };
    if (record.verifiedAt == null || record.expiresAt <= Date.now()) {
        return { status: 400, code: 'EMAIL_NOT_VERIFIED' };
    }
    return { record };
}

async function signup(body) {
    const email = normalizeEmail(body.email);
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const studentNumber = typeof body.studentNumber === 'string' ? body.studentNumber.trim() : '';
    const { password, passwordConfirmation } = body;
    if (!validEmail(email) || !username || username.length > 64 ||
        !studentNumber || studentNumber.length > 32 ||
        typeof password !== 'string' || password.length < 8 || password.length > 256 ||
        password !== passwordConfirmation) {
        return { status: 400, code: 'VALIDATION_ERROR' };
    }

    const eligibility = signupEligibility(email);
    if (eligibility.code) return eligibility;
    const salt = randomBytes(16);
    const key = await deriveKey(password, salt, 64, scryptOptions);
    const passwordHash = ['scrypt', salt.toString('hex'), key.toString('hex')].join('$');

    db.exec('BEGIN IMMEDIATE');
    try {
        const current = signupEligibility(email);
        if (current.code) {
            db.exec('ROLLBACK');
            return current;
        }
        const id = users.createUser({ email, username, studentNumber, passwordHash });
        verifications.deleteVerification(email, current.record.codeHash);
        db.exec('COMMIT');
        return { status: 201, user: { id, username, role: 'USER' } };
    } catch (error) {
        db.exec('ROLLBACK');
        const duplicateCodes = {
            'UNIQUE constraint failed: users.email': 'EMAIL_ALREADY_EXISTS',
            'UNIQUE constraint failed: users.username': 'USERNAME_ALREADY_EXISTS',
            'UNIQUE constraint failed: users.student_number': 'STUDENT_NUMBER_ALREADY_EXISTS',
        };
        const code = duplicateCodes[error.message];
        if (code) return { status: 409, code };
        throw error;
    }
}

module.exports = { authenticate, issueVerification, verifyEmail, signup };
