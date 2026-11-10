const { DatabaseSync } = require('node:sqlite');
const { mkdirSync, readFileSync } = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '../../data');
const schemaPath = path.join(__dirname, '../../db/schema.sql');

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'daen.sqlite'));
const schema = readFileSync(schemaPath, 'utf8');

db.exec(schema);

module.exports = db;