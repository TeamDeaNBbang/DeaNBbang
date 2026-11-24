function findAllWritings(db) {
    const query = db.prepare(`
        SELECT id,title 
        FROM writings
        `)

    return query.all()
}

function findWritingById(db, writingId) {
    const query = db.prepare(`
    SELECT id, title, author_id
    FROM writings
    WHERE id = ?
    `)

    return query.get(writingId)
}

const createWriting = (db, {title, author_id}) => {
    const query = db.prepare(`
    INSERT INTO writings (title, author_id)
    VALUES (?,?)
    `)

    const result = query.run(title, author_id)
    return result.lastInsertRowid
}

const updateWritingTitle = (db, {writingId, author_id, title}) => {
    const query = db.prepare(`
    UPDATE writings
    SET title = ?
    WHERE id = ? AND author_id = ?
    `)

    const result = query.run(title, writingId, author_id)
    return result.changes
}

module.exports = {findAllWritings, findWritingById, createWriting, updateWritingTitle}