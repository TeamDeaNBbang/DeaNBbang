const db = require('../src/config/db');

try {
    const email = process.argv[2]?.trim();
    if (!email) throw new Error('사용법: npm run set-admin -- 가입한 이메일');
    const result = db.prepare("UPDATE users SET role = 'ADMIN' WHERE email = ? COLLATE NOCASE").run(email);
    if (result.changes !== 1) throw new Error('가입한 사용자 이메일을 확인해 주세요.');
    console.log('해당 계정에 관리자 권한을 설정했습니다.');
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    db.close();
}
