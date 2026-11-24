const { readFileSync } = require('node:fs');
const path = require('node:path');

function initializeDatabase(db) {
    db.exec(readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    db.exec('BEGIN IMMEDIATE');
    try {
        if (!db.prepare('PRAGMA table_info(writings)').all().some(column => column.name === 'deletion_reason')) {
            db.exec('ALTER TABLE writings ADD COLUMN deletion_reason TEXT');
        }
        if (!db.prepare('PRAGMA table_info(deletion_notifications)').all().some(column => column.name === 'deletion_reason')) {
            db.exec("ALTER TABLE deletion_notifications ADD COLUMN deletion_reason TEXT NOT NULL DEFAULT '관리자 검토 후 삭제되었습니다.'");
        }
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

module.exports = initializeDatabase;
