const container = document.querySelector('#reports');
const statusMessage = document.querySelector('#status');
const refreshButton = document.querySelector('#refresh');
const moreButton = document.querySelector('#more');
let nextCursor = null;
let busy = false;

function textElement(tag, text) {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
}

function renderReport(report) {
    const article = document.createElement('article');
    article.append(
        textElement('h2', report.title),
        textElement('p', '작성자: ' + report.authorName),
        textElement('p', '신고자: ' + report.reporterName),
        textElement('p', '신고 시각: ' + new Date(report.createdAt).toLocaleString()),
        textElement('p', '신고 사유: ' + report.reason),
    );
    const details = document.createElement('details');
    details.append(textElement('summary', '게시글 내용'), textElement('p', report.content));
    article.append(details);
    const link = textElement('a', '게시글 보기');
    link.href = '/html/detail.html?writingId=' + report.writingId;
    article.append(link, document.createTextNode(' '));
    const deleteButton = textElement('button', '게시글 삭제');
    deleteButton.type = 'button';
    deleteButton.className = 'danger';
    deleteButton.addEventListener('click', () => deleteWriting(report));
    article.append(deleteButton);
    container.append(article);
}

function setBusy(value) {
    busy = value;
    refreshButton.disabled = value;
    moreButton.disabled = value;
    for (const button of container.querySelectorAll('button')) button.disabled = value;
}

async function loadReports(append = false) {
    setBusy(true);
    try {
        const suffix = append && nextCursor ? '?before=' + nextCursor : '';
        const response = await fetch('/api/admin/reports' + suffix);
        if (response.status === 401) throw new Error('로그인 후 이용해 주세요.');
        if (response.status === 403) throw new Error('관리자만 이용할 수 있어요.');
        if (!response.ok) throw new Error('신고 목록을 불러오지 못했어요.');
        const data = await response.json();
        if (!append) container.replaceChildren();
        data.reports.forEach(renderReport);
        nextCursor = data.nextCursor;
        moreButton.hidden = nextCursor == null;
        statusMessage.textContent = container.childElementCount === 0 ? '처리할 신고가 없어요.' : '';
        return true;
    } catch (error) {
        container.replaceChildren();
        moreButton.hidden = true;
        statusMessage.textContent = error.message;
        return false;
    } finally {
        setBusy(false);
    }
}

async function deleteWriting(report) {
    if (busy || !window.confirm('이 게시글을 삭제할까요? 삭제하면 목록과 상세 화면에서 보이지 않아요.')) return;
    setBusy(true);
    try {
        const response = await fetch('/api/admin/writing/' + report.writingId, { method: 'DELETE' });
        if (response.status === 401) throw new Error('다시 로그인해 주세요.');
        if (response.status === 403) throw new Error('관리자 권한이 필요해요.');
        if (response.status === 404) {
            await loadReports();
            statusMessage.textContent = '이미 삭제됐거나 존재하지 않는 게시글이에요.';
            return;
        }
        if (!response.ok) throw new Error('삭제에 실패했어요. 다시 시도해 주세요.');
        if (await loadReports()) statusMessage.textContent = '게시글을 삭제했어요.';
    } catch (error) {
        statusMessage.textContent = error.message;
    } finally {
        setBusy(false);
    }
}

refreshButton.addEventListener('click', () => { if (!busy) loadReports(); });
moreButton.addEventListener('click', () => { if (!busy) loadReports(true); });
loadReports();
