const express = require('express')
const {listWritings, getWritingDetail, postWriting} = require('../controllers/writing.controller')

const router = express.Router()
router.get('/', listWritings)
router.get('/:writingId', getWritingDetail)
router.post('/', postWriting)

module.exports = router