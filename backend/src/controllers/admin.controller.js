const admin = require('../services/admin.service');

function validationError(res, fieldErrors) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '요청 값을 확인해 주세요.', fieldErrors });
}

function pageNumber(raw, fallback) {
    return raw === undefined ? fallback : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
}

function listReports(req, res) {
    const page = pageNumber(req.query.page, 0);
    const size = pageNumber(req.query.size, 20);
    const errors = {};
    if (!Number.isSafeInteger(page) || page < 0) errors.page = '페이지는 0 이상의 정수여야 합니다.';
    if (!Number.isInteger(size) || size < 1 || size > 100) errors.size = '페이지 크기는 1~100 사이여야 합니다.';
    if (!errors.page && !errors.size && !Number.isSafeInteger(page * size)) errors.page = '페이지 번호가 너무 큽니다.';
    if (Object.keys(errors).length) return validationError(res, errors);
    return res.json(admin.listReports(page, size));
}

function deleteWriting(req, res) {
    const raw = req.params.writingId;
    const writingId = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(writingId) || writingId < 1) {
        return validationError(res, { writingId: '글 번호는 양의 정수여야 합니다.' });
    }
    const result = admin.deleteWriting(writingId, req.user.id, req.body);
    if (result.code === 'VALIDATION_ERROR') return validationError(res, result.fieldErrors);
    if (result.code) return res.status(404).json({ code: result.code, message: '글을 찾을 수 없습니다.' });
    return res.status(204).end();
}

function handleError(error, req, res, next) {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') return validationError(res, { body: '올바른 JSON을 보내 주세요.' });
    if (error.type === 'entity.too.large') {
        return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: '요청 본문이 너무 큽니다.' });
    }
    console.error('Administrator request failed', { code: error.code || 'INTERNAL_SERVER_ERROR' });
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: '요청을 처리하지 못했습니다.' });
}

module.exports = { listReports, deleteWriting, handleError };
