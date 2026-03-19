const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = 3001; // Backend runs on 3001, frontend on 3000

// Middleware
app.use(cors());
app.use(express.json());

// Routes
// 1. Auth: Register
app.post('/api/auth/register', (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const userRole = role === 'admin' ? 'admin' : 'user';

  const stmt = db.prepare(
    `INSERT INTO users (email, password, role) VALUES (?, ?, ?)`
  );
  stmt.run([email, password, userRole], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Email already exists' });
      }
      return res.status(500).json({ error: err.message });
    }

    // Also create an empty profile for this user
    db.run(`INSERT INTO profiles (user_id) VALUES (?)`, [this.lastID]);

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: this.lastID, email, role: userRole },
    });
  });
  stmt.finalize();
});

// 2. Auth: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  db.get(
    `SELECT id, email, role FROM users WHERE email = ? AND password = ?`,
    [email, password],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!row) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      res.json({ message: 'Login successful', user: row });
    }
  );
});

// 3. Profile: Get
app.get('/api/profile/:userId', (req, res) => {
  const { userId } = req.params;

  db.get(`SELECT * FROM profiles WHERE user_id = ?`, [userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Profile not found' });

    res.json({ profile: row });
  });
});

// 4. Profile: Update
app.post('/api/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const profileData = req.body;

  // Convert boolean flags to 1/0 for sqlite
  const hasResume = profileData.hasResume ? 1 : 0;
  const hasAadhar = profileData.hasAadhar ? 1 : 0;

  const query = `
        UPDATE profiles SET 
            firstName = ?, middleName = ?, lastName = ?, gender = ?, phone = ?, dob = ?,
            address = ?, preferredLocation = ?, nationality = ?, aadharId = ?,
            college = ?, degree = ?, stream = ?, cgpa = ?, percentage12 = ?, percentage10 = ?,
            experience = ?, skills = ?, hasResume = ?, hasAadhar = ?
        WHERE user_id = ?
    `;

  const params = [
    profileData.firstName || null,
    profileData.middleName || null,
    profileData.lastName || null,
    profileData.gender || null,
    profileData.phone || null,
    profileData.dob || null,
    profileData.address || null,
    profileData.preferredLocation || null,
    profileData.nationality || null,
    profileData.aadharId || null,
    profileData.college || null,
    profileData.degree || null,
    profileData.stream || null,
    profileData.cgpa || null,
    profileData.percentage12 || null,
    profileData.percentage10 || null,
    profileData.experience || null,
    profileData.skills || null,
    hasResume,
    hasAadhar,
    userId,
  ];

  db.run(query, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Profile updated successfully' });
  });
});

// 5. Jobs: Get DB Jobs
app.get('/api/jobs', (req, res) => {
  db.all(`SELECT * FROM jobs ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    // Convert skills string back to array for frontend
    const jobs = rows.map((job) => ({
      ...job,
      skills: job.skills.split(',').map((s) => s.trim()),
    }));

    res.json({ jobs });
  });
});

// 5b. Jobs: Create (Admin Only)
app.post('/api/jobs', (req, res) => {
  const { title, company, location, type, salary, logo, description, skills } =
    req.body;
  const id = 'job-' + Date.now();
  const skillsStr = Array.isArray(skills) ? skills.join(', ') : skills;

  const query = `INSERT INTO jobs (id, title, company, location, type, salary, logo, description, skills) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    id,
    title,
    company,
    location,
    type,
    salary,
    logo,
    description,
    skillsStr,
  ];

  db.run(query, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Job created successfully', id });
  });
});

// 6. Applications: Submit
app.post('/api/applications', (req, res) => {
  const { userId, jobId } = req.body;

  if (!userId || !jobId) {
    return res.status(400).json({ error: 'userId and jobId are required' });
  }

  db.run(
    `INSERT INTO applications (user_id, job_id) VALUES (?, ?)`,
    [userId, jobId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res
        .status(201)
        .json({
          message: 'Application submitted successfully',
          applicationId: this.lastID,
        });
    }
  );
});

// 7. Applications: Get for User
app.get('/api/applications/user/:userId', (req, res) => {
  const { userId } = req.params;

  const query = `
        SELECT a.id as applicationId, a.status, a.applied_at, 
               j.id as jobId, j.title, j.company, j.location, j.logo
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.user_id = ?
        ORDER BY a.applied_at DESC
    `;

  db.all(query, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ applications: rows });
  });
});

// 8. Admin: Get all applications with candidate info
app.get('/api/admin/applications', (req, res) => {
  const query = `
        SELECT a.id as applicationId, a.status, a.applied_at,
               j.title as jobTitle, j.company,
               u.email,
               p.firstName, p.lastName, p.experience, p.skills, p.degree, p.college, p.phone
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        JOIN users u ON a.user_id = u.id
        LEFT JOIN profiles p ON u.id = p.user_id
        ORDER BY a.applied_at DESC
    `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ applications: rows });
  });
});

// 9. Admin: Update application status
app.post('/api/admin/applications/:appId/status', (req, res) => {
  const { appId } = req.params;
  const { status } = req.body;

  db.run(
    `UPDATE applications SET status = ? WHERE id = ?`,
    [status, appId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Application status updated' });
    }
  );
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
