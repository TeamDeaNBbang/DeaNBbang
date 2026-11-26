const users = require('../repositories/user.repository');

function requireLogin(req, res, next) {
    const user = req.session?.userId == null ? null : users.findById(req.session.userId);
    if (!user) {
        return res.status(401).json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' });
    }
    req.user = user;
    next();
}

module.exports = requireLogin;
