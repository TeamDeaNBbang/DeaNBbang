const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const nodemailer = require('nodemailer');
const { initializeDatabase } = require('../db/init');
const { sendDeletionNotice } = require('../src/services/email.service');

test('older databases preserve posts and queued mail while adding deletion reasons', t => {
    const db = new DatabaseSync(':memory:');
    t.after(() => db.close());
    db.exec(readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
    db.exec('ALTER TABLE writings DROP COLUMN deletion_reason');
    db.exec('ALTER TABLE deletion_notifications DROP COLUMN deletion_reason');
    db.prepare('INSERT INTO users (id, email, username, student_number, password_hash) VALUES (1, ?, ?, ?, ?)')
        .run('author@example.test', 'author', '001', '!disabled');
    db.prepare('INSERT INTO writings (id, title, content, photo_url, author_id, deleted_at) VALUES (1, ?, ?, ?, 1, 2)')
        .run('Older post', 'Original content', '/image.png');
    db.prepare('INSERT INTO deletion_notifications (writing_id, recipient, title, deleted_at) VALUES (1, ?, ?, 2)')
        .run('author@example.test', 'Older post');
    initializeDatabase(db);
    initializeDatabase(db);
    const writing = db.prepare('SELECT title, content, deleted_at, deletion_reason FROM writings').get();
    assert.deepEqual({ ...writing }, { title: 'Older post', content: 'Original content', deleted_at: 2, deletion_reason: null });
    const notice = db.prepare('SELECT * FROM deletion_notifications').get();
    assert.equal(notice.deletion_reason, '관리자 검토 후 삭제되었습니다.');
    assert.equal(notice.attempts, 0);
    assert.equal(notice.sent_at, null);
});

test('deletion email addresses the author and renders the reason as plain text', async t => {
    const keys = ['SMTP_HOST', 'SMTP_FROM', 'SMTP_USER', 'SMTP_PASS'];
    const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    Object.assign(process.env, { SMTP_HOST: 'smtp.example.test', SMTP_FROM: 'sender@example.test' });
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    t.after(() => {
        for (const key of keys) {
            if (previous[key] === undefined) delete process.env[key];
            else process.env[key] = previous[key];
        }
    });
    let delivered;
    t.mock.method(nodemailer, 'createTransport', () => ({ async sendMail(message) { delivered = message; } }));
    const reason = '학교 규정 위반입니다.\n<script>plain text</script>';
    await sendDeletionNotice({ recipient: 'author@example.test', title: 'Order', writingId: 42, deletedAt: 1700000000000, reason });
    assert.equal(delivered.to, 'author@example.test');
    assert.equal(delivered.subject, '대N 게시글 삭제 안내');
    assert.ok(delivered.text.includes('삭제 사유: ' + reason));
    assert.ok(delivered.text.includes('게시글 번호: 42'));
    assert.equal(delivered.html, undefined);
});
