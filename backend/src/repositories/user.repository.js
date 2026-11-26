const db = require('../config/db');

function findByUsername(username) {
    return db.prepare(`
    SELECT id, username, password_hash, role
    FROM users
    WHERE username = ?
  `).get(username);
}

function createUser({ email, username, studentNumber, passwordHash }) {
    const result = db.prepare(`
    INSERT INTO users (email, username, student_number, password_hash)
    VALUES (?, ?, ?, ?)
  `).run(email, username, studentNumber, passwordHash);

    return result.lastInsertRowid;
}

function findById(id) {
    return db.prepare(`
        SELECT id, username, role
        FROM users
        WHERE id = ?
    `).get(id);
}

function findByEmail(email) {
    return db.prepare(`
        SELECT id, username, password_hash, role
        FROM users
        WHERE email = ? COLLATE NOCASE
    `).get(email);
}

module.exports = { findByUsername, createUser, findById, findByEmail };
