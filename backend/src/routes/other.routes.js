const { Router } = require('express');
const { listMainWritings, requireWritingLogin, getMyPageInfo } = require('../controllers/writing.controller');

const router = Router();
router.get('/main', listMainWritings);
router.get('/mypage', requireWritingLogin, getMyPageInfo);

module.exports = router;
