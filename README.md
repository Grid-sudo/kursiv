# Kursiv

Kursiv is a learning platform for secondary-school teachers. It helps educators learn how to apply AI in education and brings course content, assignments, feedback, and learner progress together in one place.

## Features

- Separate workspaces for administrators, teachers, curators, and learners
- Courses organized into weeks, days, and lessons
- Lesson editor for text, images, videos, PDF/DOCX files, and links, with automatic saving
- Learner preview for course authors
- Homework assignments, file submissions, review statuses, and written feedback
- Lesson completion and course progress tracking
- Course review and approval workflow

## Technology

- React and Vite
- Express and Node.js
- MongoDB and Mongoose
- JWT-based authentication and role-based access

## Run locally

### Requirements

- Node.js 20 or later
- MongoDB 7 or later

### Setup

1. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

2. Set `MONGODB_URI` and replace `JWT_SECRET` with a random secret of at least 32 characters.

3. Install dependencies from the project root:

   ```bash
   npm install
   npm install --prefix client
   npm install --prefix server
   ```

4. Start MongoDB. For a local MongoDB installation, the default URI in `.env.example` is `mongodb://127.0.0.1:27017/course_studio`.

5. Create the first administrator:

   ```bash
   cd server
   npm run create-admin -- admin@example.com "a-password-with-at-least-10-characters" Demo Admin
   cd ..
   ```

6. Start the client and server from the project root:

   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173).

## User roles

| Role | Main capabilities |
| --- | --- |
| Administrator | Manage accounts and roles, review courses, and monitor learning progress |
| Teacher | Create and edit courses, prepare lessons, and follow learner activity |
| Curator | Support learners, review homework, and follow learner progress |
| Learner | Open assigned courses, complete lessons, track progress, and submit homework |

## Configuration

The root `.env` file uses the variables in `.env.example`:

- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — secret used to sign authentication tokens
- `PORT` — server port; defaults to `4000`
- `CLIENT_ORIGIN` — frontend origin allowed by the server

Do not commit `.env` or real account passwords.
