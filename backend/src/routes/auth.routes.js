const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const auth = require('../controllers/auth.controller');

const router = Router();
const throttle = limit => rateLimit({
    windowMs: 10 * 60 * 1000,
    limit,
    message: { code: 'TOO_MANY_REQUESTS' },
});

router.post('/login', throttle(30), auth.login);
router.post('/logout', auth.logout);
router.get('/session', auth.getSessionStatus);
router.post('/email-verifications', throttle(10), auth.issueVerification);
router.post('/email-verifications/verify', throttle(20), auth.verifyEmail);
router.post('/signup', throttle(10), auth.signup);

module.exports = router;
