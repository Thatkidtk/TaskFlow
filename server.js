const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'taskflow.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    due_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members (id)
  )`);
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', 
      [email, hashedPassword], function(err) {
        if (err) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        
        const token = jwt.sign({ userId: this.lastID, email }, JWT_SECRET);
        res.json({ token, userId: this.lastID });
      });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, userId: user.id });
  });
});

app.get('/api/groups', authenticateToken, (req, res) => {
  db.all('SELECT * FROM groups WHERE owner_id = ?', [req.user.userId], (err, groups) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json(groups);
  });
});

app.post('/api/groups', authenticateToken, (req, res) => {
  const { name, description } = req.body;
  
  db.run('INSERT INTO groups (name, description, owner_id) VALUES (?, ?, ?)',
    [name, description, req.user.userId], function(err) {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json({ id: this.lastID, name, description });
    });
});

app.delete('/api/groups/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM groups WHERE id = ? AND owner_id = ?', 
    [req.params.id, req.user.userId], function(err) {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json({ deleted: this.changes });
    });
});

app.get('/api/groups/:groupId/members', authenticateToken, (req, res) => {
  db.all(`SELECT m.* FROM members m 
          JOIN groups g ON m.group_id = g.id 
          WHERE g.id = ? AND g.owner_id = ?`, 
    [req.params.groupId, req.user.userId], (err, members) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json(members);
    });
});

app.post('/api/groups/:groupId/members', authenticateToken, (req, res) => {
  const { name } = req.body;
  
  db.get('SELECT * FROM groups WHERE id = ? AND owner_id = ?', 
    [req.params.groupId, req.user.userId], (err, group) => {
      if (err || !group) return res.status(403).json({ error: 'Access denied' });
      
      db.run('INSERT INTO members (group_id, name) VALUES (?, ?)',
        [req.params.groupId, name], function(err) {
          if (err) return res.status(500).json({ error: 'Server error' });
          res.json({ id: this.lastID, name, group_id: req.params.groupId });
        });
    });
});

app.delete('/api/members/:id', authenticateToken, (req, res) => {
  db.run(`DELETE FROM members WHERE id = ? AND group_id IN 
          (SELECT id FROM groups WHERE owner_id = ?)`, 
    [req.params.id, req.user.userId], function(err) {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json({ deleted: this.changes });
    });
});

app.get('/api/members/:memberId/tasks', authenticateToken, (req, res) => {
  db.all(`SELECT t.* FROM tasks t 
          JOIN members m ON t.member_id = m.id
          JOIN groups g ON m.group_id = g.id 
          WHERE t.member_id = ? AND g.owner_id = ?`, 
    [req.params.memberId, req.user.userId], (err, tasks) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json(tasks);
    });
});

app.post('/api/members/:memberId/tasks', authenticateToken, (req, res) => {
  const { title, description, due_date } = req.body;
  
  db.get(`SELECT m.* FROM members m 
          JOIN groups g ON m.group_id = g.id 
          WHERE m.id = ? AND g.owner_id = ?`, 
    [req.params.memberId, req.user.userId], (err, member) => {
      if (err || !member) return res.status(403).json({ error: 'Access denied' });
      
      db.run('INSERT INTO tasks (member_id, title, description, due_date) VALUES (?, ?, ?, ?)',
        [req.params.memberId, title, description, due_date], function(err) {
          if (err) return res.status(500).json({ error: 'Server error' });
          res.json({ 
            id: this.lastID, 
            member_id: req.params.memberId, 
            title, 
            description, 
            due_date, 
            completed: false 
          });
        });
    });
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  const { title, description, completed, due_date } = req.body;
  
  db.run(`UPDATE tasks SET title = ?, description = ?, completed = ?, due_date = ?
          WHERE id = ? AND member_id IN (
            SELECT m.id FROM members m 
            JOIN groups g ON m.group_id = g.id 
            WHERE g.owner_id = ?
          )`,
    [title, description, completed, due_date, req.params.id, req.user.userId], 
    function(err) {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json({ updated: this.changes });
    });
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  db.run(`DELETE FROM tasks WHERE id = ? AND member_id IN (
          SELECT m.id FROM members m 
          JOIN groups g ON m.group_id = g.id 
          WHERE g.owner_id = ?
        )`, 
    [req.params.id, req.user.userId], function(err) {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json({ deleted: this.changes });
    });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
