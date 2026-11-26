const session = require('express-session');
const { DatabaseSync } = require('node:sqlite');

class SqliteSessionStore extends session.Store {
    constructor(filename) {
        super();
        this.db = new DatabaseSync(filename, { timeout: 5000 });
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                sid TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                expires_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
        `);
        this.cleanup = setInterval(() => {
            try {
                this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
            } catch {
                console.error('만료 세션 정리에 실패했습니다.');
            }
        }, 60000);
        this.cleanup.unref();
    }

    expiresAt(data) {
        const expires = data.cookie?.expires && new Date(data.cookie.expires).getTime();
        return Number.isFinite(expires) ? expires : Date.now() + 8 * 60 * 60 * 1000;
    }

    get(sid, callback) {
        try {
            const row = this.db.prepare('SELECT data, expires_at FROM sessions WHERE sid = ?').get(sid);
            if (!row) return callback(null, null);
            if (row.expires_at <= Date.now()) {
                this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
                return callback(null, null);
            }
            return callback(null, JSON.parse(row.data));
        } catch (error) {
            return callback(error);
        }
    }

    set(sid, data, callback = () => {}) {
        try {
            this.db.prepare(`
                INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
                ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
            `).run(sid, JSON.stringify(data), this.expiresAt(data));
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    touch(sid, data, callback = () => {}) {
        try {
            this.db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?').run(this.expiresAt(data), sid);
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    destroy(sid, callback = () => {}) {
        try {
            this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    close() {
        clearInterval(this.cleanup);
        this.db.close();
    }
}

module.exports = SqliteSessionStore;
