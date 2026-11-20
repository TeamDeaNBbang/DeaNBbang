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

module.exports = {findAllWritings, findWritingById}