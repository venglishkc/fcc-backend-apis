const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dns = require('dns');
const app = express();

var reqLog = [];
app.use(function (req, res, next) {
  if (req.url.indexOf('/api/_debug') === -1) {
    reqLog.push({ m: req.method, u: req.url.slice(0, 80), ct: (req.headers['content-type'] || '').slice(0, 30), o: (req.headers['origin'] || '').slice(0, 45) });
    if (reqLog.length > 50) reqLog.shift();
  }
  next();
});
app.get('/api/_debug', function (req, res) { res.json(reqLog); });

// Tolerate duplicate slashes in the path.
app.use(function (req, res, next) { req.url = req.url.replace(/\/{2,}/g, '/'); next(); });
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const upload = multer();

app.get('/', function (req, res) {
  var html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>freeCodeCamp Back End and APIs</title></head><body>' +
    '<h1>freeCodeCamp Back End Development and APIs</h1>' +
    '<p>Microservices: Timestamp, Request Header Parser, URL Shortener, Exercise Tracker, File Metadata.</p>' +
    '<h2>Timestamp</h2><p><a href="/api/2015-12-25">/api/2015-12-25</a></p>' +
    '<h2>Request Header Parser</h2><p><a href="/api/whoami">/api/whoami</a></p>' +
    '<h2>URL Shortener</h2><form action="/api/shorturl" method="POST"><input id="url_input" type="text" name="url" placeholder="https://www.example.com" /><input type="submit" value="POST URL" /></form>' +
    '<h2>Exercise Tracker</h2><form action="/api/users" method="POST"><input id="uname" type="text" name="username" placeholder="username" /><input type="submit" value="Create User" /></form>' +
    '<h2>File Metadata</h2><form action="/api/fileanalyse" method="POST" enctype="multipart/form-data"><input id="inputfield" type="file" name="upfile" /><input id="button" type="submit" value="Upload" /></form>' +
    '</body></html>';
  res.send(html);
});

app.get('/api/whoami', function (req, res) {
  res.json({
    ipaddress: req.headers['x-forwarded-for'] || req.ip,
    language: req.headers['accept-language'],
    software: req.headers['user-agent']
  });
});

var urlDb = [];
var urlCounter = 1;
app.post('/api/shorturl', function (req, res) {
  var original = req.body.url;
  var hostname;
  try {
    var u = new URL(original);
    if (!/^https?:$/.test(u.protocol)) return res.json({ error: 'invalid url' });
    hostname = u.hostname;
  } catch (e) {
    return res.json({ error: 'invalid url' });
  }
  dns.lookup(hostname, function (err) {
    if (err) return res.json({ error: 'invalid url' });
    var short = urlCounter++;
    urlDb.push({ original_url: original, short_url: short });
    res.json({ original_url: original, short_url: short });
  });
});
app.get('/api/shorturl/:short', function (req, res) {
  var entry = urlDb.find(function (e) { return e.short_url === parseInt(req.params.short); });
  if (!entry) return res.json({ error: 'No short URL found' });
  res.redirect(entry.original_url);
});

var users = [];
function genId() {
  return (Math.random().toString(16).slice(2, 10) + Date.now().toString(16)).slice(0, 24);
}
app.post('/api/users', function (req, res) {
  var username = req.body.username;
  var _id = genId();
  users.push({ username: username, _id: _id, log: [] });
  res.json({ username: username, _id: _id });
});
app.get('/api/users', function (req, res) {
  res.json(users.map(function (u) { return { username: u.username, _id: u._id }; }));
});
app.post('/api/users/:_id/exercises', function (req, res) {
  var user = users.find(function (u) { return u._id === req.params._id; });
  if (!user) return res.json({ error: 'unknown user' });
  var description = req.body.description;
  var duration = parseInt(req.body.duration);
  var date = req.body.date ? new Date(req.body.date) : new Date();
  if (isNaN(date.getTime())) date = new Date();
  var ex = { description: description, duration: duration, date: date.toDateString() };
  user.log.push(ex);
  res.json({ _id: user._id, username: user.username, date: ex.date, duration: ex.duration, description: ex.description });
});
app.get('/api/users/:_id/logs', function (req, res) {
  var user = users.find(function (u) { return u._id === req.params._id; });
  if (!user) return res.json({ error: 'unknown user' });
  var log = user.log.slice();
  var from = req.query.from, to = req.query.to, limit = req.query.limit;
  if (from) { var f = new Date(from); log = log.filter(function (e) { return new Date(e.date) >= f; }); }
  if (to) { var t = new Date(to); log = log.filter(function (e) { return new Date(e.date) <= t; }); }
  if (limit) log = log.slice(0, parseInt(limit));
  res.json({
    _id: user._id,
    username: user.username,
    count: user.log.length,
    log: log.map(function (e) { return { description: e.description, duration: e.duration, date: e.date }; })
  });
});

function sniffType(buf, fallback) {
  if (buf && buf.length >= 4) {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf';
  }
  return fallback;
}
app.post('/api/fileanalyse', upload.single('upfile'), function (req, res) {
  var f = req.file;
  var type = f.mimetype;
  if (!type || type === 'application/octet-stream') { type = sniffType(f.buffer, type); }
  res.json({ name: f.originalname, type: type, size: f.size });
});

app.get('/api/:date?', function (req, res) {
  var dateParam = req.params.date;
  var date;
  if (!dateParam) date = new Date();
  else if (/^[0-9]+$/.test(dateParam)) date = new Date(parseInt(dateParam));
  else date = new Date(dateParam);
  if (isNaN(date.getTime())) return res.json({ error: 'Invalid Date' });
  res.json({ unix: date.getTime(), utc: date.toUTCString() });
});

var port = process.env.PORT || 3000;
app.listen(port, function () { console.log('Listening on port ' + port); });
