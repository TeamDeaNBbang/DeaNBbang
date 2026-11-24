function validateWritingId(req, res, next, value) {
    const id = Number(value);
    if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(id)) {
        return res.status(400).json({ code: 'VALIDATION_ERROR' });
    }
    req.params.writingId = id;
    next();
}

module.exports = validateWritingId;
