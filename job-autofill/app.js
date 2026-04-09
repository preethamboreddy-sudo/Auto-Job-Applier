/**
 * job-autofill - State and UI Management
 */

const app = {
  state: {
    currentUser: null, // null if not logged in
    currentView: 'landing-view',
    profile: {}, // stores user profile data
    selectedJobId: null,
    savedJobIds: [], // stores IDs of saved jobs
    aiChatHistory: [], // stores chat messages natively
  },

  API_URL: '/api', // Will resolve dynamically to current origin on Railway
  mockJobs: [], // Will be fetched from backend

  async init() {
    // Theme Initialization
    const savedTheme = localStorage.getItem('bura-theme') || 'dark';
    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      const icon = document.getElementById('theme-icon');
      if (icon) icon.innerText = 'dark_mode';
    }

    this.loadLocalSession();
    this.setupEventListeners();

    // Initial routing based on auth state
    if (this.state.currentUser) {
      await this.fetchProfile();
      await this.fetchSavedJobs();
      await this.fetchJobs();

      if (['admin', 'company'].includes(this.state.currentUser.role)) {
        this.navigate('admin-view');
      } else if (Object.keys(this.state.profile).length > 2) {
        this.navigate('jobs-view');
      } else {
        this.navigate('profile-view');
      }
    } else {
      this.navigate('landing-view');
    }
  },

  loadLocalSession() {
    const storedUser = localStorage.getItem('jobapp_user');
    if (storedUser) this.state.currentUser = JSON.parse(storedUser);
  },

  saveLocalSession() {
    if (this.state.currentUser) {
      localStorage.setItem(
        'jobapp_user',
        JSON.stringify(this.state.currentUser)
      );
    } else {
      localStorage.removeItem('jobapp_user');
    }
  },

  async fetchProfile() {
    if (!this.state.currentUser) return;
    try {
      const res = await fetch(
        `${this.API_URL}/profile/${this.state.currentUser.id}`
      );
      if (res.ok) {
        const data = await res.json();
        this.state.profile = data.profile || {};
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  },

  async fetchSavedJobs() {
    if (!this.state.currentUser || this.state.currentUser.role === 'company') return;
    try {
      const res = await fetch(`${this.API_URL}/user/${this.state.currentUser.id}/saved-jobs`);
      if (res.ok) {
        const data = await res.json();
        this.state.savedJobIds = data.savedJobIds || [];
      }
    } catch (error) {
      console.error('Error fetching saved jobs:', error);
    }
  },

  async fetchJobs() {
    try {
      const res = await fetch(`${this.API_URL}/jobs`);
      if (res.ok) {
        const data = await res.json();
        this.mockJobs = data.jobs;
        if (this.state.currentView === 'jobs-view') {
          this.renderJobs();
        } else if (this.state.currentView === 'saved-jobs-view') {
          this.renderSavedJobs();
        }
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  },

  navigate(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach((view) => {
      view.classList.add('hidden');
    });

    // Show target view
    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.classList.remove('hidden');
      this.state.currentView = viewId;
    }

    this.updateNav();

    // Specific view initialization
    if (viewId === 'jobs-view') {
      this.renderJobs();
      this.wrapMainContainer(true);
    } else if (viewId === 'profile-view') {
      this.populateProfileForm();
      this.wrapMainContainer(true);
    } else if (viewId === 'auth-view' || viewId === 'job-detail-view') {
      this.wrapMainContainer(true);
    } else if (viewId === 'landing-view') {
      this.wrapMainContainer(false);
      this.initCharts();
    } else if (viewId === 'applications-view') {
      this.renderApplicationHistory();
      this.wrapMainContainer(true);
    } else if (viewId === 'saved-jobs-view') {
      this.renderSavedJobs();
      this.wrapMainContainer(true);
    } else if (viewId === 'admin-view') {
      this.renderAdminDashboard();
      this.renderAdminJobs();
      this.wrapMainContainer(true);
    }
  },

  // Helper to add padding specifically for non-landing pages
  wrapMainContainer(shouldWrap) {
    const sections = document.querySelectorAll('.view > div:first-child');
    sections.forEach((sec) => {
      if (
        shouldWrap &&
        !sec.classList.contains('auth-view-content') &&
        sec.parentElement.id !== 'landing-view'
      ) {
        sec.parentElement.classList.add('jobs-dashboard'); // Using this class just for margins
      } else if (!shouldWrap) {
        sec.parentElement.classList.remove('jobs-dashboard');
      }
    });

    // Ensure nav logo goes to correct dashboard if logged in
    const brand = document.querySelector('.nav-brand');
    if (brand) {
      brand.onclick = () => {
        if (!this.state.currentUser) return this.navigate('landing-view');
        if (['admin', 'company'].includes(this.state.currentUser.role)) return this.navigate('admin-view');
        this.navigate('jobs-view');
      };
    }
  },

  updateNav() {
    const navLinks = document.getElementById('nav-links');

    if (this.state.currentUser) {
      let adminLink = '';
      if (['admin', 'company'].includes(this.state.currentUser.role)) {
        adminLink = `<a class="nav-item ${this.state.currentView === 'admin-view' ? 'active' : ''}" onclick="app.navigate('admin-view')">Company Dashboard</a>`;
      }

      navLinks.innerHTML = `
                ${adminLink}
                ${['user'].includes(this.state.currentUser.role) ? `
                <a class="nav-item ${this.state.currentView === 'jobs-view' ? 'active' : ''}" onclick="app.navigate('jobs-view')">Dashboard</a>
                <a class="nav-item ${this.state.currentView === 'saved-jobs-view' ? 'active' : ''}" onclick="app.navigate('saved-jobs-view')">Saved Jobs</a>
                <a class="nav-item ${this.state.currentView === 'profile-view' ? 'active' : ''}" onclick="app.navigate('profile-view')">Profile</a>
                <a class="nav-item ${this.state.currentView === 'applications-view' ? 'active' : ''}" onclick="app.navigate('applications-view')">My Applications</a>
                ` : ''}
                <span class="nav-item" onclick="app.logout()">
                    <span class="material-icons-round" style="vertical-align: middle; font-size: 1.2rem;">logout</span>
                </span>
            `;
    } else {
      navLinks.innerHTML = `
                <a class="nav-item ${this.state.currentView === 'landing-view' ? 'active' : ''}" onclick="app.navigate('landing-view')">Home</a>
                <a class="nav-item ${this.state.currentView === 'auth-view' ? 'active' : ''}" onclick="app.navigate('auth-view')">Login / Sign Up</a>
            `;
    }
  },

  setupEventListeners() {
    // Auth form submission
    const authForm = document.getElementById('auth-form');
    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const roleSelect = document.getElementById('auth-role');
        const role = roleSelect ? roleSelect.value : 'user';
        const submitBtn = authForm.querySelector('button');
        const titleText = document.getElementById('auth-title').innerText;

        try {
          submitBtn.disabled = true;
          submitBtn.innerText = 'Processing...';

          const isLogin = titleText.includes('Login');
          const endpoint = isLogin ? '/auth/login' : '/auth/register';

          const bodyData = { email, password };
          if (!isLogin) bodyData.role = role;

          const res = await fetch(`${this.API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData),
          });

          const data = await res.json();

          if (!res.ok) throw new Error(data.error || 'Authentication failed');

          this.state.currentUser = data.user;
          this.saveLocalSession();
          await this.fetchProfile();
          await this.fetchSavedJobs();
          await this.fetchJobs();

          if (['admin', 'company'].includes(this.state.currentUser.role)) {
            this.navigate('admin-view');
          } else if (
            Object.keys(this.state.profile).length > 2 ||
            Object.keys(this.state.profile).filter(
              (k) => this.state.profile[k] !== null
            ).length > 2
          ) {
            this.navigate('jobs-view');
          } else {
            this.navigate('profile-view');
          }

          authForm.reset();
        } catch (err) {
          alert(err.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerText = titleText.includes('Login')
            ? 'Login'
            : 'Sign Up';
        }
      });

      const authToggle = document.getElementById('auth-toggle-link');
      if (authToggle) {
        authToggle.addEventListener('click', (e) => {
          e.preventDefault();
          const title = document.getElementById('auth-title');
          const btn = document.querySelector('#auth-form button');
          const toggleText = document.getElementById('auth-toggle-text');

          if (title.innerText === 'Create Account') {
            title.innerText = 'Login to Account';
            btn.innerText = 'Login';
            toggleText.innerText = "Don't have an account?";
            authToggle.innerText = 'Sign Up here';
            if (document.getElementById('auth-role-group')) document.getElementById('auth-role-group').style.display = 'none';
          } else {
            title.innerText = 'Create Account';
            btn.innerText = 'Sign Up';
            toggleText.innerText = 'Already have an account?';
            authToggle.innerText = 'Login here';
            if (document.getElementById('auth-role-group')) document.getElementById('auth-role-group').style.display = 'flex';
          }
        });
      }
    }

    // Profile form submission
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('input', () => {
        this.calculateProfileProgress();
      });

      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!this.state.currentUser) return;

        const formData = new FormData(profileForm);
        const profileData = {};

        for (let [key, value] of formData.entries()) {
          // Ignore file inputs for simulated state
          if (key !== 'resumeFile' && key !== 'aadharFile') {
            profileData[key] = value;
          }
        }

        // Keep simulated file flags
        if (formData.get('resumeFile').name) profileData.hasResume = true;
        if (formData.get('aadharFile').name) profileData.hasAadhar = true;

        try {
          const res = await fetch(
            `${this.API_URL}/profile/${this.state.currentUser.id}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(profileData),
            }
          );

          if (!res.ok) throw new Error('Failed to save profile');

          // Update local state
          Object.assign(this.state.profile, profileData);
          this.navigate('jobs-view');
        } catch (err) {
          alert(err.message);
        }
      });
    }
  },

  populateProfileForm() {
    const form = document.getElementById('profile-form');
    if (!form || Object.keys(this.state.profile).length === 0) return;

    for (const [key, value] of Object.entries(this.state.profile)) {
      const input = form.elements[key];
      if (input && key !== 'resumeFile' && key !== 'aadharFile') {
        input.value = value;
      }
    }

    // Enable download resume button if profile has data
    const downloadBtn = document.getElementById('btn-download-resume');
    if (downloadBtn) {
      downloadBtn.disabled = !this.state.profile.firstName; // Check a required field
    }

    this.calculateProfileProgress();
  },

  calculateProfileProgress() {
    const form = document.getElementById('profile-form');
    if (!form) return;

    const inputs = form.querySelectorAll(
      'input:not([type="file"]), select, textarea'
    );
    let total = inputs.length + 2; // +2 for resume and aadhar
    let filled = 0;

    inputs.forEach((input) => {
      if (input.value.trim() !== '') filled++;
    });

    const hasResume =
      form.querySelector('[name="resumeFile"]').value ||
      (this.state.profile && this.state.profile.hasResume);
    const hasAadhar =
      form.querySelector('[name="aadharFile"]').value ||
      (this.state.profile && this.state.profile.hasAadhar);

    if (hasResume) filled++;
    if (hasAadhar) filled++;

    const percentage = Math.round((filled / total) * 100) || 0;

    const fillEl = document.getElementById('profile-progress-fill');
    const textEl = document.getElementById('profile-progress-text');

    if (fillEl) fillEl.style.width = `${percentage}%`;
    if (textEl) textEl.innerText = `${percentage}%`;

    const downloadBtn = document.getElementById('btn-download-resume');
    if (downloadBtn && form.querySelector('[name="firstName"]')) {
      downloadBtn.disabled =
        !this.state.profile.firstName &&
        !form.querySelector('[name="firstName"]').value;
    }
  },

  logout() {
    this.state.currentUser = null;
    this.state.profile = {};
    this.saveLocalSession();
    this.navigate('landing-view');
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const icon = document.getElementById('theme-icon');
    if (currentTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('bura-theme', 'light');
      if (icon) icon.innerText = 'dark_mode';
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('bura-theme', 'dark');
      if (icon) icon.innerText = 'light_mode';
    }
  },

  downloadResume() {
    if (!this.state.currentUser) return;
    window.open(
      `${this.API_URL}/profile/${this.state.currentUser.id}/resume`,
      '_blank'
    );
  },

  async importResume(input) {
    const file = input.files[0];
    if (!file) return;

    const zoneText = document.getElementById('import-zone-text');
    zoneText.innerHTML = '<span class="text-gradient">AI is analyzing your resume... Please wait.</span>';
    
    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await fetch(`${this.API_URL}/profile/parse`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      
      this.state.profile = { ...this.state.profile, ...data.parsedProfile };
      this.populateProfileForm();
      
      zoneText.innerHTML = '<span style="color: var(--success-color);">Import complete! Please review your details below.</span>';
    } catch (err) {
      alert(err.message);
      zoneText.innerText = 'Click or drag your PDF Resume here';
    }
    
    input.value = '';
  },

  // To be implemented: Jobs rendering and Application processing
  chartsInitialized: false,

  initCharts() {
    if (this.chartsInitialized) return;

    const appCtx = document.getElementById('applicationsChart');
    const indCtx = document.getElementById('industryChart');

    if (!appCtx || !indCtx || typeof Chart === 'undefined') return;

    Chart.defaults.color = '#8b949e';
    Chart.defaults.font.family = "'Outfit', sans-serif";

    new Chart(appCtx, {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Applications Auto-Filled (k)',
            data: [12, 19, 25, 32, 45, 60],
            backgroundColor: 'rgba(88, 166, 255, 0.6)',
            borderColor: '#58a6ff',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
          },
          x: { grid: { display: false } },
        },
      },
    });

    new Chart(indCtx, {
      type: 'doughnut',
      data: {
        labels: ['Technology', 'Finance', 'Healthcare', 'E-commerce'],
        datasets: [
          {
            data: [45, 25, 20, 10],
            backgroundColor: ['#58a6ff', '#bc8cff', '#ff7b72', '#3fb950'],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom' },
        },
      },
    });

    this.chartsInitialized = true;
  },

  renderJobs() {
    this.renderJobsToContainer('jobs-container', this.mockJobs);
  },

  renderSavedJobs() {
    const savedJobs = this.mockJobs.filter(j => this.state.savedJobIds.includes(j.id));
    if (savedJobs.length === 0) {
      const container = document.getElementById('saved-jobs-container');
      if (container) container.innerHTML = '<p class="text-center" style="grid-column: 1 / -1; padding: 3rem;">You have not saved any jobs yet.</p>';
      return;
    }
    this.renderJobsToContainer('saved-jobs-container', savedJobs);
  },

  async toggleSavedJob(jobId, e) {
    if (e) e.stopPropagation();
    if (!this.state.currentUser || this.state.currentUser.role === 'company') return;
    
    try {
      const res = await fetch(`${this.API_URL}/user/${this.state.currentUser.id}/saved-jobs`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ jobId })
      });
      const data = await res.json();
      
      if (data.saved) this.state.savedJobIds.push(jobId);
      else this.state.savedJobIds = this.state.savedJobIds.filter(id => id !== jobId);
      
      // Re-render views
      if (this.state.currentView === 'saved-jobs-view') this.renderSavedJobs();
      if (this.state.currentView === 'jobs-view') this.renderJobs();
    } catch(err) {
      console.error(err);
    }
  },

  renderJobsToContainer(containerId, jobsList) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (jobsList.length === 0) {
      container.innerHTML =
        '<p class="text-center">No jobs available at the moment.</p>';
      return;
    }

    jobsList.forEach((job) => {
      const card = document.createElement('div');
      card.className = 'job-card glass-panel fade-in-up glow-hover';

      // Handle skills if they are an array or string
      const skillsArray = Array.isArray(job.skills)
        ? job.skills
        : job.skills.split(',').map((s) => s.trim());
      const displaySkills = skillsArray.slice(0, 3);
      const extraSkills =
        skillsArray.length > 3 ? `+${skillsArray.length - 3}` : '';

      let skillsHtml = displaySkills
        .map((s) => `<span class="skill-tag">${s}</span>`)
        .join('');
      if (extraSkills)
        skillsHtml += `<span class="skill-tag">${extraSkills}</span>`;

      const isSaved = this.state.savedJobIds.includes(job.id);
      const savedButtonHtml = (this.state.currentUser && this.state.currentUser.role !== 'company') ?
        `<button onclick="app.toggleSavedJob('${job.id}', event)" class="btn btn-secondary btn-small" style="background: transparent; border: none; padding: 0.2rem; cursor: pointer; color: ${isSaved ? 'var(--primary-color)' : 'var(--text-secondary)'};" title="Save Job"><span class="material-icons-round" style="font-size: 1.5rem;">${isSaved ? 'bookmark' : 'bookmark_border'}</span></button>`
        : '';

      card.innerHTML = `
                <div class="job-header">
                    <div class="job-logo">${job.logo}</div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span class="job-type">${job.type}</span>
                        ${savedButtonHtml}
                    </div>
                </div>
                <h3 class="job-title" style="margin-top: 0.5rem;">${job.title}</h3>
                <div class="job-meta">
                    <span class="meta-item"><span class="material-icons-round">business</span> ${job.company}</span>
                    <span class="meta-item"><span class="material-icons-round">location_on</span> ${job.location}</span>
                </div>
                <div class="job-skills">${skillsHtml}</div>
                <div class="job-footer">
                    <span class="job-salary">${job.salary}</span>
                    <button class="btn btn-primary" onclick="app.viewJobDetails('${job.id}')">View & Apply</button>
                </div>
            `;
      container.appendChild(card);
    });
  },

  viewJobDetails(jobId) {
    this.state.selectedJobId = jobId;
    const job = this.mockJobs.find((j) => j.id === jobId);
    if (!job) return;

    // Render job details
    const container = document.getElementById('job-detail-content');
    if (container) {
      const skillsArray = Array.isArray(job.skills)
        ? job.skills
        : job.skills.split(',').map((s) => s.trim());
      const skillsHtml = skillsArray
        .map((s) => `<span class="skill-tag">${s}</span>`)
        .join('');

      container.innerHTML = `
                <div class="detail-header">
                    <div class="detail-title-wrapper">
                        <div class="job-logo large">${job.logo}</div>
                        <div>
                            <h2 class="detail-title">${job.title}</h2>
                            <div class="job-meta">
                                <span class="meta-item"><span class="material-icons-round">business</span> ${job.company}</span>
                                <span class="meta-item"><span class="material-icons-round">location_on</span> ${job.location}</span>
                                <span class="meta-item tag-style">${job.type}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="detail-body">
                    <h3>Job Description</h3>
                    <p>${job.description}</p>
                    
                    <h3 class="mt-2">Required Skills</h3>
                    <div class="job-skills">${skillsHtml}</div>
                </div>
                
                <div class="detail-footer mt-2">
                    <div class="salary-block">
                        <span class="text-secondary" style="display:block; font-size: 0.9rem;">Expected Salary</span>
                        <span class="job-salary" style="font-size: 1.5rem;">${job.salary}</span>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; align-items: center;">
                      <button class="btn btn-secondary btn-large glow-hover" onclick="app.generateCoverLetter('${job.id}')" style="border-color: var(--primary-color); color: var(--primary-color);">
                          <span class="material-icons-round" style="margin-right:8px">auto_awesome</span> AI Cover Letter
                      </button>
                      <button class="btn btn-primary btn-large" onclick="app.openApplyModal()">
                          Apply Now <span class="material-icons-round" style="margin-left:8px">send</span>
                      </button>
                    </div>
                    
                    <button class="btn btn-secondary btn-large" onclick="app.navigate('jobs-view')">Back to Jobs</button>
                </div>
            `;
    }

    this.navigate('job-detail-view');
    window.scrollTo(0, 0);
  },

  openApplyModal() {
    const job = this.mockJobs.find((j) => j.id === this.state.selectedJobId);
    if (!job) return;

    const modalJobTitle = document.getElementById('modal-job-title');
    if (modalJobTitle) modalJobTitle.textContent = job.title;

    const modal = document.getElementById('apply-modal');
    if (modal) modal.classList.remove('hidden');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  },

  async generateCoverLetter(jobId) {
    if (!this.state.currentUser) return;
    
    const modal = document.getElementById('cover-letter-modal');
    const textArea = document.getElementById('cover-letter-text');
    
    if (modal && textArea) {
      modal.classList.remove('hidden');
      textArea.value = "Generating your tailored cover letter with Gemini AI... Please wait.";
      textArea.disabled = true;
      
      try {
        const res = await fetch(`${this.API_URL}/jobs/${jobId}/cover-letter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: this.state.currentUser.id })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Generation failed');
        
        textArea.value = data.coverLetter;
        textArea.disabled = false;
      } catch (err) {
        textArea.value = `Error generating cover letter: ${err.message}\n(Make sure GEMINI_API_KEY is configured in your .env file)`;
        textArea.disabled = false;
      }
    }
  },

  copyCoverLetter() {
    const text = document.getElementById('cover-letter-text').value;
    navigator.clipboard.writeText(text);
    alert('Cover letter copied to clipboard!');
  },

  async processApplication(type) {
    this.closeModal('apply-modal');

    if (type === 'manual') {
      alert('Redirecting to profile form for manual entry...');
      this.navigate('profile-view');
      return;
    }

    // Auto-fill path
    // Check if profile has basic data collected (at least 3 fields filled explicitly)
    const filledFieldsCount = Object.keys(this.state.profile).filter(
      (k) => this.state.profile[k] !== null && this.state.profile[k] !== ''
    ).length;
    if (filledFieldsCount < 3) {
      alert(
        'Your profile is incomplete. Please complete your profile to use auto-fill.'
      );
      this.navigate('profile-view');
      return;
    }

    try {
      const res = await fetch(`${this.API_URL}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.state.currentUser.id,
          jobId: this.state.selectedJobId,
        }),
      });

      if (!res.ok) throw new Error('Failed to submit application');

      // Show success modal roughly animating submission
      setTimeout(() => {
        const modal = document.getElementById('success-modal');
        if (modal) modal.classList.remove('hidden');
      }, 300);
    } catch (err) {
      alert(err.message);
    }
  },

  closeSuccessModal() {
    const modal = document.getElementById('success-modal');
    if (modal) modal.classList.add('hidden');
    this.navigate('jobs-view');
  },

  // Feature 2: Application History
  async renderApplicationHistory() {
    if (!this.state.currentUser) return;

    const container = document.getElementById('applications-list');
    if (!container) return;

    container.innerHTML = '<p class="text-center">Loading applications...</p>';

    try {
      const res = await fetch(
        `${this.API_URL}/applications/user/${this.state.currentUser.id}`
      );
      if (!res.ok) throw new Error('Failed to load applications');

      const data = await res.json();
      let apps = data.applications;

      const filterSelect = document.getElementById('app-history-filter');
      const filterValue = filterSelect ? filterSelect.value : 'All';

      if (filterValue !== 'All') {
        apps = apps.filter((app) => app.status === filterValue);
      }

      if (apps.length === 0) {
        container.innerHTML = `
                    <div class="empty-state text-center" style="padding: 4rem;">
                        <span class="material-icons-round" style="font-size: 4rem; color: var(--text-secondary); margin-bottom: 1rem;">inbox</span>
                        <p>You haven't applied to any jobs yet.</p>
                        <button class="btn btn-primary glow-hover mt-2" onclick="app.navigate('jobs-view')">Browse Jobs</button>
                    </div>
                `;
        return;
      }

      let html = '<div class="applications-grid">';
      apps.forEach((app) => {
        const date = new Date(app.applied_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        const statusColor =
          app.status === 'Accepted'
            ? 'var(--success-color)'
            : app.status === 'Rejected'
              ? '#ff7b72'
              : 'var(--primary-color)';

        let interviewAction = '';
        if (app.status === 'Interviewing') {
           if (app.selected_slot && app.meeting_link) {
               interviewAction = `<span style="font-size: 0.85rem; color: var(--primary-color); margin-left:1rem;">Time: ${app.selected_slot}</span>
               <a href="${app.meeting_link}" target="_blank" class="btn btn-primary btn-small" style="padding: 0.2rem 0.8rem; display: inline-flex; align-items: center; gap: 4px; text-decoration: none; font-size: 0.8rem; margin-left: 0.5rem;"><span class="material-icons-round" style="font-size: 1rem;">videocam</span> Join</a>`;
           } else if (app.available_slots) {
               let slots = [];
               try { slots = typeof app.available_slots === 'string' ? JSON.parse(app.available_slots) : app.available_slots; } catch(e) {}
               if (slots && slots.length > 0) {
                   interviewAction = `<div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap; width: 100%;">
                       <span style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center;">Pick a slot: </span>
                       ${slots.map(s => `<button class="btn btn-secondary btn-small" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;" onclick="app.confirmInterviewSlot(${app.applicationId}, '${s}')">${s}</button>`).join('')}
                   </div>`;
               }
           }
        }

        html += `
                    <div class="app-history-card glass-panel fade-in-up">
                        <div class="job-logo">${app.logo}</div>
                        <div class="app-history-content">
                            <h3>${app.title}</h3>
                            <p class="company-name">${app.company} • ${app.location}</p>
                            <div class="app-meta">
                                <span class="applied-date"><span class="material-icons-round" style="font-size: 1rem; vertical-align: middle;">event</span> Applied: ${date}</span>
                                <span class="app-status" style="color: ${statusColor}; border: 1px solid ${statusColor}; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">${app.status.toUpperCase()}</span>
                                <button class="btn btn-secondary btn-small" style="padding: 0.2rem 0.6rem; display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem; margin-left: 0.5rem;" onclick="app.openChat(${app.applicationId})"><span class="material-icons-round" style="font-size: 1rem;">chat</span> Chat</button>
                                ${interviewAction}
                            </div>
                        </div>
                    </div>
                `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (error) {
      container.innerHTML = `<p class="text-center text-error">Error: ${error.message}</p>`;
    }
  },

  // Feature 3: Admin/Company Dashboard
  async renderAdminDashboard() {
    if (!this.state.currentUser || !['admin', 'company'].includes(this.state.currentUser.role)) {
      this.navigate('jobs-view');
      return;
    }

    const container = document.getElementById('admin-applications-list');
    if (!container) return;

    container.innerHTML =
      '<p class="text-center">Loading all applications...</p>';

    try {
      const endpoint = this.state.currentUser.role === 'company' 
          ? `/company/applications/${this.state.currentUser.id}` 
          : '/admin/applications';
      const res = await fetch(`${this.API_URL}${endpoint}`);
      if (!res.ok) throw new Error('Failed to load applications');

      const data = await res.json();
      const apps = data.applications;

      // Define Columns
      const columns = [
        { id: 'Under Review', title: 'Under Review' },
        { id: 'Shortlisted', title: 'Shortlisted' },
        { id: 'Interviewing', title: 'Interviewing' },
        { id: 'Accepted', title: 'Accepted' },
        { id: 'Rejected', title: 'Rejected' },
      ];

      let html = `<div class="kanban-board">`;
      columns.forEach(col => {
        const colApps = apps.filter(a => (a.status || 'Under Review') === col.id);
        
        html += `
          <div class="kanban-column" ondragover="app.allowDrop(event)" ondrop="app.drop(event, '${col.id}')">
            <div class="kanban-header">
              <span>${col.title}</span>
              <span class="badge" style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${colApps.length}</span>
            </div>
            <div class="kanban-cards">
        `;
        
        colApps.forEach(ap => {
          const name = ap.firstName ? `${ap.firstName} ${ap.lastName}` : ap.email;
          
          html += `
            <div class="kanban-card" draggable="true" ondragstart="app.drag(event, ${ap.applicationId})" ondragend="app.dragEnd(event)">
              <div class="k-card-title">${name}</div>
              <div class="k-card-meta">${ap.jobTitle}</div>
              ${ap.meeting_link ? `<div style="font-size: 0.8rem; margin-top: 0.5rem; color: var(--primary-color);">⌚ ${ap.selected_slot}</div>` : ''}
              <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
                <button class="btn btn-secondary btn-small" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;" onclick="window.open('${this.API_URL}/profile/${ap.candidateId}/resume', '_blank')">Profile</button>
                <button class="btn btn-secondary btn-small" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;" onclick="app.openChat(${ap.applicationId})"><span class="material-icons-round" style="font-size: 1rem; vertical-align: middle;">chat</span></button>
                ${col.id === 'Shortlisted' || col.id === 'Under Review' ? `<button class="btn btn-primary btn-small" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;" onclick="app.scheduleInterview(${ap.applicationId})">Interview</button>` : ''}
                ${ap.meeting_link ? `<button class="btn btn-primary btn-small" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; background: var(--success-color); border: none;" onclick="window.open('${ap.meeting_link}', '_blank')"><span class="material-icons-round" style="font-size: 0.9rem; vertical-align: middle;">videocam</span> Join</button>` : ''}
              </div>
            </div>
          `;
        });
        
        html += `</div></div>`;
      });
      html += `</div>`;
      
      container.innerHTML = html;
    } catch (error) {
      container.innerHTML = `<p class="text-center">Error: ${error.message}</p>`;
    }
  },

  async updateApplicationStatus(appId, newStatus) {
    try {
      const res = await fetch(
        `${this.API_URL}/admin/applications/${appId}/status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) throw new Error('Failed to update status');
    } catch (error) {
      alert(error.message);
    }
  },

  allowDrop(ev) {
    ev.preventDefault();
  },

  drag(ev, appId) {
    ev.dataTransfer.setData("applicationId", appId);
    ev.target.classList.add('dragging');
  },
  
  dragEnd(ev) {
    ev.target.classList.remove('dragging');
  },

  async drop(ev, newStatus) {
    ev.preventDefault();
    const appId = ev.dataTransfer.getData("applicationId");
    if (appId) {
      await this.updateApplicationStatus(appId, newStatus);
      this.renderAdminDashboard();
    }
  },

  async confirmInterviewSlot(appId, slot) {
    try {
      const res = await fetch(`${this.API_URL}/applications/${appId}/confirm-slot`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ selected_slot: slot })
      });
      if (res.ok) {
        alert('Interview confirmed!');
        this.renderApplicationHistory(); 
      }
    } catch(err) { console.error(err); }
  },

  async scheduleInterview(appId) {
    const defaultSlots = "Oct 24 10:00 AM, Oct 25 2:00 PM, Oct 26 1:00 PM";
    const input = prompt('Enter 3 proposed date/time slots for the interview (comma separated):', defaultSlots);
    
    if (!input) return; // Cancelled
    
    const slots = input.split(',').map(s => s.trim()).filter(s => s);
    if (slots.length === 0) return;
    
    try {
      const res = await fetch(`${this.API_URL}/applications/${appId}/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available_slots: slots }),
      });

      if (!res.ok) throw new Error('Failed to schedule interview');
      
      alert('Interview slots sent successfully to candidate!');
      this.renderAdminDashboard(); 
    } catch (err) {
      alert(err.message);
    }
  },

  async createJob(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const jobData = Object.fromEntries(formData.entries());

    if (this.state.currentUser.role === 'company') {
      jobData.company_id = this.state.currentUser.id;
      if (!jobData.company && this.state.profile && this.state.profile.firstName) {
        jobData.company = this.state.profile.firstName + (this.state.profile.lastName ? ' ' + this.state.profile.lastName : '');
      }
    }

    try {
      const res = await fetch(`${this.API_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData),
      });
      if (!res.ok) throw new Error('Failed to create job');
      form.reset();
      await this.fetchJobs();
      this.renderAdminJobs();
    } catch (err) {
      alert(err.message);
    }
  },

  async deleteJob(jobId) {
    if (!confirm('Are you strictly sure you want to delete this job posting?'))
      return;
    try {
      const res = await fetch(`${this.API_URL}/jobs/${jobId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete job');
      await this.fetchJobs();
      this.renderAdminJobs();
    } catch (err) {
      alert(err.message);
    }
  },

  renderAdminJobs() {
    const container = document.getElementById('admin-jobs-list');
    if (!container) return;

    let displayJobs = this.mockJobs;
    if (this.state.currentUser && this.state.currentUser.role === 'company') {
      displayJobs = this.mockJobs.filter(j => j.company_id === this.state.currentUser.id);
    }

    if (displayJobs.length === 0) {
      container.innerHTML = '<p class="text-center">No active jobs found.</p>';
      return;
    }

    let html = `<table class="admin-table"><thead><tr><th>Job</th><th>Type</th><th>Actions</th></tr></thead><tbody>`;
    displayJobs.forEach((job) => {
      html += `<tr>
        <td><strong>${job.title}</strong><br><small>${job.company}</small></td>
        <td>${job.type}</td>
        <td><button class="btn btn-secondary btn-small" onclick="app.deleteJob('${job.id}')" style="color: #ff7b72; border-color: rgba(255,123,114,0.3);">Remove</button></td>
      </tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  currentChatAppId: null,

  async openChat(appId) {
    this.state.currentChatAppId = appId;
    const modal = document.getElementById('chat-modal');
    if (modal) {
        modal.classList.remove('hidden');
        await this.loadMessages();
    }
  },

  async loadMessages() {
    if (!this.state.currentChatAppId) return;
    try {
      const res = await fetch(`${this.API_URL}/applications/${this.state.currentChatAppId}/messages`);
      const data = await res.json();
      
      const container = document.getElementById('chat-messages');
      container.innerHTML = '';
      
      if (data.messages && data.messages.length > 0) {
          data.messages.forEach(m => {
            const isMe = m.sender_id === this.state.currentUser.id;
            const senderName = m.role === 'company' ? 'Company' : (m.firstName ? `${m.firstName}` : 'Candidate');
            
            container.innerHTML += `
              <div style="align-self: ${isMe ? 'flex-end' : 'flex-start'}; background: ${isMe ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)'}; padding: 0.5rem 1rem; border-radius: 12px; max-width: 80%;">
                 <div style="font-size: 0.7rem; opacity: 0.7; margin-bottom: 2px;">${isMe ? 'You' : senderName}</div>
                 <div style="font-size: 0.95rem;">${m.message}</div>
              </div>
            `;
          });
      } else {
          container.innerHTML = `<p class="text-center text-secondary" style="margin: auto;">No messages yet. Start the conversation!</p>`;
      }
      container.scrollTop = container.scrollHeight;
    } catch(err) { console.error(err); }
  },

  async sendMessage() {
    if (!this.state.currentChatAppId) return;
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    try {
      await fetch(`${this.API_URL}/applications/${this.state.currentChatAppId}/messages`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sender_id: this.state.currentUser.id, message: text })
      });
      input.value = '';
      await this.loadMessages();
    } catch(err) { console.error(err); }
  },

  // --- AI Chatbot Methods ---
  toggleAIChat() {
    const modal = document.getElementById('ai-chat-modal');
    if (modal.classList.contains('hidden')) {
      modal.classList.remove('hidden');
      if (!this.state.aiChatHistory || this.state.aiChatHistory.length === 0) {
        this.appendAIChatMessage('model', 'Hello! I am the BURA Jobs AI Assistant. How can I help you today?');
        this.state.aiChatHistory = [{ role: 'model', text: 'Hello! I am the BURA Jobs AI Assistant. How can I help you today?' }];
      }
      setTimeout(() => document.getElementById('ai-chat-input').focus(), 100);
    } else {
      modal.classList.add('hidden');
    }
  },

  async sendAIChat() {
    const input = document.getElementById('ai-chat-input');
    const text = input.value.trim();
    if (!text) return;
    
    this.appendAIChatMessage('user', text);
    input.value = '';
    
    if (!this.state.aiChatHistory) this.state.aiChatHistory = [];
    const requestHistory = this.state.aiChatHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));
    
    this.state.aiChatHistory.push({ role: 'user', text });
    this.appendAIChatMessage('model', '...', true);
    
    try {
      const res = await fetch(`${this.API_URL}/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: requestHistory, message: text })
      });
      
      const data = await res.json();
      this.removeAITypingIndicator();
      
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      
      this.state.aiChatHistory.push({ role: 'model', text: data.reply });
      this.appendAIChatMessage('model', data.reply);
      
    } catch (err) {
      this.removeAITypingIndicator();
      this.appendAIChatMessage('model', 'Error: ' + err.message);
    }
  },
  
  appendAIChatMessage(role, text, isTyping = false) {
    const container = document.getElementById('ai-chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.style.alignSelf = role === 'user' ? 'flex-end' : 'flex-start';
    msgDiv.style.background = role === 'user' ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)';
    msgDiv.style.border = role === 'model' ? '1px solid var(--border-color)' : 'none';
    msgDiv.style.color = role === 'user' ? '#fff' : 'var(--text-primary)';
    msgDiv.style.padding = '0.8rem 1rem';
    msgDiv.style.borderRadius = '16px';
    if(role === 'user') msgDiv.style.borderBottomRightRadius = '4px';
    else msgDiv.style.borderBottomLeftRadius = '4px';
    msgDiv.style.maxWidth = '85%';
    msgDiv.style.lineHeight = '1.4';
    msgDiv.style.fontSize = '0.95rem';
    if (isTyping) msgDiv.id = 'ai-typing-indicator';
    
    let formattedText = text.replace(/\n/g, '<br>');
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    msgDiv.innerHTML = formattedText;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
  },
  
  removeAITypingIndicator() {
    const indicator = document.getElementById('ai-typing-indicator');
    if (indicator) indicator.remove();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
