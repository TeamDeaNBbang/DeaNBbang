const db = require('../config/db');

function saveVerification({ email, codeHash, expiresAt }) {
    db.prepare(`
        INSERT INTO email_verifications (email, code_hash, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
            code_hash = excluded.code_hash,
            expires_at = excluded.expires_at,
            verified_at = NULL
    `).run(email, codeHash, expiresAt);
}

function findByEmail(email) {
    return db.prepare(`
        SELECT email, code_hash AS codeHash, expires_at AS expiresAt,
               verified_at AS verifiedAt
        FROM email_verifications
        WHERE email = ?
    `).get(email);
}

function markVerified({ email, codeHash, verifiedAt }) {
    const result = db.prepare(`
        UPDATE email_verifications
        SET verified_at = ?
        WHERE email = ? AND code_hash = ?
          AND verified_at IS NULL AND expires_at > ?
    `).run(verifiedAt, email, codeHash, verifiedAt);

    return result.changes === 1;
}

function deleteVerification(email, codeHash) {
    db.prepare('DELETE FROM email_verifications WHERE email = ? AND code_hash = ?')
        .run(email, codeHash);
}

module.exports = { saveVerification, findByEmail, markVerified, deleteVerification };
