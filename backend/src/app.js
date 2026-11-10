const express = require('express');
const path = require('node:path');
const { sessionMiddleware } = require('./config/session');
const authRoutes = require('./routes/auth.routes');

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
app.use('/api/auth', authRoutes);

module.exports = app;
