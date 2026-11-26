function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            code: 'VALIDATION_ERROR', message: '요청 값을 확인해 주세요.',
            fieldErrors: { body: '올바른 JSON을 보내 주세요.' }
        });
    }
    if (error.type === 'entity.too.large') {
        return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: '요청 본문이 너무 큽니다.' });
    }
    console.error('요청 처리 실패', { code: error.code || 'INTERNAL_ERROR' });
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: '요청을 처리하지 못했습니다.' });
}

module.exports = errorHandler;
