const express = require('express')
const {listWritings, getWritingDetail} = require('../controllers/writing.controller')

const router = express.Router()
router.get('/', listWritings)
router.get('/:writingId', getWritingDetail)

module.exports = router