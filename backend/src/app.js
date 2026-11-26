const express = require('express');
const path = require('node:path');
const { sessionMiddleware } = require('./config/session');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const requireSameOrigin = require('./middleware/requireSameOrigin');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(express.static(path.join(__dirname, '../../frontend')));


app.get('/', (req, res) => {
  res.redirect('/html/MainPage.html');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', sessionMiddleware);
app.use('/api', requireSameOrigin);
app.use('/api/auth', express.json(), authRoutes);
app.use('/api/admin', express.json(), adminRoutes);
app.use('/api/writing', require('./routes/writing.routes'));
app.use('/api/other', require('./routes/other.routes'));
app.use(errorHandler);

module.exports = app;
