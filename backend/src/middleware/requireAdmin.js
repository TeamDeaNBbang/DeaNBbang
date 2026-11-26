function requireAdmin(req, res, next) {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' });
    }
    next();
}

module.exports = requireAdmin;
