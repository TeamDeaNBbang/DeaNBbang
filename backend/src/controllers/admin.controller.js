const db = require('../config/db');
const { listPending } = require('../repositories/report.repository');
const admin = require('../services/admin.service');
const { readPagination } = require('../middleware/pagination');

function listReports(req, res) {
    const reports = listPending(db, res.locals.before, 51);
    return res.json({
        reports: reports.slice(0, 50),
        nextCursor: reports.length > 50 ? reports[49].id : null
    });
}

function listAccusedWritings(req, res) {
    const { page, size, fieldErrors } = readPagination(req.query);
    if (Object.keys(fieldErrors).length) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: '요청 값을 확인해 주세요.', fieldErrors });
    }
    return res.json(admin.listReports(page, size));
}

function deleteWithReason(req, res, rawReason) {
    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
    if (!reason || reason.length > 1000) {
        return res.status(400).json({
            code: 'VALIDATION_ERROR', message: '요청 값을 확인해 주세요.',
            fieldErrors: { reason: '삭제 사유를 1자 이상 1,000자 이하로 입력해 주세요.' }
        });
    }
    const result = admin.deleteWriting(res.locals.writingId, req.user.id, { reason });
    if (result.code) {
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

function handleError(error, req, res, next) {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: '요청 값을 확인해 주세요.', fieldErrors: { body: '올바른 JSON을 보내 주세요.' } });
    }
    if (error.type === 'entity.too.large') {
        return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: '요청 본문이 너무 큽니다.' });
    }
    console.error('Administrator request failed', { code: error.code || 'INTERNAL_SERVER_ERROR' });
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: '요청을 처리하지 못했습니다.' });
}

module.exports = { listReports, listAccusedWritings, deleteWriting, deleteAccusedWriting, handleError };
