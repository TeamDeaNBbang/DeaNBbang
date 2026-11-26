function createReport(db, { writingId, reporterId, reason }) {
    return db.prepare(`
        INSERT INTO reports (writing_id, reporter_id, reason, created_at)
        SELECT id, ?, ?, ?
        FROM writings WHERE id = ? AND deleted_at IS NULL
        ON CONFLICT(writing_id, reporter_id) DO NOTHING
    `).run(reporterId, reason, Date.now(), writingId);
}

function listPending(db, before, limit) {
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

function listReportedWritings(db, size, offset) {
    return db.prepare(`
        WITH latest_reports AS (
            SELECT r.*,
                   COUNT(*) OVER (PARTITION BY r.writing_id) AS reportCount,
                   ROW_NUMBER() OVER (
                       PARTITION BY r.writing_id ORDER BY r.created_at DESC, r.id DESC
                   ) AS reportOrder
            FROM reports r JOIN writings w ON w.id = r.writing_id
            WHERE w.deleted_at IS NULL
        )
        SELECT r.writing_id AS writingId, w.title, r.reportCount,
               r.reason, r.created_at AS createdAt
        FROM latest_reports r JOIN writings w ON w.id = r.writing_id
        WHERE r.reportOrder = 1
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT ? OFFSET ?
    `).all(size, offset);
}

function countReportedWritings(db) {
    return db.prepare(`
        SELECT COUNT(DISTINCT r.writing_id) AS count
        FROM reports r JOIN writings w ON w.id = r.writing_id
        WHERE w.deleted_at IS NULL
    `).get().count;
}

module.exports = { createReport, listPending, listReportedWritings, countReportedWritings };
