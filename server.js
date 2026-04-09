const express = require('express');
const cors = require('cors');
const db = require('./database');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001; // Backend runs on process.env.PORT (Railway) or 3001

// Setup Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Init Gemini
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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

      // Use an A4 layout simulating the provided Canva design
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Resume_${row.firstName}_${row.lastName}.pdf`
      );
      doc.pipe(res);

      const leftX = 50, leftW = 150, rightX = 250, rightW = 295, lineX = 225;

      // Decorative generic dark rectangle at top left
      doc.fillColor('#e6e6e6').rect(40, 40, 60, 30).fill();

      // Basic Title styling
      const name = `${row.firstName || ''} ${row.lastName || ''}`.toUpperCase().trim();
      doc.fillColor('black').font('Helvetica-Bold').fontSize(24)
         .text(name || 'CANDIDATE NAME', leftX, 85, { width: leftW, align: 'left', lineGap: 5 });
      
      doc.font('Helvetica-Bold').fontSize(12)
         .text(row.degree ? `PROFESSIONAL ${row.degree}`.toUpperCase() : "PROFESSIONAL CANDIDATE", rightX, 100, { width: rightW, align: 'left' });

      // Helper function for diamond dividers
      const drawDiamond = (y) => {
        doc.save().translate(lineX, y).rotate(45).rect(-4, -4, 8, 8).fillAndStroke('black', 'black').restore();
      };

      let leftY = 170;
      let rightY = 170;

      // LEFT COLUMN: Contact
      doc.font('Helvetica-Bold').fontSize(11).text('CONTACT', leftX, leftY);
      leftY += 25;
      doc.font('Helvetica').fontSize(9);
      if (row.phone) { doc.text(row.phone, leftX, leftY); leftY += 15; }
      if (userRow.email) { doc.text(userRow.email, leftX, leftY); leftY += 15; }
      if (row.address) { doc.text(row.address, leftX, leftY); leftY += 15; }
      
      // Separator 1 (Cross Line and Diamond)
      leftY += 20;
      doc.strokeColor('black').lineWidth(1).moveTo(leftX, leftY).lineTo(lineX, leftY).stroke();
      drawDiamond(leftY);
      leftY += 25;

      // LEFT COLUMN: Skills
      doc.font('Helvetica-Bold').fontSize(11).text('SKILLS', leftX, leftY);
      leftY += 25;
      doc.font('Helvetica').fontSize(9);
      const skills = (row.skills || 'N/A').split(',').map(s => s.trim()).filter(s => s);
      skills.forEach(s => {
         doc.text(s, leftX, leftY);
         leftY += 15;
      });

      // RIGHT COLUMN: Education
      doc.font('Helvetica-Bold').fontSize(11).text('EDUCATION', rightX, rightY);
      rightY += 25;
      doc.font('Helvetica-Bold').fontSize(10).text(row.college || 'University Student', rightX, rightY);
      rightY += 15;
      doc.font('Helvetica').fontSize(9).text(`${row.degree || 'Degree'} - ${row.stream || 'Stream'}`, rightX, rightY);
      rightY += 15;
      doc.text(`CGPA: ${row.cgpa || 'N/A'} | 10th: ${row.percentage10 || 'N/A'}% | 12th: ${row.percentage12 || 'N/A'}%`, rightX, rightY);
      rightY += 35;

      // Separator 2 (Diamond for right side break)
      drawDiamond(rightY - 10);
      
      // RIGHT COLUMN: Work Experience
      doc.font('Helvetica-Bold').fontSize(11).text('WORK EXPERIENCE', rightX, rightY);
      rightY += 25;
      doc.font('Helvetica-Bold').fontSize(10).text('Professional Detail', rightX, rightY);
      rightY += 15;
      const expText = row.experience || 'No advanced experience listed. Ready to contribute effectively to the team and learn new skills rapidly on the job.';
      doc.font('Helvetica').fontSize(9).text(expText, rightX, rightY, { width: rightW, align: 'left', lineGap: 4 });
      
      const expHeight = doc.heightOfString(expText, { width: rightW, lineGap: 4 });
      rightY += expHeight + 20;

      // Central Vertical Line covering both sides
      const maxY = Math.max(leftY, rightY) + 20;
      doc.strokeColor('black').lineWidth(1).moveTo(lineX, 170).lineTo(lineX, maxY).stroke();

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
        SELECT a.id as applicationId, a.user_id as candidateId, a.status, a.applied_at, a.meeting_link, a.match_score, a.match_reason, a.available_slots, a.selected_slot,
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
        SELECT a.id as applicationId, a.user_id as candidateId, a.status, a.applied_at, a.meeting_link, a.match_score, a.match_reason, a.available_slots, a.selected_slot,
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
  const { available_slots, meeting_link } = req.body;

  db.run(
    `UPDATE applications SET status = 'Interviewing', available_slots = ?, meeting_link = ? WHERE id = ?`,
    [JSON.stringify(available_slots), meeting_link, appId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Interview slots offered', available_slots, meeting_link });
    }
  );
});

// 11b. Applications: Confirm interview slot
app.post('/api/applications/:appId/confirm-slot', (req, res) => {
  const { appId } = req.params;
  const { selected_slot } = req.body;

  db.run(
    `UPDATE applications SET selected_slot = ? WHERE id = ?`,
    [selected_slot, appId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get(`SELECT meeting_link FROM applications WHERE id = ?`, [appId], (err, row) => {
        const link = row ? row.meeting_link : null;
        res.json({ message: 'Interview slot confirmed', meeting_link: link });
      });
    }
  );
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

// 17. AI Chat Assistant
app.post('/api/ai-chat', async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: 'Server AI not configured (Missing User API Key)' });
    
    // Expect `{ history: [{role: 'user'|'model', parts: [{text: '...'}]}], message: '...' }`
    let { history, message } = req.body;
    history = history || [];
    
    // Gemini API strictly requires that the first message in a chat history is from the 'user'
    while (history.length > 0 && history[0].role === 'model') {
      history.shift();
    }
    
    const systemInstruction = "You are the BURA Jobs AI Assistant. You help candidates navigate the platform, improve their profiles, and get career advice. Be concise, friendly, and helpful. Format your responses in short paragraphs and use bullet points when applicable. Do not act like you are making external API calls; simply provide advice based on your knowledge base.";

    const chatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction,
      },
      history: history
    });

    const response = await chatSession.sendMessage({ message });
    res.json({ reply: response.text });
  } catch (err) {
    console.error('AI Chat Error:', err);
    res.status(500).json({ error: 'Failed to generate response: ' + err.message });
  }
});

// 18. Community Feed
app.get('/api/posts', (req, res) => {
  const query = `
    SELECT p.id, p.content, p.created_at, u.role, u.email,
           pr.firstName, pr.lastName, j.company
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN profiles pr ON u.id = pr.user_id
    LEFT JOIN jobs j ON u.id = j.company_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // In our simplified schema, multiple jobs might have the same company_id. 
    // To avoid duplication or just to grab the company name, we left join `jobs`.
    // Actually, distinct mapping is better, but since it's just a name string:
    res.json({ posts: rows });
  });
});

app.post('/api/posts', (req, res) => {
  const { user_id, content } = req.body;
  if (!user_id || !content) {
    return res.status(400).json({ error: 'User ID and content are required' });
  }

  db.run(
    `INSERT INTO posts (user_id, content) VALUES (?, ?)`,
    [user_id, content],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Post created', id: this.lastID });
    }
  );
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
});
