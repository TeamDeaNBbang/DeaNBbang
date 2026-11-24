const db = require('../config/db');
const {findAllWritings, findWritingById, createWriting, updateWritingTitle} = require('../repositories/writing.repository');

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

const updateWriting = ({writingId, author_id, title}) => {
    const writing = getWriting(writingId)

    if (!writing) {
        return {code : 'POST_NOT_FOUND'}
    }

    if (writing.author_id !== author_id) {
        return {code : 'POST_ACCESS_DENIED'}
    }

    if (title === undefined) {
        return {writing}
    }

    if (typeof title !== 'string' || title.trim().length === 0) {
        return {code : 'VALIDATION_ERROR'}
    }

    updateWritingTitle(db, {writingId, author_id, title: title.trim()})
    return {writing: getWriting(writingId)}
}

module.exports = {getWritings, getWriting, addWriting, updateWriting}