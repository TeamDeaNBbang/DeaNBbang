let cards = [...document.querySelectorAll('.post-card')];
const tabs = [...document.querySelectorAll('.category-tab')];
const searchInput = document.querySelector('#search-input');
const countLabel = document.querySelector('#listing-count');
const emptyState = document.querySelector('#empty-state');
let selectedCategory = '전체';

function updateCards() {
  const query = searchInput.value.trim().toLocaleLowerCase('ko');
  let visibleCount = 0;

  cards.forEach((card) => {
    const matchesCategory = selectedCategory === '전체' || card.dataset.category === selectedCategory;
    const matchesQuery = !query || `${card.dataset.search} ${card.innerText}`.toLocaleLowerCase('ko').includes(query);
    card.hidden = !(matchesCategory && matchesQuery);
    if (!card.hidden) visibleCount += 1;
  });

  countLabel.textContent = `총 ${visibleCount}개`;
  emptyState.hidden = visibleCount > 0;
}

function addSavedPostCards() {
  let posts = [];
  try { posts = JSON.parse(localStorage.getItem('daenbbang.posts') || '[]'); } catch { posts = []; }
  const grid = document.querySelector('#post-grid');
  posts.forEach((post) => {
    const card = document.createElement('article');
    card.className = 'post-card';
    card.dataset.category = post.category || '기타';
    card.dataset.search = `${post.title} ${post.productName} ${post.content} ${post.category || '기타'}`;
    const link = document.createElement('a');
    link.className = 'card-link';
    link.href = `detail.html?id=${encodeURIComponent(post.id)}`;
    link.setAttribute('aria-label', `${post.title} 자세히 보기`);
    const visual = document.createElement('div');
    visual.className = 'card-image image-lime';
    const emoji = document.createElement('span');
    emoji.className = 'product-emoji';
    if (post.image) {
      emoji.textContent = '';
      emoji.style.background = `center / cover no-repeat url("${post.image}")`;
    } else emoji.textContent = '🛍️';
    const badge = document.createElement('span');
    badge.className = 'card-badge';
    badge.textContent = '모집 중';
    const category = document.createElement('span');
    category.className = 'card-category';
    category.textContent = post.category || '기타';
    visual.append(emoji, badge, category);

    const body = document.createElement('div');
    body.className = 'card-body';
    const topline = document.createElement('div');
    topline.className = 'card-topline';
    const area = document.createElement('span');
    area.textContent = post.tradeLocation;
    const notice = document.createElement('span');
    notice.textContent = '방금 올라왔어요';
    topline.append(area, notice);
    const title = document.createElement('h3');
    title.textContent = post.title;
    const description = document.createElement('p');
    description.className = 'card-description';
    description.textContent = post.content;
    const price = document.createElement('div');
    price.className = 'price-row';
    const priceLabel = document.createElement('span');
    priceLabel.textContent = '1인 예상 금액';
    const priceValue = document.createElement('strong');
    priceValue.innerHTML = `${Math.ceil(post.purchaseAmount / post.recruitCount).toLocaleString()}<span>원</span>`;
    price.append(priceLabel, priceValue);
    const progress = document.createElement('div');
    progress.className = 'progress-meta';
    progress.innerHTML = `<span>참여 인원</span><b>${post.currentCount || 1} <i>/ ${post.recruitCount}명</i></b>`;
    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('span');
    fill.style.width = `${Math.min(100, ((post.currentCount || 1) / post.recruitCount) * 100)}%`;
    track.append(fill);
    const footer = document.createElement('div');
    footer.className = 'card-footer';
    footer.textContent = `내가 작성함 · ${post.deadline} 마감`;
    body.append(topline, title, description, price, progress, track, footer);
    link.append(visual, body);
    card.append(link);
    grid.prepend(card);
  });
  cards = [...document.querySelectorAll('.post-card')];
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    selectedCategory = tab.dataset.category;
    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    updateCards();
  });
  tab.setAttribute('aria-pressed', String(tab.classList.contains('is-active')));
});

searchInput.addEventListener('input', updateCards);
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === 'Escape' && document.activeElement === searchInput) {
    searchInput.value = '';
    updateCards();
    searchInput.blur();
  }
});

addSavedPostCards();
updateCards();

if (new URLSearchParams(window.location.search).has('created')) {
  document.querySelector('#listing-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
