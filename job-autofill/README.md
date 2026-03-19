# Auto Job Applier

A web application that streamlines and automates the job application process. It features a static frontend and an Express application backed by SQLite to store and manage user data and applications.

## Technologies Used

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Tooling**: Docker, Docker Compose, ESLint, Prettier, GitHub Actions

## Prerequisites

Make sure you have [Node.js](https://nodejs.org/) and npm installed on your system.
If you prefer containerization, you will require [Docker](https://www.docker.com/).

## Local Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/preethamboreddy-sudo/Auto-Job-Applier.git
   cd Auto-Job-Applier
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the server:**

   ```bash
   npm start
   ```

4. **Access the application:**
   Open `index.html` in your browser or serve the directory statically to view the frontend interface.

## Docker Setup

You can run the application seamlessly using Docker without establishing a local Node environment:

```bash
docker compose up --build
```
The application will be accessible at `http://localhost:3000`.

## Scripts and Code Quality

We enforce code syntax and auto-formatting directly in the project through Prettier and ESLint. Note that GitHub Actions is set up to verify these on any new commit.

- **Check Code Quality (ESLint):** `npm run lint`
- **Auto-Format Code (Prettier):** `npm run format`
- **Run the Application:** `npm start`

## Contributing

We welcome contributions! Please review our [Contribution Guidelines](CONTRIBUTING.md) for details prior to raising issues or making Pull Requests.

## Project Structure

- `app.js` - Frontend logic for the job applier form
- `server.js` - Express API server backend
- `database.js` - SQLite database initialization and models
- `index.html`, `styles.css` - Frontend UI components
- `docker-compose.yml`, `Dockerfile` - Backend environment initialization
