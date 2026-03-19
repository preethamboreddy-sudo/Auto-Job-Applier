const express = require('express');
const cors = require('cors');
const db = require('./database');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
const PORT = 3001; // Backend runs on 3001, frontend on 3000

// Setup Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Init Gemini
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

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

  const userRole = ['admin', 'company'].includes(role) ? role : 'user';

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

// 4b. Profile: Download PDF Resume
app.get('/api/profile/:userId/resume', (req, res) => {
  const { userId } = req.params;
  db.get(`SELECT * FROM profiles WHERE user_id = ?`, [userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Profile not found' });

    db.get(`SELECT email FROM users WHERE id = ?`, [userId], (err, userRow) => {
      if (err || !userRow)
        return res.status(500).json({ error: 'User not found' });

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Resume_${row.firstName}_${row.lastName}.pdf`
      );
      doc.pipe(res);

      // Header
      doc
        .fontSize(24)
        .text(`${row.firstName || ''} ${row.lastName || ''}`, {
          align: 'center',
        });
      doc
        .fontSize(12)
        .fillColor('gray')
        .text(`${userRow.email} | ${row.phone || ''} | ${row.address || ''}`, {
          align: 'center',
        });
      doc.moveDown();

      // Education
      doc
        .fillColor('black')
        .fontSize(16)
        .text('Education', { underline: true });
      doc.fontSize(12).text(`${row.degree || 'N/A'} in ${row.stream || 'N/A'}`);
      doc.text(`${row.college || 'N/A'}`);
      doc.text(
        `CGPA: ${row.cgpa || 'N/A'} | 12th: ${row.percentage12 || 'N/A'}% | 10th: ${row.percentage10 || 'N/A'}%`
      );
      doc.moveDown();

      // Skills
      doc.fontSize(16).text('Skills', { underline: true });
      doc.fontSize(12).text(row.skills || 'N/A');
      doc.moveDown();

      // Experience
      doc.fontSize(16).text('Experience', { underline: true });
      doc.fontSize(12).text(row.experience || 'No prior experience listed');

      doc.end();
    });
  });
});

// 4c. Profile: AI Resume Parser
app.post('/api/profile/parse', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No resume provided' });
    if (!ai) return res.status(500).json({ error: 'Server AI not configured (Missing User API Key)' });
    
    const pdfData = await pdfParse(req.file.buffer);
    const resumeText = pdfData.text;

    const prompt = `
    Extract the following profile information from the resume text into a raw JSON object. Use exactly these keys:
    - firstName (string)
    - lastName (string)
    - email (string)
    - phone (string)
    - college (string)
    - degree (string)
    - cgpa (string or number)
    - skills (comma separated string)
    - experience (string summary)

    Resume Text:
    ${resumeText}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    res.json({ parsedProfile: JSON.parse(response.text) });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process resume' });
  }
});

// 5a. Jobs: Generate Cover Letter
app.post('/api/jobs/:jobId/cover-letter', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId } = req.body;
    
    if (!ai) return res.status(500).json({ error: 'Server AI not configured (Missing User API Key)' });

    db.get(`SELECT * FROM jobs WHERE id = ?`, [jobId], (err, job) => {
      if (err || !job) return res.status(404).json({ error: 'Job not found' });
      
      db.get(`SELECT * FROM profiles WHERE user_id = ?`, [userId], async (err, profile) => {
        if (err || !profile) return res.status(400).json({ error: 'Profile required for cover letter' });

        const prompt = `
        You are an expert career coach. Write a professional, concise, and highly effective cover letter for a candidate applying to a job.
        
        Candidate Information:
        Name: ${profile.firstName} ${profile.lastName}
        Skills: ${profile.skills}
        Experience: ${profile.experience}
        Education: ${profile.degree} in ${profile.stream} from ${profile.college}

        Job Information:
        Title: ${job.title}
        Company: ${job.company}
        Description: ${job.description}
        Required Skills: ${job.skills}

        Format the letter cleanly with appropriate paragraphs. Write a compelling body that can be copied directly.
        `;

        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
          });
          res.json({ coverLetter: response.text });
        } catch(llmErr) {
          res.status(500).json({ error: 'AI Error: ' + llmErr.message });
        }
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// 5b. Jobs: Create (Admin/Company)
app.post('/api/jobs', (req, res) => {
  const { title, company_id, company, location, type, salary, logo, description, skills } =
    req.body;
  const id = 'job-' + Date.now();
  const skillsStr = Array.isArray(skills) ? skills.join(', ') : skills;

  const query = `INSERT INTO jobs (id, title, company_id, company, location, type, salary, logo, description, skills) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    id,
    title,
    company_id || null,
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

// 5c. Jobs: Delete (Admin Only)
app.delete('/api/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;
  db.run(`DELETE FROM jobs WHERE id = ?`, [jobId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Job deleted successfully' });
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
      res.status(201).json({
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
        SELECT a.id as applicationId, a.status, a.applied_at, a.meeting_link, a.available_slots, a.selected_slot,
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
        SELECT a.id as applicationId, a.status, a.applied_at, a.match_score, a.match_reason, a.available_slots, a.selected_slot,
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

// 10. Company: Get applications for firm's jobs
app.get('/api/company/applications/:companyId', (req, res) => {
  const { companyId } = req.params;
  const query = `
        SELECT a.id as applicationId, a.status, a.applied_at, a.meeting_link, a.match_score, a.match_reason, a.available_slots, a.selected_slot,
               j.title as jobTitle, j.company, j.id as jobId,
               u.email,
               p.firstName, p.lastName, p.experience, p.skills, p.degree, p.college, p.phone
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        JOIN users u ON a.user_id = u.id
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE j.company_id = ?
        ORDER BY a.applied_at DESC
    `;

  db.all(query, [companyId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ applications: rows });
  });
});

// 11. Applications: Schedule interview
app.post('/api/applications/:appId/interview', (req, res) => {
  const { appId } = req.params;
  const { available_slots } = req.body;

  db.run(
    `UPDATE applications SET status = 'Interviewing', available_slots = ? WHERE id = ?`,
    [JSON.stringify(available_slots), appId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Interview slots offered', available_slots });
    }
  );
});

// 11b. Applications: Confirm interview slot
app.post('/api/applications/:appId/confirm-slot', (req, res) => {
  const { appId } = req.params;
  const { selected_slot } = req.body;
  const meeting_link = `https://meet.jit.si/BURA_Interview_${appId}_${Date.now()}`;

  db.run(
    `UPDATE applications SET selected_slot = ?, meeting_link = ? WHERE id = ?`,
    [selected_slot, meeting_link, appId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Interview slot confirmed', meeting_link });
    }
  );
});

// 12. Applications: AI Match Score
app.post('/api/applications/:appId/score', async (req, res) => {
  const { appId } = req.params;
  
  if (!ai) return res.status(500).json({ error: 'Server AI not configured (Missing User API Key)' });

  db.get(`
    SELECT a.*, j.title, j.description, j.skills as job_skills,
           p.firstName, p.lastName, p.skills as user_skills, p.experience, p.degree
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    JOIN users u ON a.user_id = u.id
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE a.id = ?
  `, [appId], async (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Application not found' });
    
    if (row.match_score) {
        return res.json({ match_score: row.match_score, match_reason: row.match_reason });
    }

    const prompt = `
    You are an expert technical recruiter analyzing a candidate for a role.
    Job Title: ${row.title}
    Job Description: ${row.description}
    Required Skills: ${row.job_skills}
    
    Candidate Name: ${row.firstName} ${row.lastName}
    Candidate Degree: ${row.degree}
    Candidate Skills: ${row.user_skills}
    Candidate Experience: ${row.experience}
    
    Output a raw JSON object containing EXACTLY:
    - match_score: An integer from 0 to 100 representing how well the candidate fits the job.
    - match_reason: 1 to 2 short sentences explaining the reasoning for this score.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const result = JSON.parse(response.text);
      
      db.run(
        'UPDATE applications SET match_score = ?, match_reason = ? WHERE id = ?',
        [result.match_score, result.match_reason, appId],
        function (updateErr) {
            if (updateErr) return res.status(500).json({ error: 'Failed to save score' });
            res.json(result);
        }
      );
    } catch (llmErr) {
      res.status(500).json({ error: 'AI Error: ' + llmErr.message });
    }
  });
});

// 13. Saved Jobs: Get
app.get('/api/user/:userId/saved-jobs', (req, res) => {
  const { userId } = req.params;
  db.all(
    `SELECT job_id FROM saved_jobs WHERE user_id = ?`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ savedJobIds: rows.map(r => r.job_id) });
    }
  );
});

// 14. Saved Jobs: Toggle
app.post('/api/user/:userId/saved-jobs', (req, res) => {
  const { userId } = req.params;
  const { jobId } = req.body;
  
  db.get(`SELECT * FROM saved_jobs WHERE user_id = ? AND job_id = ?`, [userId, jobId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (row) {
      db.run(`DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?`, [userId, jobId], (delErr) => {
        if (delErr) return res.status(500).json({ error: delErr.message });
        res.json({ saved: false });
      });
    } else {
      db.run(`INSERT INTO saved_jobs (user_id, job_id) VALUES (?, ?)`, [userId, jobId], (insErr) => {
        if (insErr) return res.status(500).json({ error: insErr.message });
        res.json({ saved: true });
      });
    }
  });
});

// 15. Messages: Get
app.get('/api/applications/:appId/messages', (req, res) => {
  const { appId } = req.params;
  db.all(
    `SELECT m.*, u.role, p.firstName, p.lastName 
     FROM messages m 
     JOIN users u ON m.sender_id = u.id 
     LEFT JOIN profiles p ON u.id = p.user_id 
     WHERE m.application_id = ? ORDER BY m.created_at ASC`,
    [appId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ messages: rows });
    }
  );
});

// 16. Messages: Post
app.post('/api/applications/:appId/messages', (req, res) => {
  const { appId } = req.params;
  const { sender_id, message } = req.body;
  db.run(
    `INSERT INTO messages (application_id, sender_id, message) VALUES (?, ?, ?)`,
    [appId, sender_id, message],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Message sent' });
    }
  );
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
