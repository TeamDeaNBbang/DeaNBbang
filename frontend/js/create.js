const form = document.querySelector('#create-form');
const imageInput = document.querySelector('#productImage');
const imagePreview = document.querySelector('#image-preview');
const message = document.querySelector('#form-message');
const deadlineInput = document.querySelector('#deadline');
let selectedImage = '';
const editingPostId = new URLSearchParams(window.location.search).get('edit');
let existingPost = null;

if (editingPostId) {
  try {
    existingPost = JSON.parse(localStorage.getItem('daenbbang.posts') || '[]').find((item) => item.id === editingPostId) || null;
  } catch { existingPost = null; }
  if (existingPost) {
    document.querySelector('main h1').textContent = '모집 글 수정';
    document.querySelector('.submit-bttn').textContent = '수정 완료';
    ['title', 'productName', 'purchaseAmount', 'recruitCount', 'content', 'tradeLocation', 'deadline'].forEach((name) => {
      form.elements.namedItem(name).value = existingPost[name];
    });
    selectedImage = existingPost.image || '';
    if (selectedImage) {
      imagePreview.src = selectedImage;
      imagePreview.hidden = false;
    }
  }
}
imageInput.required = !existingPost;

const today = new Date();
deadlineInput.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  selectedImage = '';
  imagePreview.hidden = true;
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    message.textContent = '이미지 파일을 선택해 주세요.';
    imageInput.value = '';
    return;
  }
  if (file.size > 1_500_000) {
    message.textContent = '이미지는 1.5MB 이하 파일을 선택해 주세요.';
    imageInput.value = '';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    selectedImage = String(reader.result || '');
    imagePreview.src = selectedImage;
    imagePreview.hidden = false;
    message.textContent = '';
  });
  reader.readAsDataURL(file);
});

form.addEventListener('reset', () => {
  selectedImage = '';
  imagePreview.hidden = true;
  message.textContent = '';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const post = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: formData.get('title').trim(),
    productName: formData.get('productName').trim(),
    purchaseAmount: Number(formData.get('purchaseAmount')),
    recruitCount: Number(formData.get('recruitCount')),
    content: formData.get('content').trim(),
    tradeLocation: formData.get('tradeLocation').trim(),
    deadline: formData.get('deadline'),
    image: selectedImage || existingPost?.image || '',
    category: '기타',
    currentCount: 1,
    createdAt: new Date().toISOString(),
  };

  try {
    const posts = JSON.parse(localStorage.getItem('daenbbang.posts') || '[]');
    if (existingPost) {
      const index = posts.findIndex((item) => item.id === existingPost.id);
      if (index >= 0) posts[index] = { ...existingPost, ...post, id: existingPost.id, currentCount: existingPost.currentCount, createdAt: existingPost.createdAt };
      else posts.unshift(post);
    } else posts.unshift(post);
    localStorage.setItem('daenbbang.posts', JSON.stringify(posts));
    window.location.href = `MainPage.html?created=${encodeURIComponent(post.id)}`;
  } catch {
    message.textContent = '저장 공간이 부족해요. 이미지 크기를 줄여 다시 등록해 주세요.';
  }
});
