const db = require('../config/db');
const { findById: findUserById } = require('../repositories/user.repository');
const { runInTransaction } = require('../../db/transaction');
const { createReport } = require('../repositories/report.repository');
const {
    findAllWritings, findWritingById, createWriting, updateWritingFields,
    hasParticipant, addParticipant, removeParticipant, markWritingDeleted, markRecruitmentClosed,
    findWrittenByUser, findJoinedByUser
} = require('../repositories/writing.repository');

const editableFields = {
    title: '제목을 입력해 주세요.',
    content: '본문을 입력해 주세요.',
    photoUrl: '사진 주소를 입력해 주세요.'
};

function getWritings() {
    return findAllWritings(db);
}

function hasPurchaseLimits(writing) {
    return writing.totalPrice > 0 && writing.targetCount >= 2;
}

function withEstimatedPrices(writing) {
    const valid = hasPurchaseLimits(writing);
    return {
        ...writing,
        pricePerPerson: valid && writing.participantCount > 0
            ? Math.ceil(writing.totalPrice / writing.participantCount)
            : null,
        expectedPricePerPerson: valid ? Math.ceil(writing.totalPrice / writing.targetCount) : null
    };
}

function withWritingDetails(writing, userId) {
    return {
        ...withEstimatedPrices(writing),
        isJoined: userId != null && hasParticipant(db, writing.id, userId)
    };
}

function getWriting(writingId, userId) {
    const writing = findWritingById(db, writingId);
    return writing && withWritingDetails(writing, userId);
}

function isWebUrl(value) {
    if (/[\s\\]/.test(value) || !/^https?:\/\//i.test(value)) return false;
    const url = URL.parse(value);
    return url !== null && !url.username && !url.password;
}

function isPhotoUrl(value) {
    return !/[\s\\]/.test(value) && (/^\/[^/]/.test(value) || isWebUrl(value));
}

function validatePurchase(body, values, errors) {
    const { productName, productUrl, totalPrice, targetCount } = body;
    if (typeof productName !== 'string' || !productName.trim()) {
        errors.push(['productName', '상품 이름을 입력해 주세요.']);
    }
    if (typeof productUrl !== 'string' || !isWebUrl(productUrl.trim())) {
        errors.push(['productUrl', '상품의 HTTP(S) 주소를 입력해 주세요.']);
    }
    if (!Number.isSafeInteger(totalPrice) || totalPrice < 1) {
        errors.push(['totalPrice', '총금액은 1 이상의 정수로 입력해 주세요.']);
    }
    if (!Number.isSafeInteger(targetCount) || targetCount < 2) {
        errors.push(['targetCount', '목표 인원은 작성자를 포함해 2명 이상이어야 합니다.']);
    }
    if (errors.length) return;

    values.productName = productName.trim();
    values.productUrl = productUrl.trim();
    values.totalPrice = totalPrice;
    values.targetCount = targetCount;
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

    if (!isPatch) validatePurchase(body, values, errors);
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
    const existing = findWritingById(db, writingId);
    if (!existing) return { code: 'POST_NOT_FOUND' };
    if (existing.author_id !== author_id) return { code: 'POST_ACCESS_DENIED' };

    const validation = validateWriting(body, true);
    if (validation.code) return validation;
    if (!Object.keys(validation.values).length) return { writing: withWritingDetails(existing, author_id) };

    const writing = updateWritingFields(db, { ...validation.values, writingId, author_id });
    if (!writing) return { code: 'POST_NOT_FOUND' };
    return { writing: withWritingDetails(writing, author_id) };
}

function closeWriting(writingId, userId) {
    return runInTransaction(db, () => {
        const writing = findWritingById(db, writingId);
        if (!writing) return { code: 'POST_NOT_FOUND' };
        if (writing.author_id !== userId) return { code: 'POST_ACCESS_DENIED' };
        if (writing.recruitmentStatus === 'OPEN') markRecruitmentClosed(db, writingId);
        return {};
    });
}

function joinWriting(writingId, userId) {
    return runInTransaction(db, () => {
        const writing = findWritingById(db, writingId);
        if (!writing) return { code: 'POST_NOT_FOUND' };
        if (writing.recruitmentStatus === 'CLOSED' || !hasPurchaseLimits(writing)) {
            return { code: 'RECRUITMENT_CLOSED' };
        }
        if (hasParticipant(db, writingId, userId)) return { code: 'ALREADY_JOINED' };
        if (writing.participantCount >= writing.targetCount) return { code: 'CAPACITY_EXCEEDED' };

        addParticipant(db, writingId, userId);
        return { writingId, participantCount: writing.participantCount + 1, joined: true };
    });
}

function leaveWriting(writingId, userId) {
    return runInTransaction(db, () => {
        const writing = findWritingById(db, writingId);
        if (!writing) return { code: 'POST_NOT_FOUND' };
        if (writing.author_id === userId) return { code: 'OWNER_CANNOT_LEAVE' };
        if (writing.recruitmentStatus === 'CLOSED') return { code: 'RECRUITMENT_CLOSED' };

        removeParticipant(db, writingId, userId);
        return {};
    });
}

function deleteWriting(writingId, userId) {
    const writing = findWritingById(db, writingId);
    if (!writing) return { code: 'POST_NOT_FOUND' };
    if (writing.author_id !== userId) return { code: 'POST_ACCESS_DENIED' };
    if (!markWritingDeleted(db, writingId, userId)) return { code: 'POST_NOT_FOUND' };
    return {};
}

function reportWriting(writingId, reporterId, body) {
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length > 1000) {
        return { code: 'VALIDATION_ERROR', fieldErrors: { reason: '신고 사유를 1자 이상 1,000자 이하로 입력해 주세요.' } };
    }

    const result = createReport(db, { writingId, reporterId, reason });
    if (result.changes) return { id: result.lastInsertRowid, writingId };
    if (!findWritingById(db, writingId)) return { code: 'POST_NOT_FOUND' };
    return { code: 'ALREADY_REPORTED' };
}

function getMyWritings(userId) {
    return {
        written: findWrittenByUser(db, userId),
        joined: findJoinedByUser(db, userId)
    };
}

module.exports = {
    getWritings, getWriting, addWriting, updateWriting, joinWriting, leaveWriting, deleteWriting, reportWriting,
    getMyWritings, closeWriting
};
