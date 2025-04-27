# Note Taking API

A RESTful API for managing notes with version control, concurrency handling, and full-text search.  
Built with **Express.js**, **MySQL**, **Redis**, and **Docker**.

---

## Features

### Core Requirements

- **JWT Authentication**: Secure user registration/login with refresh tokens.
- **Note Versioning**: Track changes and revert to previous versions.
- **Optimistic Locking**: Prevent concurrent edits using version numbers.
- **Full-Text Search**: Efficient keyword search via MySQL `FULLTEXT` indexes.
- **Redis Caching**: Cache frequent requests (e.g., `GET /notes`).
- **Soft Deletion**: Preserve note history with paranoid tables.
- **File Attachments**: Upload images/videos (50 MB max, JPEG/PNG/MP4 only).

### Bonus Implemented

- **Refresh Tokens**: Rotating tokens for extended sessions.
- **Multimedia Support**: Attach files to notes and download them via API.

---

## Setup

### Prerequisites

- Docker and Docker Compose
- Node.js v23.11.0

### Steps

1. **Clone the repository**:

   ```bash
   git clone https://github.com/adnba/note-taking-app
   cd note-taking-app
   ```

2. **Configure environment variables**:

   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Fill in values for:
     - MySQL credentials (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, etc.)
     - JWT secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`)
     - Redis URL (`REDIS_URL`)

3. **Start the application**:
   ```bash
   docker-compose up --build
   ```
   The API will run at `http://localhost:3000`.

---

## API Endpoints

### Authentication

| Method | Endpoint             | Description                              |
| ------ | -------------------- | ---------------------------------------- |
| POST   | `/auth/signup`       | Register a new user.                     |
| POST   | `/auth/login`        | Login to get access/refresh tokens.      |
| POST   | `/auth/logout`       | Logout and revoke access/refresh tokens. |
| POST   | `/auth/refreshToken` | Refresh an expired access token.         |
| POST   | `/auth/profile`      | Get user basic profile info.             |

### Notes

| Method | Endpoint            | Description                                                    |
| ------ | ------------------- | -------------------------------------------------------------- |
| POST   | `/notes`            | Create a new note.                                             |
| GET    | `/notes`            | Fetch all notes (cached).                                      |
| POST   | `/notes/search`     | Search notes by keywords (body: `{ "keywords": "..." }`).      |
| GET    | `/notes/:id`        | Fetch a single note (cached).                                  |
| PUT    | `/notes/:id`        | Update a note (requires `version` in body).                    |
| PUT    | `/notes/:id/revert` | Revert to a previous version (body: `{ "targetVersion": 2 }`). |
| DELETE | `/notes/:id`        | Soft-delete a note.                                            |

### Attachments

| Method | Endpoint                                   | Description                         |
| ------ | ------------------------------------------ | ----------------------------------- |
| POST   | `/notes/:id/attachments`                   | Upload files (multipart/form-data). |
| GET    | `/notes/:noteId/attachments/:attachmentId` | Download an attachment.             |
| DELETE | `/notes/:noteId/attachments/:attachmentId` | Delete an attachment.               |

---

## Project Structure

```
src/
├── middleware/      # Auth, validation (checkToken, checkId, checkIds)
├── models/          # Sequelize models (User, Note, NoteVersion, etc.)
├── routes/          # API route handlers and controllers (auth, notes, attachments)
├── utils/           # JWT, Database and Redis helpers
└── uploads/         # Stores uploaded files (created automatically)
```

---

## Testing

Run tests with:

- [Postman Collection](https://www.postman.com/adnenba/workspace/my-workspace/collection/4908408-cd7fa79f-cfdd-44c1-8094-18ae2eafdf2b?action=share&creator=4908408)

Postman contains all the requests with the appropriate path params, request body, headers, authorization tokens and example responses pre-filled.

---

## Key Dependencies

- **Express.js**: API framework.
- **Sequelize**: ORM for MySQL.
- **Redis**: Caching layer.
- **Multer**: File upload handling.
- **JWT**: Token-based authentication.

---

## Technical Analysis

- [Technical Analysis page](./technical_analysis.md)

## Notes

- **Attachments**: Uploaded files are stored locally in `./uploads`.
- **Caching**: Redis caches notes for 5 minutes; invalidated on updates/deletes.
- **Concurrency**: Include the `version` field when updating notes to avoid conflicts.
