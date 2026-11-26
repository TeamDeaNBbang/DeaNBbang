const { runInTransaction } = require('../../db/transaction');

const detailColumns = `
    id, title, author_id, content, photo_url AS photoUrl,
    product_name AS productName, product_url AS productUrl, total_price AS totalPrice,
    target_participant_count AS targetParticipantCount, recruitment_ends_at AS recruitmentEndsAt,
    (SELECT COUNT(*) FROM writing_participants p WHERE p.writing_id = writings.id) AS participantCount
`;

function findAllWritings(db) {
    return db.prepare(`
        SELECT id, title, photo_url AS photoUrl
        FROM writings
    `).all();
}

function findWritingById(db, writingId) {
    return db.prepare(`
        SELECT ${detailColumns}
        FROM writings
        WHERE id = ?
    `).get(writingId);
}

function createWriting(db, {
    title, author_id, content, photoUrl, productName, productUrl,
    totalPrice, targetParticipantCount, recruitmentEndsAt = null
}) {
    return runInTransaction(db, () => {
        const { lastInsertRowid } = db.prepare(`
            INSERT INTO writings (
                title, author_id, content, photo_url, product_name, product_url,
                total_price, target_participant_count, recruitment_ends_at, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(title, author_id, content, photoUrl, productName, productUrl,
            totalPrice, targetParticipantCount, recruitmentEndsAt, Date.now());

        addParticipant(db, lastInsertRowid, author_id);
        return lastInsertRowid;
    });
}

function updateWritingFields(db, { writingId, author_id, title, content, photoUrl }) {
    return db.prepare(`
        UPDATE writings
        SET title = COALESCE(?, title),
            content = COALESCE(?, content),
            photo_url = COALESCE(?, photo_url)
        WHERE id = ? AND author_id = ?
        RETURNING ${detailColumns}
    `).get(title ?? null, content ?? null, photoUrl ?? null, writingId, author_id);
}

function hasParticipant(db, writingId, userId) {
    return Boolean(db.prepare(`
        SELECT 1 FROM writing_participants WHERE writing_id = ? AND user_id = ?
    `).get(writingId, userId));
}

function addParticipant(db, writingId, userId) {
    db.prepare('INSERT INTO writing_participants (writing_id, user_id) VALUES (?, ?)')
        .run(writingId, userId);
}

function removeParticipant(db, writingId, userId) {
    db.prepare('DELETE FROM writing_participants WHERE writing_id = ? AND user_id = ?')
        .run(writingId, userId);
}

module.exports = {
    findAllWritings, findWritingById, createWriting, updateWritingFields,
    hasParticipant, addParticipant, removeParticipant
};
