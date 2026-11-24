const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const requireLogin = require('../middleware/requireLogin');
const validateWritingId = require('../middleware/validateWritingId');
const validateCursor = require('../middleware/validateCursor');
const writing = require('../controllers/writing.controller');

const router = Router();
router.param('writingId', validateWritingId);
router.get('/', validateCursor, writing.list);
router.get('/:writingId', writing.detail);
router.post('/accuse/:writingId', requireLogin, rateLimit({
    windowMs: 10 * 60 * 1000, limit: 30, message: { code: 'TOO_MANY_REQUESTS' },
}), writing.report);

module.exports = router;
