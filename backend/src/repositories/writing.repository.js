function findAllWritings(db) {
    const query = db.prepare(`
        SELECT id,title 
        FROM writings
        `)

    return query.all()
}

module.exports = {findAllWritings}