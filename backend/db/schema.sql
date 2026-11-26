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
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    author_id INTEGER NOT NULL REFERENCES users(id),
    product_name TEXT,
    product_url TEXT,
    total_price INTEGER,
    target_participant_count INTEGER,
    recruitment_status TEXT NOT NULL DEFAULT 'OPEN' CHECK (recruitment_status IN ('OPEN', 'CLOSED')),
    created_at INTEGER,
    deleted_at INTEGER,
    deleted_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS writing_participants (
    writing_id INTEGER NOT NULL REFERENCES writings(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (writing_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    writing_id INTEGER NOT NULL REFERENCES writings(id),
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
    created_at INTEGER NOT NULL,
    UNIQUE (writing_id, reporter_id)
);
