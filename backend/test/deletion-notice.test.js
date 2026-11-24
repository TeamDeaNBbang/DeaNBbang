const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');
const initializeDatabase = require('../db/initialize');
const { sendDeletionNotice } = require('../src/services/email.service');

test('existing database gains reason fields while keeping posts and pending emails', () => {
    const db = new DatabaseSync(':memory:');
    try {
        db.exec(readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
        db.exec('ALTER TABLE writings DROP COLUMN deletion_reason');
        db.exec('ALTER TABLE deletion_notifications DROP COLUMN deletion_reason');
        db.prepare('INSERT INTO users (id, email, username, student_number, password_hash) VALUES (1, ?, ?, ?, ?)')
            .run('old@example.test', 'old-user', 'old-number', '!disabled');
        db.prepare('INSERT INTO writings (id, author_id, title, created_at, deleted_at) VALUES (1, 1, ?, 1, 2)')
            .run('기존 글');
        db.prepare('INSERT INTO deletion_notifications (writing_id, recipient, title, deleted_at) VALUES (1, ?, ?, 2)')
            .run('old@example.test', '기존 글');
        initializeDatabase(db);
        initializeDatabase(db);
        assert.equal(db.prepare('SELECT title FROM writings').get().title, '기존 글');
        assert.equal(db.prepare('SELECT deletion_reason FROM writings').get().deletion_reason, null);
        assert.equal(db.prepare('SELECT deletion_reason FROM deletion_notifications').get().deletion_reason,
            '관리자 검토 후 삭제되었습니다.');
    } finally {
        db.close();
    }
});

test('deletion notice includes the administrator reason as plain text', async t => {
    const originalHost = process.env.SMTP_HOST;
    const originalFrom = process.env.SMTP_FROM;
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_FROM = 'sender@example.test';
    t.after(() => {
        if (originalHost === undefined) delete process.env.SMTP_HOST;
        else process.env.SMTP_HOST = originalHost;
        if (originalFrom === undefined) delete process.env.SMTP_FROM;
        else process.env.SMTP_FROM = originalFrom;
    });
    let delivered;
    t.mock.method(nodemailer, 'createTransport', () => ({
        async sendMail(message) { delivered = message; },
    }));
    const reason = '금지된 물품입니다.\n규정을 확인해 주세요.';
    await sendDeletionNotice({
        recipient: 'author@example.test', title: '검토 대상 글', writingId: 1,
        deletedAt: 1700000000000, reason,
    });
    assert.equal(delivered.to, 'author@example.test');
    assert.ok(delivered.text.includes('삭제 사유: ' + reason));
    assert.equal(delivered.html, undefined);
});
