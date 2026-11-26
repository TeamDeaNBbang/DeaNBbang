const app = require('./app');
const { deliverPending } = require('./services/notification.service');
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`서버 주소: http://localhost:${port}`);
  const deliver = () => deliverPending().catch(() => console.error('Deletion email worker failed'));
  deliver();
  setInterval(deliver, 5000).unref();
});
