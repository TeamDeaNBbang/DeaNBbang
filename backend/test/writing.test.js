const {DatabaseSync} = require('node:sqlite')
const {readFileSync} = require('node:fs')
const {join} = require('node:path')
const db = new DatabaseSync(':memory:')
const schema = readFileSync(join(__dirname, '../db/schema.sql'), 'utf8')

db.exec(schema)
const {findAllWritings, createWriting, findWritingById} = require('../src/repositories/writing.repository')
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

const newId = createWriting(db, {title: '생수 공동구매', author_id: 1})
const saved = findWritingById(db, newId)

assert.equal(saved.title, '생수 공동구매')
assert.equal(saved.author_id, 1)