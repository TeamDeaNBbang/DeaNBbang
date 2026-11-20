const db = require('../config/db');
const {findAllWritings, findWritingById, createWriting} = require('../repositories/writing.repository');

function getWritings() {
    return findAllWritings(db)
}

function getWriting(WritingId) {
    return findWritingById(db, WritingId)
}

const addWriting = ({title, author_id}) => {
    if (typeof title !== 'string' || title.trim().length === 0) {
        return null
    } else {
        return createWriting(db, {title : title.trim(), author_id})
    }
}

module.exports = {getWritings, getWriting, addWriting}