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
    if (!writings.deleteByAdmin(req.params.writingId, req.user.id)) {
        return res.status(404).json({ code: 'POST_NOT_FOUND' });
    }
    return res.status(204).end();
}

module.exports = { listReports, deleteWriting };
