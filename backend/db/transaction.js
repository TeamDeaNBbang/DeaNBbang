function runInTransaction(db, work) {
    db.exec('BEGIN IMMEDIATE');
    try {
        const result = work();
        db.exec('COMMIT');
        return result;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

module.exports = { runInTransaction };
