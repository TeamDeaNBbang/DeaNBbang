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
