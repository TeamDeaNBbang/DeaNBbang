function requireAdmin(req, res, next) {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ code: 'ADMIN_ACCESS_DENIED' });
    }
    next();
}

module.exports = requireAdmin;
