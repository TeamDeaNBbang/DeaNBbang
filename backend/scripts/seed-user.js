if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo user is for local development only.');
}

const db = require('../src/config/db');
const users = require('../src/repositories/user.repository');

const username = 'dev-post-author';

try {
    const existing = users.findByUsername(username);
    const id = existing?.id ?? users.createUser({
        email: 'dev-post-author@example.test',
        username,
        studentNumber: 'DEV-POST-AUTHOR',
        passwordHash: '!disabled',
    });
    console.log(users.findById(id));
} finally {
    db.close();
}
