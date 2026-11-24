const { Router } = require('express');
const requireLogin = require('../middleware/requireLogin');
const requireAdmin = require('../middleware/requireAdmin');
const validateWritingId = require('../middleware/validateWritingId');
const validateCursor = require('../middleware/validateCursor');
const admin = require('../controllers/admin.controller');

const router = Router();
router.use(requireLogin, requireAdmin);
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});
router.param('writingId', validateWritingId);
router.get('/reports', validateCursor, admin.listReports);
router.delete('/writing/:writingId', admin.deleteWriting);

module.exports = router;
