CREATE TABLE IF NOT EXISTS users (
                                     id INTEGER PRIMARY KEY,
                                     email TEXT NOT NULL UNIQUE,
                                     username TEXT NOT NULL UNIQUE,
                                     student_number TEXT NOT NULL UNIQUE,
                                     password_hash TEXT NOT NULL,
                                     role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN'))
    );

CREATE TABLE IF NOT EXISTS email_verifications (
    email TEXT PRIMARY KEY NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    verified_at INTEGER
);

CREATE TABLE IF NOT EXISTS writings (
    id INTEGER PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    content TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    deleted_at INTEGER,
    deleted_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    writing_id INTEGER NOT NULL REFERENCES writings(id),
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
    created_at INTEGER NOT NULL,
    UNIQUE (writing_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_writings_visible ON writings(deleted_at, id);
CREATE INDEX IF NOT EXISTS idx_reports_writing ON reports(writing_id);
