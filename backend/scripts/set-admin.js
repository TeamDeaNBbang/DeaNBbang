const db = require('../src/config/db');

try {
    const email = process.argv[2]?.trim();
    if (!email) throw new Error('Usage: npm run set-admin -- registered-email');
    const result = db.prepare("UPDATE users SET role = 'ADMIN' WHERE email = ? COLLATE NOCASE").run(email);
    if (result.changes !== 1) throw new Error('Register this user first, then run set-admin.');
    console.log('Administrator role assigned to the registered account.');
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    db.close();
}
