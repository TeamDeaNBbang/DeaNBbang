const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { initializeDatabase } = require('../../db/init');
const { dataDir } = require('./paths');

const db = new DatabaseSync(path.join(dataDir, 'daen.sqlite'), { timeout: 5000 });
try {
    initializeDatabase(db);
} catch (error) {
    db.close();
    throw error;
}

module.exports = db;
