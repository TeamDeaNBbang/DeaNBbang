function validateCursor(req, res, next) {
    const value = req.query.before;
    const before = value === undefined ? Number.MAX_SAFE_INTEGER : Number(value);
    if (value !== undefined && (typeof value !== 'string' ||
        !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(before))) {
        return res.status(400).json({ code: 'VALIDATION_ERROR' });
    }
    res.locals.before = before;
    next();
}

module.exports = validateCursor;
