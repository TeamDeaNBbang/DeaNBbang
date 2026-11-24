const reports = require('../repositories/report.repository');
const writings = require('../repositories/writing.repository');

function listReports(req, res) {
    const page = reports.listPending({ before: res.locals.before, limit: 51 });
    return res.json({
        reports: page.slice(0, 50),
        nextCursor: page.length > 50 ? page[49].id : null,
    });
}

function deleteWriting(req, res) {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason || reason.length > 1000) {
        return res.status(400).json({ code: 'VALIDATION_ERROR' });
    }
    if (!writings.deleteByAdmin(req.params.writingId, req.user.id, reason)) {
        return res.status(404).json({ code: 'POST_NOT_FOUND' });
    }
    return res.status(204).end();
}

module.exports = { listReports, deleteWriting };
