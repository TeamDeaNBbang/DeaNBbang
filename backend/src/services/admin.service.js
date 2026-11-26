const db = require('../config/db');
const { runInTransaction } = require('../../db/transaction');
const { findReportedWritings, countReportedWritings, deleteWritingAndQueueNotice } = require('../repositories/admin.repository');

function listReports(page, size) {
    return runInTransaction(db, () => {
        const offset = page * size;
        const items = findReportedWritings(db, { size, offset });
        const totalElements = countReportedWritings(db);
        return { items, page, size, totalElements, hasNext: offset + items.length < totalElements };
    });
}

function deleteWriting(writingId, adminId, body) {
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length > 1000) {
        return { code: 'VALIDATION_ERROR', fieldErrors: { reason: '삭제 사유를 1자 이상 1,000자 이하로 입력해 주세요.' } };
    }
    return deleteWritingAndQueueNotice(db, { writingId, adminId, reason }) ? {} : { code: 'POST_NOT_FOUND' };
}

module.exports = { listReports, deleteWriting };
