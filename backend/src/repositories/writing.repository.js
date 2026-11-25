function findAllWritings(db) {
    return db.prepare(`
        SELECT id, title, photo_url AS photoUrl
        FROM writings
    `).all();
}

function findWritingById(db, writingId) {
    return db.prepare(`
        SELECT id, title, author_id, content, photo_url AS photoUrl
        FROM writings
        WHERE id = ?
    `).get(writingId);
}

function createWriting(db, { title, author_id, content, photoUrl }) {
    return db.prepare(`
        INSERT INTO writings (title, author_id, content, photo_url)
        VALUES (?, ?, ?, ?)
    `).run(title, author_id, content, photoUrl).lastInsertRowid;
}

function updateWritingFields(db, { writingId, author_id, title, content, photoUrl }) {
    return db.prepare(`
        UPDATE writings
        SET title = COALESCE(?, title),
            content = COALESCE(?, content),
            photo_url = COALESCE(?, photo_url)
        WHERE id = ? AND author_id = ?
        RETURNING id, title, author_id, content, photo_url AS photoUrl
    `).get(title ?? null, content ?? null, photoUrl ?? null, writingId, author_id);
}

module.exports = { findAllWritings, findWritingById, createWriting, updateWritingFields };
