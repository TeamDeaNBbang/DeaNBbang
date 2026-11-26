const { readFileSync } = require('node:fs');
const path = require('node:path');

const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

function initializeDatabase(db) {
    db.exec('BEGIN IMMEDIATE');
    try {
        db.exec(schema);

        const columns = new Set(db.prepare('PRAGMA table_info(writings)').all().map(column => column.name));

        if (!columns.has('content')) {
            db.exec('ALTER TABLE writings ADD COLUMN content TEXT');
        }
        if (!columns.has('photo_url')) {
            db.exec('ALTER TABLE writings ADD COLUMN photo_url TEXT');
        }
        if (!columns.has('product_name')) {
            db.exec('ALTER TABLE writings ADD COLUMN product_name TEXT');
        }
        if (!columns.has('product_url')) {
            db.exec('ALTER TABLE writings ADD COLUMN product_url TEXT');
        }
        if (!columns.has('total_price')) {
            db.exec('ALTER TABLE writings ADD COLUMN total_price INTEGER');
        }
        if (!columns.has('target_participant_count')) {
            db.exec('ALTER TABLE writings ADD COLUMN target_participant_count INTEGER');
        }
        if (!columns.has('recruitment_ends_at')) {
            db.exec('ALTER TABLE writings ADD COLUMN recruitment_ends_at INTEGER');
        }
        if (!columns.has('created_at')) {
            db.exec('ALTER TABLE writings ADD COLUMN created_at INTEGER');
        }

        db.exec(`
            INSERT INTO writing_participants (writing_id, user_id)
            SELECT id, author_id FROM writings WHERE 1
            ON CONFLICT(writing_id, user_id) DO NOTHING
        `);
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

module.exports = { initializeDatabase };
