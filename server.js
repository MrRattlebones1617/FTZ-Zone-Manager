require('dotenv').config();
const express = require('express');
const path = require('path');

const uploadRoutes = require('./routes/upload');
const reportRoutes = require('./routes/report');
const templateRoutes = require('./routes/templates');
const inventoryRoutes = require('./routes/inventory');
const historyRoutes = require('./routes/history');
const apiRoutes = require('./routes/api');
const { ensureSchema } = require('./src/initSchema');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// view engine
app.set('views', path.join(__dirname, 'src', 'views'));
app.set('view engine', 'ejs');

// Lightweight layout helper so pages can render inside layout.ejs without extra deps.
app.use((req, res, next) => {
  res.renderPage = (view, data = {}) => {
    app.render(view, data, (err, html) => {
      if (err) return next(err);
      return res.render('layout', { ...data, body: html, currentPath: req.path });
    });
  };
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.renderPage('index'));
app.get('/inventory', (req, res) => res.redirect('/inventory/view'));
app.get('/history', (req, res) => res.redirect('/history/view'));

// Static assets (keep after explicit view routes so '/' renders EJS page)
app.use(express.static(path.join(__dirname, 'public')));

// Upload endpoints parse strict v2 templates and trigger FIFO inventory matching.
app.use('/upload', uploadRoutes);
app.use('/report', reportRoutes);
app.use('/templates', templateRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/history', historyRoutes);
app.use('/api', apiRoutes);

const BASE_PORT = Number(process.env.PORT || 3000);
const MAX_PORT_ATTEMPTS = 10;

function startServer(port, attempt = 1) {
  const server = app.listen(port, () => {
    console.log(`FTZ Zone Manager running on port ${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use. Retrying on ${nextPort}...`);
      setTimeout(() => startServer(nextPort, attempt + 1), 150);
      return;
    }

    console.error('Server startup failed:', err.message);
    process.exit(1);
  });
}

async function bootstrap() {
  try {
    await ensureSchema();
    console.log('Database schema check complete.');
    startServer(BASE_PORT);
  } catch (err) {
    console.error('Database schema initialization failed:', err.message);
    process.exit(1);
  }
}

bootstrap();
