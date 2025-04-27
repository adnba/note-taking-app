# Note Taking API

## **Technical Analysis**

### **1. Authentication & Session Management**

**Key Decisions**:

- **JWT for Stateless Authentication**:  
  Instead of server-side sessions, JWTs are used for scalability. Access tokens (1-day expiry) authenticate users, while refresh tokens (15-day expiry) allow silent re-authentication.

  ```javascript
  // tokens.js
  exports.generateAccessToken = userId => jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1d' })

  exports.generateRefreshToken = () => jwt.sign({}, process.env.JWT_REFRESH_SECRET, { expiresIn: '15d' })
  ```

  **Why?** JWTs reduce database hits for session validation but require careful token revocation (handled via refresh tokens).

- **Refresh Token Rotation**:  
  Refresh tokens are stored in the database and invalidated after each use to prevent reuse if stolen:

  ```javascript
  // auth.js (refreshToken endpoint)
  await storedToken.destroy({ transaction })
  const newRefreshToken = generateRefreshToken()
  await RefreshToken.create({ token: newRefreshToken, UserId: user.id }, { transaction })
  ```

  **Why?** This follows OAuth2 best practices to mitigate token leakage risks.

- **Password Security**:  
  Passwords are hashed with `bcryptjs` (salt rounds = 10) instead of raw storage:
  ```javascript
  // auth.js (signup)
  const salt = await bcrypt.genSalt(10)
  const hash = await bcrypt.hash(password, salt)
  ```
  **Trade-off**: `bcrypt` is slower than `SHA-256` but intentionally delays brute-force attacks.

---

### **2. Note Versioning & History**

**Key Decisions**:

- **Separate `NoteVersion` Table**:  
  Each edit creates a new `NoteVersion` entry linked to the original note via `NoteId`:

  ```javascript
  // NoteVersion.js (model)
  class NoteVersion extends Model {}
  NoteVersion.init(
    {
      title: DataTypes.STRING,
      content: DataTypes.TEXT,
      version: DataTypes.INTEGER
    },
    { sequelize, paranoid: true }
  )
  ```

  **Why?** Storing versions in a separate table avoids bloating the main `notes` table.

- **Automatic Version Increment**:  
  After creating a new version, the main note’s `version` field is updated via a Sequelize hook:

  ```javascript
  // models/index.js (NoteVersion.afterCreate)
  NoteVersion.afterCreate(async (noteVersion, options) => {
    const note = await Note.findByPk(noteVersion.NoteId, { transaction })
    await note.update({ title: noteVersion.title, content: noteVersion.content })
  })
  ```

  **Trade-off**: This ensures consistency but adds a slight delay during updates.

- **Soft Deletion**:  
  Both `Note` and `NoteVersion` use `paranoid: true` to retain data:
  ```javascript
  // Note.js (model)
  class Note extends Model {}
  Note.init({ ... }, { paranoid: true });
  ```
  **Why?** Avoids permanent data loss and allows audit trails.

---

### **3. Concurrency Control (Optimistic Locking)**

**Key Decisions**:

- **Client-Supplied Version**:  
  Clients must send the current `version` when updating a note. If mismatched, the API rejects the request:

  ```javascript
  // notes.js (PUT /notes/:id)
  if (note.version !== version) {
    await transaction.rollback()
    return res.status(409).send({ error: 'Conflict: Note was modified' })
  }
  ```

  **Why?** Prevents overwriting concurrent edits without database-level locks.

- **Row Locking in Transactions**:  
  Uses `LOCK.UPDATE` to lock the note row during updates:
  ```javascript
  const note = await Note.findOne({ where: { id }, lock: transaction.LOCK.UPDATE })
  ```
  **Trade-off**: Ensures atomicity but slightly increases transaction time.

---

### **4. Redis Caching Strategy**

**Key Decisions**:

- **Cached Endpoints**:  
  `GET /notes` (user’s notes) and `GET /notes/:id` (single note) are cached:

  ```javascript
  // redis.js
  exports.getNotes = async userId => get(`user:${userId}:notes`)
  exports.setNotes = async (userId, notes) => set(`user:${userId}:notes`, notes, 300)
  ```

  **Why?** These are high-frequency read endpoints.

- **Cache Invalidation**:  
  Manual invalidation on note creation/update/deletion:
  ```javascript
  // After note update in notes.js
  await redisClient.delNotes(userId)
  await redisClient.delNote(id)
  ```
  **Trade-off**: Manual control avoids stale data but requires careful cleanup.

---

### **5. File Attachments**

**Key Decisions**:

- **Local Storage with Multer**:  
  Files are stored in `./uploads` with randomized filenames:

  ```javascript
  // upload.js (Multer config)
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`)
  }
  ```

  **Why?** Simple for development but not production-ready (no redundancy).

- **Attachment Cleanup**:  
  Deleting a note also deletes its attachments via Sequelize hooks:
  ```javascript
  // models/index.js (associations)
  Note.hasMany(Attachment, { onDelete: 'CASCADE' })
  ```
  **Trade-off**: Cascading deletes simplify cleanup but risk data loss if misconfigured.

---

### **6. Error Handling & Validation**

**Key Decisions**:

- **Centralized Error Middleware**:  
  Catches all unhandled errors and returns standardized responses:

  ```javascript
  // index.js (global error handler)
  app.use((err, _req, res, _next) => {
    console.error('Internal error:', err.stack)
    res.status(500).send({ error: 'Internal server error' })
  })
  ```

  **Why?** Simplifies debugging and ensures no sensitive data leaks.

- **Request Validation Middleware**:  
  `checkToken`, `checkId`, and `checkIds` validate requests early:
  ```javascript
  // checkId.js
  if (!id || !Number.isInteger(Number(id)) || Number(id) < 1) {
    return res.status(400).send({ error: 'Invalid ID' })
  }
  ```
  **Why?** Fails fast to avoid unnecessary database operations.

---

### **7. Trade-offs & Lessons Learned**

1. **Local File Storage**:
   - _Pros_: Easy to implement.
   - _Cons_: Not scalable; cloud storage (e.g., S3) would be better for production and not stateless.
2. **Optimistic Locking**:
   - _Pros_: Lightweight.
   - _Cons_: Requires client cooperation (supplying `version`).
3. **Redis Cache Keys**:
   - _Pros_: Simple key structure (`user:${userId}:notes`).
   - _Cons_: No automatic expiration for rarely updated data.

---

### **8. Not-done Extra task**

1. **Note Sharing**:  
   Add a `NotePermission` model with `userId` and `permission` (read/edit) fields, it could be done by a junction table `NotePermissions` to store each user_note_permission combination to be configured through an endpoint to add and revoke permission with priviledge to the owner to delete the note.
2. **Rate Limiting**:  
   Use `express-rate-limit` on `/auth` endpoints to block brute-force attacks.
3. **Request body validation**:  
   Proper request body validation is not done yet, it can be manually done or through a tool such as Zod or Joi.
