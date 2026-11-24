const list = document.querySelector('#writing-list');
const statusMessage = document.querySelector('#writing-status');
const more = document.querySelector('#writing-more');
let cursor = null;

async function loadWritings() {
    more.disabled = true;
    try {
        const response = await fetch('/api/writing' + (cursor ? '?before=' + cursor : ''));
        if (!response.ok) throw new Error('목록을 불러오지 못했어요.');
        const data = await response.json();
        for (const writing of data.writings) {
            const article = document.createElement('article');
            const link = document.createElement('a');
            link.className = 'ArticleExplain';
            link.href = '/html/detail.html?writingId=' + writing.id;
            const heading = document.createElement('h3');
            heading.textContent = writing.title;
            link.append(heading);
            const author = document.createElement('p');
            author.textContent = '작성자: ' + writing.authorName;
            article.append(link, author);
            list.append(article);
        }
        cursor = data.nextCursor;
        more.hidden = cursor == null;
        statusMessage.textContent = list.childElementCount === 0 ? '아직 등록된 게시글이 없어요.' : '';
    } catch (error) {
        statusMessage.textContent = error.message;
    } finally {
        more.disabled = false;
    }
}

more.addEventListener('click', loadWritings);
loadWritings();
