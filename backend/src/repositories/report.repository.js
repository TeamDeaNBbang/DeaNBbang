function createReport(db, { writingId, reporterId, reason }) {
    return db.prepare(`
        INSERT INTO reports (writing_id, reporter_id, reason, created_at)
        SELECT id, ?, ?, ?
        FROM writings WHERE id = ? AND deleted_at IS NULL
        ON CONFLICT(writing_id, reporter_id) DO NOTHING
    `).run(reporterId, reason, Date.now(), writingId);
}

module.exports = { createReport };
