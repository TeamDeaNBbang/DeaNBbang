import { api, viewer, writingPath } from './writing-api.js';

const form = document.querySelector('#create-form');
const fields = document.querySelector('#writing-fields');
const submit = form.querySelector('button[type=submit]');
const image = document.querySelector('#product-image');
const preview = document.querySelector('#image-preview');
const status = document.querySelector('#form-message');
const editingId = new URLSearchParams(location.search).get('edit');
let currentPhoto;
let localPreview;
let uploaded;

function showImage(url) {
    preview.hidden = !url;
    if (url) preview.src = url;
    else preview.removeAttribute('src');
}

image.addEventListener('change', () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
    uploaded = undefined;
    const file = image.files[0];
    localPreview = file ? URL.createObjectURL(file) : null;
    showImage(localPreview || currentPhoto);
});

async function initialize() {
    const user = await viewer();
    if (!user) {
        status.textContent = '로그인한 후에 이용해 주세요.';
        return;
    }
    if (editingId !== null) {
        if (!/^[1-9]\d*$/.test(editingId)) throw new Error('글 번호가 올바르지 않아요.');
        const original = await api('/api/writing/' + editingId);
        if (original.author_id !== user.id) throw new Error('작성자만 글을 수정할 수 있어요.');
        document.querySelector('#form-title').textContent = '모집 글 수정';
        document.querySelector('#cancel-link').href = writingPath(editingId);
        submit.textContent = '수정하기';
        image.required = false;
        form.elements.title.value = original.title;
        form.elements.content.value = original.content ?? '';
        for (const name of ['productName', 'productUrl', 'totalPrice', 'targetCount']) {
            form.elements[name].value = original[name] ?? '';
            form.elements[name].disabled = true;
        }
        currentPhoto = original.photoUrl;
        showImage(currentPhoto);
    }
    fields.disabled = false;
    submit.disabled = false;
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const values = new FormData(form);
    const body = { title: values.get('title').trim(), content: values.get('content').trim() };
    const file = image.files[0];
    if (!editingId) {
        body.productName = values.get('productName').trim();
        body.productUrl = values.get('productUrl').trim();
        body.totalPrice = Number(values.get('totalPrice'));
        body.targetCount = Number(values.get('targetCount'));
    }
    submit.disabled = true;
    fields.disabled = true;
    status.textContent = '';
    try {
        if (file) {
            if (!uploaded) {
                const photo = new FormData();
                photo.set('photo', file);
                uploaded = await api('/api/writing/photo', 'POST', photo);
            }
            body.photoUrl = uploaded.photoUrl;
        }
        if (editingId) {
            await api('/api/writing/' + editingId, 'PATCH', body);
            location.assign(writingPath(editingId));
        } else {
            const { writingId } = await api('/api/writing', 'POST', body);
            location.assign(writingPath(writingId));
        }
    } catch (error) {
        status.textContent = error.message;
        fields.disabled = false;
        submit.disabled = false;
    }
});

initialize().catch(error => { status.textContent = error.message; });
