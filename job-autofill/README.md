# Auto Job Applier

A web application that streamlines and automates the job application process. It features a static frontend and an Express application backed by SQLite to store and manage user data and applications.

## Technologies Used

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: SQLite3

## Prerequisites

Make sure you have [Node.js](https://nodejs.org/) and npm installed on your system.

## Setup Instructions

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
   node server.js
   ```

4. **Access the application:**

   Open `index.html` in your browser or serve the directory statically to view the frontend interface.

## Project Structure

- `app.js` - Frontend logic for the job applier form
- `server.js` - Express API server backend
- `database.js` - SQLite database initialization and models
- `index.html`, `styles.css` - Frontend UI components
