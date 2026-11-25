const { DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { initializeDatabase } = require('../../db/init');

const dataDir = path.join(__dirname, '../../data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'daen.sqlite'), { timeout: 5000 });
try {
    initializeDatabase(db);
} catch (error) {
    db.close();
    throw error;
}

module.exports = db;
