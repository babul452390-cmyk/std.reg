require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'student_admin_secret_2024';
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

// ── Directories ──────────────────────────────────────────────
const dataDir    = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
[dataDir, uploadsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── Database ─────────────────────────────────────────────────
const db = new Database(path.join(dataDir, 'students.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    email           TEXT    UNIQUE NOT NULL,
    phone           TEXT,
    dob             TEXT,
    gender          TEXT,
    class           TEXT,
    section         TEXT,
    roll_number     TEXT,
    address         TEXT,
    guardian_name   TEXT,
    guardian_phone  TEXT,
    photo           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add photo column if upgrading from older DB
try { db.exec('ALTER TABLE students ADD COLUMN photo TEXT'); } catch {}

// Default admin
if (!db.prepare('SELECT id FROM admins WHERE username = ?').get('admin')) {
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', bcrypt.hashSync('admin123', 10));
  console.log('✅ Default admin created → username: admin  password: admin123');
}

// ── Multer (photo upload) ─────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename:    (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: FRONTEND_URL === '*' ? true : FRONTEND_URL.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// ── Auth Middleware ───────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  try { req.admin = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}

// ════════════════════════════════════════════════════════════
//  PUBLIC ROUTES
// ════════════════════════════════════════════════════════════

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Student Registration (with optional photo)
app.post('/api/register', upload.single('photo'), (req, res) => {
  const { name, email, phone, dob, gender, class: cls,
          section, roll_number, address, guardian_name, guardian_phone } = req.body;

  if (!name || !email) return res.status(400).json({ error: 'Name and Email are required' });

  const photo = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const result = db.prepare(`
      INSERT INTO students
        (name, email, phone, dob, gender, class, section, roll_number, address, guardian_name, guardian_phone, photo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, email, phone, dob, gender, cls, section, roll_number, address, guardian_name, guardian_phone, photo);

    res.json({ success: true, message: 'Registration successful!', id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) res.status(400).json({ error: 'Email already registered' });
    else res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ════════════════════════════════════════════════════════════

// Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, token, username: admin.username });
});

// Change admin password
app.put('/api/admin/change-password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!bcrypt.compareSync(currentPassword, admin.password))
    return res.status(400).json({ error: 'Current password is wrong' });
  db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.admin.id);
  res.json({ success: true, message: 'Password changed successfully' });
});

// Get all students (search + filter)
app.get('/api/admin/students', auth, (req, res) => {
  const { search, class: cls, gender } = req.query;
  let query = 'SELECT * FROM students WHERE 1=1';
  const params = [];
  if (search)  { query += ' AND (name LIKE ? OR email LIKE ? OR roll_number LIKE ? OR phone LIKE ?)'; params.push(...Array(4).fill(`%${search}%`)); }
  if (cls)     { query += ' AND class = ?';   params.push(cls); }
  if (gender)  { query += ' AND gender = ?';  params.push(gender); }
  query += ' ORDER BY created_at DESC';
  res.json(db.prepare(query).all(...params));
});

// Get single student
app.get('/api/admin/students/:id', auth, (req, res) => {
  const s = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Student not found' });
  res.json(s);
});

// Update student (with optional new photo)
app.put('/api/admin/students/:id', auth, upload.single('photo'), (req, res) => {
  const { name, email, phone, dob, gender, class: cls,
          section, roll_number, address, guardian_name, guardian_phone } = req.body;
  const existing = db.prepare('SELECT photo FROM students WHERE id = ?').get(req.params.id);
  const photo = req.file ? `/uploads/${req.file.filename}` : (existing?.photo || null);

  try {
    db.prepare(`
      UPDATE students SET name=?, email=?, phone=?, dob=?, gender=?, class=?,
        section=?, roll_number=?, address=?, guardian_name=?, guardian_phone=?, photo=?
      WHERE id=?
    `).run(name, email, phone, dob, gender, cls, section, roll_number, address, guardian_name, guardian_phone, photo, req.params.id);
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete student
app.delete('/api/admin/students/:id', auth, (req, res) => {
  const s = db.prepare('SELECT photo FROM students WHERE id = ?').get(req.params.id);
  if (s?.photo) {
    const filePath = path.join(__dirname, s.photo);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Dashboard stats
app.get('/api/admin/stats', auth, (req, res) => {
  res.json({
    total:    db.prepare('SELECT COUNT(*) as c FROM students').get().c,
    byClass:  db.prepare('SELECT class, COUNT(*) as count FROM students GROUP BY class ORDER BY count DESC').all(),
    byGender: db.prepare('SELECT gender, COUNT(*) as count FROM students GROUP BY gender').all(),
    recent:   db.prepare('SELECT * FROM students ORDER BY created_at DESC LIMIT 5').all(),
    monthly:  db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
      FROM students GROUP BY month ORDER BY month DESC LIMIT 6
    `).all()
  });
});

// ── CSV Export ────────────────────────────────────────────────
app.get('/api/admin/export/csv', auth, (req, res) => {
  const students = db.prepare('SELECT * FROM students ORDER BY id').all();
  const headers = ['ID','Name','Email','Phone','Date of Birth','Gender','Class','Section','Roll Number','Address','Guardian Name','Guardian Phone','Registered At'];
  const rows = students.map(s => [
    s.id, `"${s.name}"`, s.email, s.phone||'', s.dob||'',
    s.gender||'', s.class||'', s.section||'', s.roll_number||'',
    `"${(s.address||'').replace(/"/g,'""')}"`,
    `"${s.guardian_name||''}"`, s.guardian_phone||'',
    s.created_at
  ].join(','));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="students_${Date.now()}.csv"`);
  res.send('\uFEFF' + [headers.join(','), ...rows].join('\n')); // BOM for Excel
});

// ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server → http://localhost:${PORT}`);
  console.log(`📦 Database → ${path.join(dataDir, 'students.db')}`);
  console.log(`🖼  Uploads  → ${uploadsDir}\n`);
});
