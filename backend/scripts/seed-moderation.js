if (process.env.NODE_ENV === 'production') throw new Error('Local demonstration only.');
const db = require('../src/config/db');
const users = require('../src/repositories/user.repository');

try {
    const author = users.findByUsername(process.argv[2] || 'dev-post-author');
    if (!author) throw new Error('Run npm run seed:user first, or provide a registered username.');
    const existing = db.prepare('SELECT id FROM writings WHERE author_id = ? AND title = ? AND deleted_at IS NULL')
        .get(author.id, '[테스트] 공동구매 신고 확인용 게시글');
    if (existing) {
        console.log({ writingId: existing.id });
    } else {
        const result = db.prepare('INSERT INTO writings (author_id, title, content, created_at) VALUES (?, ?, ?, ?)')
            .run(author.id, '[테스트] 공동구매 신고 확인용 게시글', '상세 화면에서 신고한 뒤 관리자로 조회·삭제하는 로컬 테스트용 글입니다.', Date.now());
        console.log({ writingId: result.lastInsertRowid });
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    db.close();
}
