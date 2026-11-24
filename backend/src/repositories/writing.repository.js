const db = require('../config/db');

function listVisible({ before, limit }) {
    return db.prepare(`
        SELECT w.id, w.title, w.content, w.created_at AS createdAt,
               w.author_id AS authorId, u.username AS authorName
        FROM writings w JOIN users u ON u.id = w.author_id
        WHERE w.deleted_at IS NULL AND w.id < ?
        ORDER BY w.id DESC LIMIT ?
    `).all(before, limit);
}

function findVisibleById(id) {
    return db.prepare(`
        SELECT w.id, w.title, w.content, w.created_at AS createdAt,
               w.author_id AS authorId, u.username AS authorName
        FROM writings w JOIN users u ON u.id = w.author_id
        WHERE w.id = ? AND w.deleted_at IS NULL
    `).get(id);
}

function deleteByAdmin(id, adminId) {
    return db.prepare(`
        UPDATE writings SET deleted_at = ?, deleted_by = ?
        WHERE id = ? AND deleted_at IS NULL
    `).run(Date.now(), adminId, id).changes === 1;
}

module.exports = { listVisible, findVisibleById, deleteByAdmin };
