const {getWritings, getWriting} = require("../services/writing.service")

function listWritings(req, res) {
    const writings = getWritings()
    //res.json을 호출하는 순간 Express가 클라에 응답을 보내기 때문에 return이 필요없다.
    res.json(writings)
}

const getWritingDetail = (req, res) => {
    const writingId = Number(req.params.writingId)
    if (!Number.isInteger(writingId) || writingId < 1) {
        return res.status(400).json({
            success: false,
            status: 400
        })
    }

    const writing = getWriting(writingId)
    if (!writing) {
        return res.status(404).json({
            code: 'POST_NOT_FOUND'
        })
    } else {
        res.json(writing)
    }
}

module.exports = {listWritings, getWritingDetail}