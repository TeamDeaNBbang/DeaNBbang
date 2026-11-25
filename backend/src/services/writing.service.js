const db = require('../config/db');
const { findById: findUserById } = require('../repositories/user.repository');
const { findAllWritings, findWritingById, createWriting, updateWritingFields } = require('../repositories/writing.repository');

const editableFields = {
    title: '제목을 입력해 주세요.',
    content: '본문을 입력해 주세요.',
    photoUrl: '사진 주소를 입력해 주세요.'
};

function getWritings() {
    return findAllWritings(db);
}

function getWriting(writingId) {
    return findWritingById(db, writingId);
}

function isPhotoUrl(value) {
    if (/[\s\\]/.test(value)) return false;
    if (/^\/[^/]/.test(value)) return true;
    if (!/^https?:\/\//i.test(value)) return false;
    const url = URL.parse(value);
    return url !== null && !url.username && !url.password;
}

function validateWriting(body, isPatch) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { code: 'VALIDATION_ERROR', fieldErrors: { body: 'JSON 객체를 보내 주세요.' } };
    }

    const errors = [];
    const values = {};
    if (isPatch) {
        for (const name of Object.keys(body)) {
            if (!Object.hasOwn(editableFields, name)) {
                errors.push([name, '수정할 수 없는 항목입니다.']);
            }
        }
    }

    for (const [name, message] of Object.entries(editableFields)) {
        if (isPatch && !Object.hasOwn(body, name)) continue;
        const value = body[name];
        if (typeof value !== 'string' || !value.trim()) {
            errors.push([name, message]);
        } else if (name === 'photoUrl' && !isPhotoUrl(value.trim())) {
            errors.push([name, 'HTTP(S) 주소 또는 서버에서 받은 사진 경로를 입력해 주세요.']);
        } else {
            values[name] = value.trim();
        }
    }

    if (errors.length) return { code: 'VALIDATION_ERROR', fieldErrors: Object.fromEntries(errors) };
    return { values };
}

function addWriting({ author_id, body }) {
    const validation = validateWriting(body, false);
    if (validation.code) return validation;
    if (!findUserById(author_id)) return { code: 'USER_NOT_FOUND' };

    return { writingId: createWriting(db, { ...validation.values, author_id }) };
}

function updateWriting({ writingId, author_id, body }) {
    const existing = getWriting(writingId);
    if (!existing) return { code: 'POST_NOT_FOUND' };
    if (existing.author_id !== author_id) return { code: 'POST_ACCESS_DENIED' };

    const validation = validateWriting(body, true);
    if (validation.code) return validation;
    if (!Object.keys(validation.values).length) return { writing: existing };

    const writing = updateWritingFields(db, { ...validation.values, writingId, author_id });
    if (!writing) return { code: 'POST_NOT_FOUND' };
    return { writing };
}

module.exports = { getWritings, getWriting, addWriting, updateWriting };
