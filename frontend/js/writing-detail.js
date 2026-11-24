const statusMessage = document.querySelector('#status');
const reportForm = document.querySelector('#report-form');
const writingId = new URLSearchParams(window.location.search).get('writingId');

async function loadWriting() {
    if (!writingId || !/^[1-9][0-9]*$/.test(writingId)) {
        statusMessage.textContent = '메인 화면에서 게시글을 선택해 주세요.';
        return;
    }
    try {
        const response = await fetch('/api/writing/' + writingId);
        if (response.status === 404) throw new Error('삭제됐거나 존재하지 않는 게시글이에요.');
        if (!response.ok) throw new Error('게시글을 불러오지 못했어요.');
        const writing = await response.json();
        document.querySelector('#title').textContent = writing.title;
        document.querySelector('#author').textContent = '작성자: ' + writing.authorName;
        document.querySelector('#content').textContent = writing.content;
        document.querySelector('#writing').hidden = false;
        reportForm.hidden = false;
    } catch (error) {
        statusMessage.textContent = error.message;
    }
}

reportForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = reportForm.querySelector('button');
    button.disabled = true;
    try {
        const response = await fetch('/api/writing/accuse/' + writingId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reportForm.elements.reason.value }),
        });
        const messages = {
            401: '로그인 후 신고할 수 있어요.',
            404: '삭제됐거나 존재하지 않는 게시글이에요.',
            409: '이미 신고한 게시글이에요.',
            400: '신고 사유를 1~1,000자로 입력해 주세요.',
            429: '요청이 많아요. 잠시 후 다시 시도해 주세요.',
        };
        if (!response.ok) throw new Error(messages[response.status] ?? '신고에 실패했어요.');
        reportForm.hidden = true;
        statusMessage.textContent = '신고를 접수했어요.';
    } catch (error) {
        statusMessage.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

loadWriting();
