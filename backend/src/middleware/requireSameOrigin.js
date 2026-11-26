function requireSameOrigin(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }
    const origin = req.get('Origin');
    if (!origin) return next();

    try {
        if (new URL(origin).host === req.get('Host') &&
            req.get('Sec-Fetch-Site') !== 'cross-site') {
            return next();
        }
    } catch {
    }
    return res.status(403).json({ code: 'ORIGIN_NOT_ALLOWED', message: '허용되지 않은 출처입니다.' });
}

module.exports = requireSameOrigin;
