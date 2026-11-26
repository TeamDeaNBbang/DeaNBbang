function readPageNumber(value, defaultValue) {
    if (value === undefined) return defaultValue;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return NaN;
    return Number(value);
}

function readPagination(query) {
    const page = readPageNumber(query.page, 0);
    const size = readPageNumber(query.size, 20);
    const fieldErrors = {};
    if (!Number.isSafeInteger(page) || page < 0) fieldErrors.page = '페이지는 0 이상의 정수여야 합니다.';
    if (!Number.isInteger(size) || size < 1 || size > 100) fieldErrors.size = '페이지 크기는 1~100 사이여야 합니다.';
    if (!fieldErrors.page && !fieldErrors.size && !Number.isSafeInteger(page * size)) {
        fieldErrors.page = '페이지 번호가 너무 큽니다.';
    }
    return { page, size, offset: page * size, fieldErrors };
}

module.exports = { readPagination };
