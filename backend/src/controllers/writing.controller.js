const {getWritings} = require("../services/writing.service")

function listWritings(req, res) {
    const writings = getWritings()
    //res.json을 호출하는 순간 Express가 클라에 응답을 보내기 때문에 return이 필요없다.
    res.json(writings)
}

module.exports = {listWritings}