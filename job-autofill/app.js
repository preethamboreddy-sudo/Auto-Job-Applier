/**
 * job-autofill - State and UI Management
 */

const app = {
  state: {
    currentUser: null, // null if not logged in
    currentView: 'landing-view',
    profile: {}, // stores user profile data
    selectedJobId: null,
  },

  API_URL: 'http://localhost:3001/api',
  mockJobs: [], // Will be fetched from backend

  async init() {
    this.loadLocalSession();
    this.setupEventListeners();

    // Initial routing based on auth state
    if (this.state.currentUser) {
      await this.fetchProfile();
      await this.fetchJobs();

      // Check if profile is complete
      if (Object.keys(this.state.profile).length > 2) {
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

  async fetchJobs() {
    try {
      const res = await fetch(`${this.API_URL}/jobs`);
      if (res.ok) {
        const data = await res.json();
        this.mockJobs = data.jobs;
        if (this.state.currentView === 'jobs-view') {
          this.renderJobs();
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
    } else if (viewId === 'admin-view') {
      this.renderAdminDashboard();
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

    // Ensure nav logo goes to landing if logged out
    const brand = document.querySelector('.nav-brand');
    if (brand) {
      brand.onclick = () =>
        this.navigate(this.state.currentUser ? 'jobs-view' : 'landing-view');
    }
  },

  updateNav() {
    const navLinks = document.getElementById('nav-links');

    if (this.state.currentUser) {
      let adminLink = '';
      if (this.state.currentUser.role === 'admin') {
        adminLink = `<a class="nav-item ${this.state.currentView === 'admin-view' ? 'active' : ''}" onclick="app.navigate('admin-view')">Employer Admin</a>`;
      }

      navLinks.innerHTML = `
                ${adminLink}
                <a class="nav-item ${this.state.currentView === 'jobs-view' ? 'active' : ''}" onclick="app.navigate('jobs-view')">Dashboard</a>
                <a class="nav-item ${this.state.currentView === 'profile-view' ? 'active' : ''}" onclick="app.navigate('profile-view')">Profile</a>
                <a class="nav-item ${this.state.currentView === 'applications-view' ? 'active' : ''}" onclick="app.navigate('applications-view')">My Applications</a>
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
        const submitBtn = authForm.querySelector('button');
        const titleText = document.getElementById('auth-title').innerText;

        try {
          submitBtn.disabled = true;
          submitBtn.innerText = 'Processing...';

          const isLogin = titleText.includes('Login');
          const endpoint = isLogin ? '/auth/login' : '/auth/register';

          const res = await fetch(`${this.API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          const data = await res.json();

          if (!res.ok) throw new Error(data.error || 'Authentication failed');

          this.state.currentUser = data.user;
          this.saveLocalSession();
          await this.fetchProfile();
          await this.fetchJobs();

          // If profile is empty, go to profile, else jobs
          if (
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
          } else {
            title.innerText = 'Create Account';
            btn.innerText = 'Sign Up';
            toggleText.innerText = 'Already have an account?';
            authToggle.innerText = 'Login here';
          }
        });
      }
    }

    // Profile form submission
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
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
  },

  logout() {
    this.state.currentUser = null;
    this.state.profile = {};
    this.saveLocalSession();
    this.navigate('landing-view');
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
    const container = document.getElementById('jobs-container');
    if (!container) return;

    container.innerHTML = '';

    if (this.mockJobs.length === 0) {
      container.innerHTML =
        '<p class="text-center">No jobs available at the moment.</p>';
      return;
    }

    this.mockJobs.forEach((job) => {
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

      card.innerHTML = `
                <div class="job-header">
                    <div class="job-logo">${job.logo}</div>
                    <span class="job-type">${job.type}</span>
                </div>
                <h3 class="job-title">${job.title}</h3>
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
                    <button class="btn btn-primary btn-large" onclick="app.openApplyModal()">
                        Apply Now <span class="material-icons-round" style="margin-left:8px">send</span>
                    </button>
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
      const apps = data.applications;

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

        html += `
                    <div class="app-history-card glass-panel fade-in-up">
                        <div class="job-logo">${app.logo}</div>
                        <div class="app-history-content">
                            <h3>${app.title}</h3>
                            <p class="company-name">${app.company} • ${app.location}</p>
                            <div class="app-meta">
                                <span class="applied-date"><span class="material-icons-round" style="font-size: 1rem; vertical-align: middle;">event</span> Applied: ${date}</span>
                                <span class="app-status" style="color: ${statusColor}; border: 1px solid ${statusColor}; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">${app.status.toUpperCase()}</span>
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

  // Feature 3: Admin Dashboard
  async renderAdminDashboard() {
    if (!this.state.currentUser || this.state.currentUser.role !== 'admin') {
      this.navigate('jobs-view');
      return;
    }

    const container = document.getElementById('admin-applications-list');
    if (!container) return;

    container.innerHTML =
      '<p class="text-center">Loading all applications...</p>';

    try {
      const res = await fetch(`${this.API_URL}/admin/applications`);
      if (!res.ok) throw new Error('Failed to load applications');

      const data = await res.json();
      const apps = data.applications;

      let html = `
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Candidate</th>
                            <th>Job Title</th>
                            <th>Applied On</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

      apps.forEach((app) => {
        const date = new Date(app.applied_at).toLocaleDateString();
        const name = app.firstName
          ? `${app.firstName} ${app.lastName}`
          : app.email;

        html += `
                    <tr>
                        <td>
                            <strong>${name}</strong><br>
                            <small>${app.email}</small>
                        </td>
                        <td>${app.jobTitle}<br><small>${app.company}</small></td>
                        <td>${date}</td>
                        <td>
                            <select onchange="app.updateApplicationStatus(${app.applicationId}, this.value)" class="status-select select-${app.status.toLowerCase().replace(' ', '-')}">
                                <option value="Under Review" ${app.status === 'Under Review' ? 'selected' : ''}>Under Review</option>
                                <option value="Interviewing" ${app.status === 'Interviewing' ? 'selected' : ''}>Interviewing</option>
                                <option value="Accepted" ${app.status === 'Accepted' ? 'selected' : ''}>Accepted</option>
                                <option value="Rejected" ${app.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                            </select>
                        </td>
                        <td>
                            <button class="btn btn-secondary btn-small" onclick="alert('Profile Summary:\\nDegree: ${app.degree || 'N/A'}\\nCollege: ${app.college || 'N/A'}\\nSkills: ${app.skills || 'N/A'}')">View Summary</button>
                        </td>
                    </tr>
                `;
      });

      html += `</tbody></table>`;
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
      // Refresh dashboard gently (to show updated color styles if needed)
      // this.renderAdminDashboard();
    } catch (error) {
      alert(error.message);
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
