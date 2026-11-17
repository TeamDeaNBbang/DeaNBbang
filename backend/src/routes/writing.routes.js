const express = require('express')
const {listWritings} = require('../controllers/writing.controller')

const router = express.Router()
router.get('/', listWritings)

module.exports = router