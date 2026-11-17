const db = require('../config/db');
const {findAllWritings} = require('../repositories/writing.repository');

function getWritings() {
    return findAllWritings(db)
}

module.exports = {getWritings}