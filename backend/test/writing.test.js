const {DatabaseSync} = require('node:sqlite')
const db = new DatabaseSync(':memory:')
const {findAllWritings} = require('../src/repositories/writing.repository')
const assert = require('node:assert/strict')

db.exec(`CREATE TABLE practice_writings (
    id INTEGER PRIMARY KEY,
    title TEXT
         )`)
db.exec(`INSERT INTO practice_writings
    (title) VALUES ('휴지 공동구매')`)

const writing = findAllWritings(db)
assert.equal(writing.length, 1)
assert.equal(writing[0].title, '휴지 공동구매')