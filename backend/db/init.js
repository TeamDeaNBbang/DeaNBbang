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
        if (!columns.has('recruitment_status')) {
            db.exec(`
                ALTER TABLE writings ADD COLUMN recruitment_status TEXT NOT NULL DEFAULT 'OPEN'
                CHECK (recruitment_status IN ('OPEN', 'CLOSED'))
            `);
        }
        if (!columns.has('created_at')) {
            db.exec('ALTER TABLE writings ADD COLUMN created_at INTEGER');
        }

        if (!columns.has('deleted_at')) {
            db.exec('ALTER TABLE writings ADD COLUMN deleted_at INTEGER');
        }
        if (!columns.has('deleted_by')) {
            db.exec('ALTER TABLE writings ADD COLUMN deleted_by INTEGER REFERENCES users(id)');
        }

        if (!columns.has('deletion_reason')) {
            db.exec('ALTER TABLE writings ADD COLUMN deletion_reason TEXT');
        }

        const notificationColumns = db.prepare('PRAGMA table_info(deletion_notifications)').all();
        if (!notificationColumns.some(column => column.name === 'deletion_reason')) {
            db.exec("ALTER TABLE deletion_notifications ADD COLUMN deletion_reason TEXT NOT NULL DEFAULT '관리자 검토 후 삭제되었습니다.'");
        }

        const participantColumns = db.prepare('PRAGMA table_info(writing_participants)').all();
        if (!participantColumns.some(column => column.name === 'joined_at')) {
            db.exec('ALTER TABLE writing_participants ADD COLUMN joined_at INTEGER');
        }

        const migratedAt = Date.now();
        db.prepare(`
            INSERT INTO writing_participants (writing_id, user_id, joined_at)
            SELECT id, author_id, COALESCE(created_at, ?) FROM writings WHERE 1
            ON CONFLICT(writing_id, user_id) DO NOTHING
        `).run(migratedAt);

        db.prepare(`
            UPDATE writing_participants
            SET joined_at = COALESCE((
                SELECT created_at FROM writings
                WHERE id = writing_participants.writing_id AND author_id = writing_participants.user_id
            ), ?)
            WHERE joined_at IS NULL
        `).run(migratedAt);
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

module.exports = { initializeDatabase };
