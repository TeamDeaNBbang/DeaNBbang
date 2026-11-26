const { randomUUID } = require('node:crypto');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { dataDir } = require('../config/paths');

const writingPhotoDir = path.join(dataDir, 'writing-photos');
const maxPhotoBytes = 5 * 1024 * 1024;
const pngHeader = Buffer.from('89504e470d0a1a0a', 'hex');
const jpegHeader = Buffer.from('ffd8ff', 'hex');

function fileExtension(bytes) {
    if (bytes.subarray(0, 8).equals(pngHeader)) return 'png';
    if (bytes.subarray(0, 3).equals(jpegHeader)) return 'jpg';
    if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
    return undefined;
}

async function saveWritingPhoto(photo) {
    if (!(photo instanceof File) || photo.size === 0) {
        return { code: 'VALIDATION_ERROR', fieldErrors: { photo: '사진 파일을 올려 주세요.' } };
    }
    if (photo.size > maxPhotoBytes) {
        return { code: 'PHOTO_TOO_LARGE' };
    }

    const bytes = Buffer.from(await photo.arrayBuffer());
    const extension = fileExtension(bytes);
    if (!extension) {
        return { code: 'VALIDATION_ERROR', fieldErrors: { photo: 'PNG, JPEG 또는 WebP 사진을 올려 주세요.' } };
    }

    const filename = randomUUID() + '.' + extension;
    await mkdir(writingPhotoDir, { recursive: true });
    await writeFile(path.join(writingPhotoDir, filename), bytes, { flag: 'wx' });
    return { photoUrl: '/api/writing/photo/' + filename };
}

module.exports = { saveWritingPhoto, writingPhotoDir };
