const app = require('./app');
const { deliverPending } = require('./services/notification.service');
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`서버 주소: http://localhost:${port}`);
  const deliver = () => deliverPending().catch(() => console.error('삭제 안내 메일 처리 실패'));
  deliver();
  setInterval(deliver, 5000).unref();
});
