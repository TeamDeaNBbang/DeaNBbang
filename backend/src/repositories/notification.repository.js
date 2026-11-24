const db = require('../config/db');

function claimNext() {
    const now = Date.now();
    // Reserve one delivery so concurrent workers cannot send it simultaneously.
    return db.prepare(`
        UPDATE deletion_notifications
        SET attempts = attempts + 1, next_attempt_at = ?
        WHERE id = (
            SELECT id FROM deletion_notifications
            WHERE sent_at IS NULL AND attempts < 5 AND next_attempt_at <= ?
            ORDER BY id LIMIT 1
        )
        RETURNING id, writing_id AS writingId, recipient, title,
                  deleted_at AS deletedAt, attempts
    `).get(now + 120000, now);
}

function markSent(id, attempt) {
    db.prepare('UPDATE deletion_notifications SET sent_at = ? WHERE id = ? AND attempts = ?')
        .run(Date.now(), id, attempt);
}

function scheduleRetry(id, attempt) {
    const delay = 60000 * (2 ** (attempt - 1));
    db.prepare('UPDATE deletion_notifications SET next_attempt_at = ? WHERE id = ? AND attempts = ?')
        .run(Date.now() + delay, id, attempt);
}

module.exports = { claimNext, markSent, scheduleRetry };
