const express = require('express');
const {
    listWritings, getWritingDetail, postWriting, patchWriting, postWritingPhoto, postWritingJoin, postWritingLeave,
    requireWritingLogin, readWritingId, writingBodyError
} = require('../controllers/writing.controller');
const { writingPhotoDir } = require('../services/writing-photo.service');

const router = express.Router();
router.get('/', listWritings);
router.post('/', requireWritingLogin, express.json(), postWriting);
router.post('/photo', requireWritingLogin,
    express.raw({ type: 'multipart/form-data', limit: '6mb', inflate: false }), postWritingPhoto);
router.use('/photo', express.static(writingPhotoDir, {
    index: false,
    redirect: false,
    setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); }
}));
router.post('/join', requireWritingLogin, express.json(), readWritingId, postWritingJoin);
router.post('/leave', requireWritingLogin, express.json(), readWritingId, postWritingLeave);
router.get('/:writingId', readWritingId, getWritingDetail);
router.patch('/:writingId', requireWritingLogin, readWritingId, express.json(), patchWriting);
router.use(writingBodyError);

module.exports = router;
