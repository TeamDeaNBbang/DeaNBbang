const params = new URLSearchParams(window.location.search);
const postId = params.get('id');
let posts = [];
try { posts = JSON.parse(localStorage.getItem('daenbbang.posts') || '[]'); } catch { posts = []; }
const post = posts.find((item) => item.id === postId);
const mainImage = document.querySelector('#mainImage');
const joinButton = document.querySelector('.detail-join-btn');
const reportButton = document.querySelector('.detail-report');
const editButton = document.querySelector('.detail-edit');
const deleteButton = document.querySelector('.detail-delete');
let message = null;

function showMessage(text) {
  if (!message) {
    message = document.createElement('p');
    message.className = 'join-message';
    message.setAttribute('aria-live', 'polite');
    joinButton.insertAdjacentElement('afterend', message);
  }
  message.textContent = text;
}

document.querySelector('.detail-back').href = 'MainPage.html';
document.querySelector('header .Write').href = 'creat.html';
document.querySelector('header .Login').href = 'Login.html';

if (post) {
  document.title = `대N빵 - ${post.title}`;
  document.querySelector('.detail-info h1').textContent = post.title;
  document.querySelector('.detail-description').textContent = post.content;
  document.querySelector('.detail-author strong').textContent = '나';
  document.querySelector('.detail-author span').textContent = new Date(post.createdAt).toLocaleDateString('ko-KR');
  const stats = [...document.querySelectorAll('.detail-stat')];
  stats[0].querySelector('strong').textContent = `${Number(post.purchaseAmount).toLocaleString()}원`;
  stats[1].querySelector('strong').textContent = `${post.recruitCount}명`;
  stats[2].querySelector('strong').textContent = `${post.currentCount || 1}명`;
  stats[3].querySelector('strong').textContent = `${Math.ceil(post.purchaseAmount / post.recruitCount).toLocaleString()}원`;
  if (post.image) {
    mainImage.src = post.image;
    mainImage.alt = `${post.productName} 상품 이미지`;
  }

}

joinButton.addEventListener('click', () => {
  if (!post) {
    showMessage('로그인 후 공구에 참여할 수 있어요.');
    return;
  }
  let latestPosts = [];
  try { latestPosts = JSON.parse(localStorage.getItem('daenbbang.posts') || '[]'); } catch { latestPosts = []; }
  const target = latestPosts.find((item) => item.id === post.id);
  if (!target) return;
  const joinedKey = `daenbbang.joined.${post.id}`;
  if (localStorage.getItem(joinedKey) === 'true') {
    showMessage('이미 참여 신청한 공구예요.');
    return;
  }
  if ((target.currentCount || 1) >= target.recruitCount) {
    showMessage('모집 인원이 모두 찼어요.');
    return;
  }
  target.currentCount = (target.currentCount || 1) + 1;
  localStorage.setItem('daenbbang.posts', JSON.stringify(latestPosts));
  localStorage.setItem(joinedKey, 'true');
  document.querySelectorAll('.detail-stat')[2].querySelector('strong').textContent = `${target.currentCount}명`;
  showMessage('참여 신청이 완료됐어요!');
});

reportButton.addEventListener('click', () => showMessage('신고 기능은 서비스 연결 후 사용할 수 있어요.'));
editButton.addEventListener('click', () => {
  if (post) window.location.href = `creat.html?edit=${encodeURIComponent(post.id)}`;
  else showMessage('작성자만 수정할 수 있어요.');
});
deleteButton.addEventListener('click', () => {
  if (!post) {
    showMessage('작성자만 삭제할 수 있어요.');
    return;
  }
  if (!window.confirm('이 모집 글을 삭제할까요?')) return;
  localStorage.setItem('daenbbang.posts', JSON.stringify(posts.filter((item) => item.id !== post.id)));
  window.location.href = 'MainPage.html';
});
