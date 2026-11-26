const { Router, json } = require('express');
const requireLogin = require('../middleware/requireLogin');
const requireAdmin = require('../middleware/requireAdmin');
const admin = require('../controllers/admin.controller');

const router = Router();
router.use(requireLogin, requireAdmin);
router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
});
router.get('/accuse', admin.listReports);
router.delete('/:writingId', json(), admin.deleteWriting);
router.use(admin.handleError);

module.exports = router;
