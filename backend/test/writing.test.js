const {DatabaseSync} = require('node:sqlite')
const {readFileSync} = require('node:fs')
const {join} = require('node:path')
const db = new DatabaseSync(':memory:')
const schema = readFileSync(join(__dirname, '../db/schema.sql'), 'utf8')
db.exec(schema)
const {findAllWritings} = require('../src/repositories/writing.repository')
const assert = require('node:assert/strict')

db.exec(`
  INSERT INTO users (id, email, username, student_number, password_hash)
  VALUES (1, 'author@example.test', 'test-author', 'TEST-1', 'test-hash');

  INSERT INTO writings (title, author_id)
  VALUES ('휴지 공동구매', 1);
`)

const writing = findAllWritings(db)
assert.equal(writing.length, 1)
assert.equal(writing[0].title, '휴지 공동구매')