function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ code: 'VALIDATION_ERROR' });
    }
    if (error.type === 'entity.too.large') {
        return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE' });
    }
    console.error('Request failed', { code: error.code || 'INTERNAL_ERROR' });
    return res.status(500).json({ code: 'INTERNAL_ERROR' });
}

module.exports = errorHandler;
