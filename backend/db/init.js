const { readFileSync } = require('node:fs');
const path = require('node:path');

const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

function initializeDatabase(db) {
    db.exec('BEGIN IMMEDIATE');
    try {
        db.exec(schema);

        const columns = new Set(db.prepare('PRAGMA table_info(writings)').all().map(column => column.name));
        // Old posts can lack these fields. All new posts require both at the API.
        if (!columns.has('content')) {
            db.exec('ALTER TABLE writings ADD COLUMN content TEXT');
        }
        if (!columns.has('photo_url')) {
            db.exec('ALTER TABLE writings ADD COLUMN photo_url TEXT');
        }
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

module.exports = { initializeDatabase };
