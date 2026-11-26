const { Router, json } = require('express');
const requireLogin = require('../middleware/requireLogin');
const requireAdmin = require('../middleware/requireAdmin');
const validateCursor = require('../middleware/validateCursor');
const { readWritingId } = require('../controllers/writing.controller');
const admin = require('../controllers/admin.controller');

const router = Router();
router.use(requireLogin, requireAdmin);
router.use(json());
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});
router.get('/accuse', admin.listAccusedWritings);
router.get('/reports', validateCursor, admin.listReports);
router.delete('/writing/:writingId', readWritingId, admin.deleteWriting);
router.delete('/:writingId', readWritingId, admin.deleteAccusedWriting);
router.use(admin.handleError);

module.exports = router;
