import { api, addWritingCards } from './writing-api.js';

const grid = document.querySelector('#post-grid');
const status = document.querySelector('#listing-status');
const previous = document.querySelector('#previous-page');
const next = document.querySelector('#next-page');
const pageNumber = document.querySelector('#page-number');
let page = 0;
let hasNext = false;

async function loadPage(targetPage) {
    previous.disabled = true;
    next.disabled = true;
    status.textContent = '목록을 불러오고 있어요.';
    try {
        const list = await api('/api/other/main?page=' + targetPage);
        page = list.page;
        hasNext = list.hasNext;
        addWritingCards(grid, list.items);
        status.textContent = list.items.length ? '공동구매 글 ' + list.totalElements + '개' : '등록된 공동구매 글이 없어요.';
        pageNumber.textContent = list.totalElements ? (page + 1) + '페이지' : '';
    } catch (error) {
        status.textContent = error.message;
    } finally {
        previous.disabled = page === 0;
        next.disabled = !hasNext;
    }
}

previous.addEventListener('click', () => loadPage(page - 1));
next.addEventListener('click', () => loadPage(page + 1));
loadPage(0);
