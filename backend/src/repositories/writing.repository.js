function findAllWritings(db) {
    const query = db.prepare(`
        SELECT id,title 
        FROM practice_writings
        `)

    return query.all()
}

module.exports = {findAllWritings}