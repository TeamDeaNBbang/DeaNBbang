function validateCursor(req, res, next) {
    const value = req.query.before;
    const before = value === undefined ? Number.MAX_SAFE_INTEGER : Number(value);
    if (value !== undefined && (typeof value !== 'string' ||
        !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(before))) {
        return res.status(400).json({
            code: 'VALIDATION_ERROR', message: '요청 값을 확인해 주세요.',
            fieldErrors: { before: '올바른 목록 위치를 입력해 주세요.' }
        });
    }
    res.locals.before = before;
    next();
}

module.exports = validateCursor;
