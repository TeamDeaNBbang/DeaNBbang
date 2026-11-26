const {
    getWritings, getWriting, addWriting, updateWriting, joinWriting, leaveWriting
} = require('../services/writing.service');
const { saveWritingPhoto } = require('../services/writing-photo.service');

const writingErrors = {
    UNAUTHORIZED: [401, '로그인이 필요합니다.'],
    USER_NOT_FOUND: [404, '사용자를 찾을 수 없습니다.'],
    POST_NOT_FOUND: [404, '글을 찾을 수 없습니다.'],
    POST_ACCESS_DENIED: [403, '작성자만 글을 수정할 수 있습니다.'],
    VALIDATION_ERROR: [400, '요청 값을 확인해 주세요.'],
    PHOTO_TOO_LARGE: [413, '사진은 5MB까지 올릴 수 있습니다.'],
    ALREADY_JOINED: [409, '이미 참가한 공동구매입니다.'],
    CAPACITY_EXCEEDED: [409, '모집 정원이 다 찼습니다.'],
    RECRUITMENT_CLOSED: [409, '참가와 탈퇴가 가능한 모집 상태가 아닙니다.'],
    OWNER_CANNOT_LEAVE: [403, '작성자는 탈퇴할 수 없습니다.']
};

function sendWritingError(res, { code, fieldErrors }) {
    const [status, message] = writingErrors[code];
    const body = { code, message };
    if (fieldErrors) body.fieldErrors = fieldErrors;
    return res.status(status).json(body);
}

function requireWritingLogin(req, res, next) {
    if (req.session?.userId == null) {
        return sendWritingError(res, { code: 'UNAUTHORIZED' });
    }
    return next();
}

function readWritingId(req, res, next) {
    const rawId = req.params.writingId;
    const writingId = rawId === undefined ? req.body?.writingId : Number(rawId);
    if ((rawId !== undefined && !/^\d+$/.test(rawId)) || !Number.isSafeInteger(writingId) || writingId < 1) {
        return sendWritingError(res, {
            code: 'VALIDATION_ERROR',
            fieldErrors: { writingId: '글 번호는 양의 정수여야 합니다.' }
        });
    }
    res.locals.writingId = writingId;
    return next();
}

function listWritings(req, res) {
    return res.json(getWritings());
}

function getWritingDetail(req, res) {
    const writing = getWriting(res.locals.writingId);
    if (!writing) return sendWritingError(res, { code: 'POST_NOT_FOUND' });
    return res.json(writing);
}

function postWriting(req, res) {
    const result = addWriting({ author_id: req.session.userId, body: req.body });
    if (result.code) return sendWritingError(res, result);
    return res.status(201).json({ writingId: result.writingId });
}

function patchWriting(req, res) {
    const result = updateWriting({
        writingId: res.locals.writingId,
        author_id: req.session.userId,
        body: req.body === undefined ? {} : req.body
    });
    if (result.code) return sendWritingError(res, result);
    return res.json(result.writing);
}

function postWritingJoin(req, res) {
    const result = joinWriting(res.locals.writingId, req.session.userId);
    if (result.code) return sendWritingError(res, result);
    return res.status(201).json(result);
}

function postWritingLeave(req, res) {
    const result = leaveWriting(res.locals.writingId, req.session.userId);
    if (result.code) return sendWritingError(res, result);
    return res.status(204).end();
}

async function postWritingPhoto(req, res) {
    let form;
    try {
        if (Buffer.isBuffer(req.body)) {
            form = await new Request('http://localhost', {
                method: 'POST',
                headers: { 'content-type': req.get('content-type') },
                body: req.body
            }).formData();
        }
    } catch (error) {
        if (!(error instanceof TypeError)) throw error;
    }

    const photos = form?.getAll('photo');
    if (photos?.length !== 1) {
        return sendWritingError(res, {
            code: 'VALIDATION_ERROR',
            fieldErrors: { photo: 'multipart/form-data의 photo에 파일 한 개를 보내 주세요.' }
        });
    }
    const result = await saveWritingPhoto(photos[0]);
    if (result.code) return sendWritingError(res, result);
    return res.status(201).json({ photoUrl: result.photoUrl });
}

function writingBodyError(error, req, res, next) {
    if (error.type === 'entity.parse.failed') {
        return sendWritingError(res, {
            code: 'VALIDATION_ERROR',
            fieldErrors: { body: '올바른 JSON을 보내 주세요.' }
        });
    }
    if (req.method === 'POST' && req.path === '/photo' && error.type === 'entity.too.large') {
        return sendWritingError(res, { code: 'PHOTO_TOO_LARGE' });
    }
    return next(error);
}

module.exports = {
    listWritings, getWritingDetail, postWriting, patchWriting, postWritingPhoto, postWritingJoin, postWritingLeave,
    requireWritingLogin, readWritingId, writingBodyError
};
