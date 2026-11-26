const path = require('node:path');
const { mkdirSync } = require('node:fs');

const dataDir = path.resolve(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '../../data'));
mkdirSync(dataDir, { recursive: true });

module.exports = { dataDir };
