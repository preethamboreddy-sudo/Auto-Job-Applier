const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database (will create jobapp.db file if it doesn't exist)
const dbPath = path.resolve(__dirname, 'jobapp.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      (err) => {
        if (err) console.error('Error creating users table:', err.message);
      }
    );

    // Profiles table
    db.run(
      `CREATE TABLE IF NOT EXISTS profiles (
            user_id INTEGER PRIMARY KEY,
            firstName TEXT,
            middleName TEXT,
            lastName TEXT,
            gender TEXT,
            phone TEXT,
            dob TEXT,
            address TEXT,
            preferredLocation TEXT,
            nationality TEXT,
            aadharId TEXT,
            college TEXT,
            degree TEXT,
            stream TEXT,
            cgpa REAL,
            percentage12 REAL,
            percentage10 REAL,
            experience TEXT,
            skills TEXT,
            hasResume BOOLEAN DEFAULT 0,
            hasAadhar BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
      (err) => {
        if (err) console.error('Error creating profiles table:', err.message);
      }
    );

    // Jobs table
    db.run(
      `CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            company TEXT NOT NULL,
            location TEXT NOT NULL,
            type TEXT NOT NULL,
            salary TEXT NOT NULL,
            logo TEXT NOT NULL,
            description TEXT NOT NULL,
            skills TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      (err) => {
        if (err) console.error('Error creating jobs table:', err.message);
        else seedJobs();
      }
    );

    // Applications table
    db.run(
      `CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            job_id TEXT NOT NULL,
            status TEXT DEFAULT 'Under Review',
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (job_id) REFERENCES jobs(id)
        )`,
      (err) => {
        if (err)
          console.error('Error creating applications table:', err.message);
      }
    );

    console.log('Database tables initialized.');
  });
}

function seedJobs() {
  db.get(`SELECT count(*) as count FROM jobs`, (err, row) => {
    if (err || row.count > 0) return;

    const mockJobs = [
      [
        'job-1',
        'Senior Frontend Engineer',
        'TechNova',
        'Remote',
        'Full-time',
        '₹12,00,000 - ₹18,00,000',
        '💻',
        'We are looking for a Senior Frontend Engineer to build premium, modern web applications. You will work closely with our design team to create beautiful, responsive user interfaces.',
        'JavaScript, React, CSS, HTML5, UI/UX',
      ],
      [
        'job-2',
        'Backend Developer',
        'DataFlow Systems',
        'Bangalore, India',
        'Full-time',
        '₹10,00,000 - ₹15,00,000',
        '🖧',
        'Join our core infrastructure team to build scalable APIs and microservices. You will be responsible for defining database schemas, optimizing queries, and ensuring high availability.',
        'Node.js, Python, SQL, MongoDB, AWS',
      ],
      [
        'job-3',
        'UX/UI Designer',
        'Creative Studio',
        'Mumbai, India',
        'Contract',
        '₹8,00,000 - ₹12,00,000',
        '🎨',
        'We need a creative designer to help craft stunning user experiences. You will be responsible for wireframing, prototyping, and delivering high-fidelity designs.',
        'Figma, Adobe XD, Prototyping, Wireframing, User Research',
      ],
    ];

    const stmt = db.prepare(
      `INSERT INTO jobs (id, title, company, location, type, salary, logo, description, skills) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    mockJobs.forEach((job) => stmt.run(job));
    stmt.finalize();

    console.log('Seeded initial jobs data.');
  });
}

module.exports = db;
