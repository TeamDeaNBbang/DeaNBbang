const express = require('express');
const path = require('node:path');
const { sessionMiddleware } = require('./config/session');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const writingRoutes = require('./routes/writing.routes');
const requireSameOrigin = require('./middleware/requireSameOrigin');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));

app.get('/', (req, res) => {
  res.redirect('/html/MainPage.html');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', sessionMiddleware);
app.use('/api', requireSameOrigin);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/writing', writingRoutes);
app.use(errorHandler);

module.exports = app;
