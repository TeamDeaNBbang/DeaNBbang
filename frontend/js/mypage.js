import { api, addWritingCards } from './writing-api.js';

const status = document.querySelector('#mypage-status');

async function loadMyPage() {
    try {
        const { user, written, joined } = await api('/api/other/mypage');
        document.querySelector('#username').textContent = user.username;
        document.querySelector('#user-role').textContent = user.role === 'ADMIN' ? '관리자' : '일반 사용자';
        document.querySelector('#my-profile').hidden = false;
        document.querySelector('#written-empty').hidden = written.length > 0;
        document.querySelector('#joined-empty').hidden = joined.length > 0;
        addWritingCards(document.querySelector('#written-grid'), written);
        addWritingCards(document.querySelector('#joined-grid'), joined);
    } catch (error) {
        status.textContent = error.message;
    }
}

loadMyPage();
