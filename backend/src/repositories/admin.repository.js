const { runInTransaction } = require('../../db/transaction');

function findReportedWritings(db, { size, offset }) {
    const items = db.prepare(`
        SELECT w.id AS writingId, w.title, w.content, w.photo_url AS photoUrl,
               w.author_id AS authorId, u.username AS authorName,
               COUNT(r.id) AS reportCount, MAX(r.created_at) AS latestReportAt
        FROM writings w
        JOIN reports r ON r.writing_id = w.id
        JOIN users u ON u.id = w.author_id
        WHERE w.deleted_at IS NULL
        GROUP BY w.id
        ORDER BY latestReportAt DESC, MAX(r.id) DESC, w.id DESC
        LIMIT ? OFFSET ?
    `).all(size, offset);
    if (!items.length) return [];

    const reports = db.prepare(`
        SELECT r.id, r.writing_id AS writingId, r.reporter_id AS reporterId,
               u.username AS reporterName, r.reason, r.created_at AS createdAt
        FROM reports r
        JOIN users u ON u.id = r.reporter_id
        WHERE r.writing_id IN (${items.map(() => '?').join(',')})
        ORDER BY r.created_at DESC, r.id DESC
    `).all(...items.map(item => item.writingId));
    const byWriting = new Map(items.map(item => [item.writingId, []]));
    for (const report of reports) {
        const { writingId, ...details } = report;
        byWriting.get(writingId).push(details);
    }
    return items.map(item => ({
        ...item,
        reason: byWriting.get(item.writingId)[0]?.reason,
        createdAt: item.latestReportAt,
        reports: byWriting.get(item.writingId)
    }));
}

function countReportedWritings(db) {
    return db.prepare(`
        SELECT COUNT(*) AS count FROM writings w
        WHERE w.deleted_at IS NULL AND EXISTS (SELECT 1 FROM reports r WHERE r.writing_id = w.id)
    `).get().count;
}

function deleteWritingAndQueueNotice(db, { writingId, adminId, reason }) {
    return runInTransaction(db, () => {
        const writing = db.prepare(`
            SELECT w.title, u.email FROM writings w JOIN users u ON u.id = w.author_id
            WHERE w.id = ? AND w.deleted_at IS NULL
        `).get(writingId);
        if (!writing) return false;
        const deletedAt = Date.now();
        db.prepare(`
            UPDATE writings SET deleted_at = ?, deleted_by = ?, deletion_reason = ?
            WHERE id = ? AND deleted_at IS NULL
        `).run(deletedAt, adminId, reason, writingId);
        db.prepare(`
            INSERT INTO deletion_notifications (writing_id, recipient, title, deleted_at, deletion_reason)
            VALUES (?, ?, ?, ?, ?)
        `).run(writingId, writing.email, writing.title, deletedAt, reason);
        return true;
    });
}

module.exports = { findReportedWritings, countReportedWritings, deleteWritingAndQueueNotice };
