const db = require('../config/db');
const { listPending, listReportedWritings, countReportedWritings } = require('../repositories/report.repository');
const { deleteByAdmin } = require('../repositories/writing.repository');
const { readPagination } = require('../middleware/pagination');

function listReports(req, res) {
    const reports = listPending(db, res.locals.before, 51);
    return res.json({
        reports: reports.slice(0, 50),
        nextCursor: reports.length > 50 ? reports[49].id : null
    });
}

function listAccusedWritings(req, res) {
    const { page, size, offset, fieldErrors } = readPagination(req.query);
    if (Object.keys(fieldErrors).length) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: '요청 값을 확인해 주세요.', fieldErrors });
    }
    const items = listReportedWritings(db, size, offset);
    const totalElements = countReportedWritings(db);
    return res.json({ items, page, size, totalElements, hasNext: offset + items.length < totalElements });
}

function deleteWithReason(req, res, rawReason) {
    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
    if (!reason || reason.length > 1000) {
        return res.status(400).json({
            code: 'VALIDATION_ERROR', message: '요청 값을 확인해 주세요.',
            fieldErrors: { reason: '삭제 사유를 1자 이상 1,000자 이하로 입력해 주세요.' }
        });
    }
    if (!deleteByAdmin(db, res.locals.writingId, req.user.id, reason)) {
        return res.status(404).json({ code: 'POST_NOT_FOUND', message: '글을 찾을 수 없습니다.' });
    }
    return res.status(204).end();
}

function deleteWriting(req, res) {
    return deleteWithReason(req, res, req.body?.reason);
}

function deleteAccusedWriting(req, res) {
    const reason = req.body?.reason === undefined ? '관리자 검토 후 삭제되었습니다.' : req.body.reason;
    return deleteWithReason(req, res, reason);
}

module.exports = { listReports, listAccusedWritings, deleteWriting, deleteAccusedWriting };
