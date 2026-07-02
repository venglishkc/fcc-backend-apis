const express = require('express');
const cors = require('cors');
const multer = require('multer');
const app = express();

app.use(cors({ optionsSuccessStatus: 200 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Landing page listing the 5 microservices
app.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>freeCodeCamp Back End & APIs</title>
  <style>body{font-family:Arial;max-width:720px;margin:40px auto;padding:0 16px;line-height:1.6;color:#0a0a23}code{background:#eee;padding:2px 5px;border-radius:3px}</style></head>
  <body><h1>Back End Development and APIs</h1>
  <ul>
  <li><b>Timestamp:</b> <code>/api/2015-12-15</code>, <code>/api/1450137600000</code>, <code>/api</code></li>
  <li><b>Request Header Parser:</b> <code>/api/whoami</code></li>
  <li><b>URL Shortener:</b> POST <code>/api/shorturl</code> (url), GET <code>/api/shorturl/1</code></li>
  <li><b>Exercise Tracker:</b> POST <code>/api/users</code>, <code>/api/users/:id/exercises</code>, GET <code>/api/users</code>, <code>/api/users/:id/logs</code></li>
  <li><b>File Metadata:</b> POST <code>/api/fileanalyse</code> (upfile)</li>
  </ul></body></html>`);
});

/* ---------- 1. Timestamp Microservice ---------- */
app.get('/api/:date?', (req, res, next) => {
  // Avoid clashing with /api/whoami, /api/shorturl, /api/users, /api/fileanalyse
  const reserved = ['whoami', 'shorturl', 'users', 'fileanalyse'];
  if (req.params.date && reserved.includes(req.params.date)) return next();
  let dateParam = req.params.date;
  let date;
  if (!dateParam) {
    date = new Date();
  } else if (/^\d+$/.test(dateParam)) {
    date = new Date(parseInt(dateParam));
  } else {
    date = new Date(dateParam);
  }
  if (date.toString() === 'Invalid Date') {
    return res.json({ error: 'Invalid Date' });
  }
  res.json({ unix: date.getTime(), utc: date.toUTCString() });
});

/* ---------- 2. Request Header Parser Microservice ---------- */
app.get('/api/whoami', (req, res) => {
  res.json({
    ipaddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    language: req.headers['accept-language'],
    software: req.headers['user-agent']
  });
});

/* ---------- 3. URL Shortener Microservice ---------- */
const urlDb = [];
app.post('/api/shorturl', (req, res) => {
  const original = req.body.url;
  let hostname;
  try {
    hostname = new URL(original).hostname;
  } catch (e) {
    return res.json({ error: 'invalid url' });
  }
  // Must be http/https and DNS-resolvable per fCC
  if (!/^https?:\/\//i.test(original)) {
    return res.json({ error: 'invalid url' });
  }
  require('dns').lookup(hostname, (err) => {
    if (err) return res.json({ error: 'invalid url' });
    let existing = urlDb.find(u => u.original_url === original);
    if (!existing) {
      existing = { original_url: original, short_url: urlDb.length + 1 };
      urlDb.push(existing);
    }
    res.json({ original_url: existing.original_url, short_url: existing.short_url });
  });
});
app.get('/api/shorturl/:short', (req, res) => {
  const entry = urlDb.find(u => u.short_url === parseInt(req.params.short));
  if (!entry) return res.json({ error: 'No short URL found for the given input' });
  res.redirect(entry.original_url);
});

/* ---------- 4. Exercise Tracker ---------- */
const users = [];
let userId = 0;
app.post('/api/users', (req, res) => {
  const username = req.body.username;
  const user = { username, _id: (++userId).toString(), log: [] };
  users.push(user);
  res.json({ username: user.username, _id: user._id });
});
app.get('/api/users', (req, res) => {
  res.json(users.map(u => ({ username: u.username, _id: u._id })));
});
app.post('/api/users/:_id/exercises', (req, res) => {
  const user = users.find(u => u._id === req.params._id);
  if (!user) return res.json({ error: 'unknown user' });
  const description = req.body.description;
  const duration = parseInt(req.body.duration);
  const date = req.body.date ? new Date(req.body.date) : new Date();
  const entry = { description, duration, date: date.toDateString() };
  user.log.push({ ...entry, dateObj: date });
  res.json({ _id: user._id, username: user.username, date: entry.date, duration: entry.duration, description: entry.description });
});
app.get('/api/users/:_id/logs', (req, res) => {
  const user = users.find(u => u._id === req.params._id);
  if (!user) return res.json({ error: 'unknown user' });
  let log = user.log.slice();
  const { from, to, limit } = req.query;
  if (from) { const f = new Date(from); log = log.filter(e => e.dateObj >= f); }
  if (to) { const t = new Date(to); log = log.filter(e => e.dateObj <= t); }
  if (limit) { log = log.slice(0, parseInt(limit)); }
  res.json({
    username: user.username,
    count: log.length,
    _id: user._id,
    log: log.map(e => ({ description: e.description, duration: e.duration, date: e.date }))
  });
});

/* ---------- 5. File Metadata Microservice ---------- */
const upload = multer();
app.post('/api/fileanalyse', upload.single('upfile'), (req, res) => {
  if (!req.file) return res.json({ error: 'no file' });
  res.json({ name: req.file.originalname, type: req.file.mimetype, size: req.file.size });
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Listening on port ' + listener.address().port);
});
module.exports = app;
