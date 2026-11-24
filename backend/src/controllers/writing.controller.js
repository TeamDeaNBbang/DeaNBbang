const writings = require('../repositories/writing.repository');
const reports = require('../repositories/report.repository');

function list(req, res) {
    const page = writings.listVisible({ before: res.locals.before, limit: 51 });
    return res.json({
        writings: page.slice(0, 50),
        nextCursor: page.length > 50 ? page[49].id : null,
    });
}

function detail(req, res) {
    const writing = writings.findVisibleById(req.params.writingId);
    if (!writing) return res.status(404).json({ code: 'POST_NOT_FOUND' });
    return res.json(writing);
}

function report(req, res) {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason || reason.length > 1000) {
        return res.status(400).json({ code: 'VALIDATION_ERROR' });
    }
    const writingId = req.params.writingId;
    const result = reports.createReport({ writingId, reporterId: req.user.id, reason });
    if (result.changes === 0) {
        if (!writings.findVisibleById(writingId)) {
            return res.status(404).json({ code: 'POST_NOT_FOUND' });
        }
        return res.status(409).json({ code: 'ALREADY_REPORTED' });
    }
    return res.status(201).json({ id: result.lastInsertRowid, writingId });
}

module.exports = { list, detail, report };
