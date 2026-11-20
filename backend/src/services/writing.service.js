const db = require('../config/db');
const {findAllWritings, findWritingById} = require('../repositories/writing.repository');

function getWritings() {
    return findAllWritings(db)
}

function getWriting(WritingId) {
    return findWritingById(db, WritingId)
}

module.exports = {getWritings, getWriting}