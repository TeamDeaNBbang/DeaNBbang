const { DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const initializeDatabase = require('../../db/initialize');

const dataDir = path.join(__dirname, '../../data');

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'daen.sqlite'));
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
initializeDatabase(db);

module.exports = db;
