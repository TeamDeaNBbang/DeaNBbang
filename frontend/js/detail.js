import { api, viewer, won } from './writing-api.js';

const params = new URLSearchParams(location.search);
const writingId = Number(params.get('id') ?? params.get('writingId'));
const endpoint = '/api/writing/' + writingId;
const get = id => document.getElementById(id);
const status = get('detail-message');
const panel = get('post-detail');
const participation = get('participation');
const closeButton = get('close-button');
const deleteButton = get('delete-button');
const reportButton = get('report-button');
const reportForm = get('report-form');
const reportSubmit = reportForm.querySelector('[type=submit]');
let post;
let user;
let pending = false;

function renderActions() {
    const owner = user?.id === post.author_id;
    const closed = post.recruitmentStatus === 'CLOSED';
    const validPurchase = post.totalPrice > 0 && post.targetCount >= 2;
    const full = validPurchase && post.participantCount >= post.targetCount;
    const edit = get('edit-link');
    edit.hidden = !owner;
    edit.href = '/html/create.html?edit=' + writingId;
    closeButton.hidden = !owner || closed;
    deleteButton.hidden = !owner;
    closeButton.disabled = pending;
    deleteButton.disabled = pending;
    reportButton.disabled = pending;
    reportSubmit.disabled = pending;
    participation.hidden = owner;
    participation.disabled = pending || closed || (!post.isJoined && (full || !validPurchase));
    if (closed) participation.textContent = '모집 마감';
    else if (post.isJoined) participation.textContent = '참가 취소';
    else if (!validPurchase) participation.textContent = '참가할 수 없는 글';
    else if (full) participation.textContent = '정원이 찼어요';
    else participation.textContent = '참가하기';
}

async function loadDetails() {
    post = await api(endpoint);
    document.title = post.title + ' | 대N';
    get('post-title').textContent = post.title;
    get('post-content').textContent = post.content ?? '';
    get('product-name').textContent = post.productName ?? '';
    get('recruitment-status').textContent = post.recruitmentStatus === 'CLOSED' ? '모집 마감' : '모집 중';
    get('total-price').textContent = won(post.totalPrice);
    get('price-per-person').textContent = won(post.pricePerPerson);
    get('expected-price').textContent = won(post.expectedPricePerPerson);
    get('participant-count').textContent = post.targetCount == null ? post.participantCount + '명'
        : post.participantCount + ' / ' + post.targetCount + '명';
    const image = get('main-image');
    image.hidden = !post.photoUrl;
    get('no-photo').hidden = Boolean(post.photoUrl);
    if (post.photoUrl) image.src = post.photoUrl;
    else image.removeAttribute('src');

    const link = get('product-url');
    const url = post.productUrl && URL.canParse(post.productUrl) ? new URL(post.productUrl) : null;
    link.hidden = !url || !['http:', 'https:'].includes(url.protocol);
    if (!link.hidden) link.href = url.href;
    renderActions();
    panel.hidden = false;
}

function signIn() {
    if (user) return true;
    location.assign('/html/login.html');
    return false;
}

async function runAction(action, success) {
    if (pending) return;
    pending = true;
    renderActions();
    status.textContent = '';
    try {
        await action();
        status.textContent = success;
    } catch (error) {
        status.textContent = error.message;
        if (error.status === 404) panel.hidden = true;
    } finally {
        pending = false;
        renderActions();
    }
}

participation.addEventListener('click', () => {
    if (!signIn()) return;
    const leaving = post.isJoined;
    runAction(async () => {
        await api('/api/writing/' + (leaving ? 'leave' : 'join'), 'POST', { writingId });
        await loadDetails();
    }, leaving ? '참가를 취소했어요.' : '공동구매에 참가했어요.');
});

closeButton.addEventListener('click', () => {
    if (!window.confirm('이 글의 모집을 마감할까요?')) return;
    runAction(async () => {
        await api('/api/writing/close', 'POST', { writingId });
        await loadDetails();
    }, '모집을 마감했어요.');
});

deleteButton.addEventListener('click', () => {
    if (!window.confirm('이 모집 글을 삭제할까요?')) return;
    runAction(async () => {
        await api(endpoint, 'DELETE');
        location.assign('/');
    }, '글을 삭제했어요.');
});

reportButton.addEventListener('click', () => {
    if (!signIn()) return;
    reportForm.hidden = false;
    get('report-reason').focus();
});
get('report-cancel').addEventListener('click', () => {
    reportForm.hidden = true;
    reportButton.focus();
});
reportForm.addEventListener('submit', event => {
    event.preventDefault();
    const reason = get('report-reason').value.trim();
    runAction(async () => {
        await api('/api/writing/accuse/' + writingId, 'POST', { reason });
        reportForm.reset();
        reportForm.hidden = true;
    }, '신고를 접수했어요.');
});

async function initialize() {
    if (!Number.isSafeInteger(writingId) || writingId < 1) throw new Error('글 번호가 올바르지 않아요.');
    user = await viewer();
    await loadDetails();
}

initialize().catch(error => { status.textContent = error.message; });
