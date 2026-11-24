const db = require('../config/db');

function createReport({ writingId, reporterId, reason }) {
    return db.prepare(`
        INSERT INTO reports (writing_id, reporter_id, reason, created_at)
        SELECT id, ?, ?, ? FROM writings WHERE id = ? AND deleted_at IS NULL
        ON CONFLICT(writing_id, reporter_id) DO NOTHING
    `).run(reporterId, reason, Date.now(), writingId);
}

function listPending({ before, limit }) {
    return db.prepare(`
        SELECT r.id, r.reason, r.created_at AS createdAt,
               r.writing_id AS writingId, w.title, w.content,
               w.author_id AS authorId, a.username AS authorName,
               r.reporter_id AS reporterId, u.username AS reporterName
        FROM reports r
        JOIN writings w ON w.id = r.writing_id
        JOIN users a ON a.id = w.author_id
        JOIN users u ON u.id = r.reporter_id
        WHERE w.deleted_at IS NULL AND r.id < ?
        ORDER BY r.id DESC LIMIT ?
    `).all(before, limit);
}

module.exports = { createReport, listPending };
