# 📚 Collabpad Stack — Complete Learning Guide

Welcome! This guide teaches you how to build a real-time collaborative notepad from scratch. By the end, you'll understand full-stack architecture, WebSockets, JWT auth, and modern backend patterns.

---

## 🎯 Project Overview

**Collabpad** is a Google Docs–like collaborative notepad where:
- Users create/edit documents
- Multiple people can edit the same document in **real-time**
- You see other users' **presence** (avatars) and **cursors**
- Owner can **share** via invite links with role-based permissions
- All changes are **persisted to MongoDB**

### Why This Project?
✅ Combines REST API + WebSockets (most real apps need both)  
✅ Authentication (JWT + password hashing)  
✅ Permissions & authorization  
✅ Real-time collaboration patterns  
✅ Database modeling  
✅ Deployable architecture  

---

## 🏗️ Architecture Layers

```
┌─────────────────────────────────────────┐
│        Frontend (Next.js)                │
│  React Components + Context (auth)      │
│  Axios (HTTP calls) + Socket.IO (WS)    │
└────────────┬────────────────────────────┘
             │ HTTP + WebSocket
             ▼
┌─────────────────────────────────────────┐
│       Backend (Express + Socket.IO)     │
│  Routes (REST API) + Sockets (real-time)│
│  JWT Auth Middleware                    │
│  Mongoose Models                        │
└────────────┬────────────────────────────┘
             │ TCP Connection
             ▼
┌─────────────────────────────────────────┐
│    Database (MongoDB)                   │
│  Collections: users, documents, shares  │
└─────────────────────────────────────────┘
```

---

## 🔐 Authentication System

### How JWT Works
1. User submits **email + password**
2. Server hashes password with **bcrypt** and compares
3. If match → Server signs a **JWT token**
4. Client stores token in **localStorage**
5. Client sends token in **Authorization header** for all requests
6. Server **verifies token** on every protected route

### JWT Token Structure
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2N2M4ZDEyMzQ1NmU3ODkwIn0.xyz
 └─ Header ──────────────┘  └─ Payload (userId) ─┘  └─ Signature ─┘
```

### Auth Flow (Step-by-Step)

#### Registration
```
User Input: email, password, name
    ▼
Validate (email required, not duplicate)
    ▼
Hash password with bcrypt (10 rounds)
    ▼
Create user in MongoDB
    ▼
Sign JWT with user ID
    ▼
Return token + user info
    ▼
Client stores token in localStorage
```

#### Login
```
User Input: email, password
    ▼
Find user by email
    ▼
Compare password with bcrypt.compare()
    ▼
If match → sign JWT
If no match → return 401 Unauthorized
    ▼
Return token + user info
```

#### Protected Request
```
Client adds header: Authorization: Bearer <token>
    ▼
Server middleware verifies token
    ▼
If valid → extract userId, call next()
If invalid → return 401
```

### Key Files
- **[server/src/config/jwt.ts](server/src/config/jwt.ts)** — Sign & verify tokens
- **[server/src/middleware/auth.ts](server/src/middleware/auth.ts)** — Express middleware that checks token
- **[client/lib/auth.tsx](client/lib/auth.tsx)** — React context for login/register/logout
- **[client/lib/api.ts](client/lib/api.ts)** — Axios instance that auto-adds token header

---

## 🗄️ Database Models

### User Model
```typescript
{
  _id: ObjectId,
  email: "alice@example.com",           // unique, lowercase
  password: "$2a$10$abc...",            // bcrypt hash
  displayName: "Alice",
  avatarColor: "hsl(220 70% 55%)",     // for presence avatars
  createdAt: Date
}
```

### Document Model
```typescript
{
  _id: ObjectId,
  title: "My Notes",
  content: { blocks: [...] },          // Editor.js JSON format
  ownerId: ObjectId,                   // ref to User (cannot delete)
  collaborators: [
    { userId: ObjectId, role: "editor" },
    { userId: ObjectId, role: "viewer" }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### ShareLink Model
```typescript
{
  _id: ObjectId,
  documentId: ObjectId,
  token: "abc123xyz789...",            // nanoid (24 chars)
  role: "editor" | "viewer",
  createdBy: ObjectId,                 // user who created link
  createdAt: Date
}
```

### Why These Fields?

| Field | Purpose |
|-------|---------|
| `ownerId` | Enforce ownership (only owner can delete) |
| `collaborators` | Track who can access (with role) |
| `role` | Permission: "viewer" = read-only, "editor" = can edit |
| `content` | Editor.js JSON (blocks, inline styles, etc.) |
| `token` | Public-safe short ID for share links |
| `avatarColor` | Don't send user color with each presence update |

---

## 🔌 Socket.IO & Real-Time Collaboration

### Why Socket.IO?
- **REST API** is request-response only (one direction)
- **WebSockets** are bidirectional (server can push to client anytime)
- Socket.IO wraps WebSockets with auto-reconnect, fallbacks, rooms

### Socket.IO Flow

#### 1. Connection & Authentication
```typescript
// Client connects with token
socket = io("http://localhost:4000", {
  auth: { token: localStorage.getItem("collabpad_token") }
})

// Server verifies in middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token
  const { sub } = verifyToken(token)        // throws if invalid
  socket.data.userId = sub                  // attach to socket
  next()                                    // allow connection
})
```

#### 2. Join Document
```
Client: socket.emit("doc:join", { docId })
    ▼
Server checks permissions (owner or collaborator?)
    ▼
Server joins socket to room: docId
    ▼
Server fetches user and builds presence object
    ▼
Server broadcasts: io.to(docId).emit("presence:update", [users])
    ▼
All clients in room get updated presence list
```

#### 3. Real-Time Edit (The Core!)
```
User types in editor (debounced 700ms)
    ▼
Client: socket.emit("doc:change", { docId, content })
    ▼
Server receives, broadcasts to others:
  socket.to(docId).emit("doc:remote-change", { content, from: userId })
    ▼
Server also debounces persistence (800ms):
  - Collects all changes for 800ms
  - Writes latest content to MongoDB
  - This batches rapid changes into one DB write
    ▼
Remote client receives "doc:remote-change"
    ▼
Client merges content into editor (with conflict detection)
```

#### 4. Presence & Cursors
```
Client sends cursor position:
  socket.emit("cursor:update", { docId, range, x, y })

Server broadcasts to others:
  socket.to(docId).emit("cursor:update", { ...cursor data })

Clients render colored cursors for each remote user
```

#### 5. Disconnect
```
User closes tab / connection lost
    ▼
Server receives "disconnect" event
    ▼
Server cleans up presence and cursor maps
    ▼
Server broadcasts: presence:update (without that user)
    ▼
Other clients see user disappear
```

### Key Files
- **[server/src/sockets/doc.ts](server/src/sockets/doc.ts)** — All Socket.IO handlers
- **[client/lib/socket.ts](client/lib/socket.ts)** — Socket initialization with auth

### Debouncing Explained
```
User types: "H" "E" "L" "L" "O"
Without debounce: 5 DB writes
With 800ms debounce:
  H     → schedule save for +800ms
  E     → reschedule for +800ms
  L     → reschedule for +800ms
  L     → reschedule for +800ms
  O     → reschedule for +800ms
  [wait 800ms]
  → SAVE "HELLO" as 1 DB write
Result: efficient batching
```

---

## 🛣️ REST API Routes

### Authentication Routes (`/api/auth`)

#### POST `/api/auth/register`
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{ "email": "bob@example.com", "password": "pass123", "displayName": "Bob" }'

Response:
{
  "token": "eyJhbGc...",
  "user": { "id": "...", "email": "bob@example.com", "displayName": "Bob", "avatarColor": "..." }
}
```

#### POST `/api/auth/login`
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "bob@example.com", "password": "pass123" }'

Response: Same as register
```

#### GET `/api/auth/me`
```bash
curl -X GET http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer eyJhbGc..."

Response:
{ "user": { "id": "...", "email": "bob@example.com", ... } }
```

### Document Routes (`/api/documents`)

#### GET `/api/documents` — List user's docs
```bash
curl -X GET http://localhost:4000/api/documents \
  -H "Authorization: Bearer <token>"

Response:
{
  "documents": [
    { "_id": "...", "title": "Notes", "updatedAt": "2025-01-15T..." }
  ]
}
```

#### POST `/api/documents` — Create new doc
```bash
curl -X POST http://localhost:4000/api/documents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "title": "My Notes" }'

Response:
{ "document": { "_id": "...", "title": "My Notes", "ownerId": "...", ... } }
```

#### GET `/api/documents/:id` — Fetch single doc
```bash
Response:
{
  "document": { "_id": "...", "title": "...", "content": {...}, ... },
  "canEdit": true,           // bool: is user editor or owner?
  "isOwner": true            // bool: is user the owner?
}
```

#### PATCH `/api/documents/:id` — Update title or content
```bash
curl -X PATCH http://localhost:4000/api/documents/<id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Updated Title" }'

Response: updated document
```

#### DELETE `/api/documents/:id` — Delete doc (owner only)
```bash
curl -X DELETE http://localhost:4000/api/documents/<id> \
  -H "Authorization: Bearer <token>"

Response: { "ok": true }
```

### Share Routes (`/api/share`)

#### POST `/api/share/link` — Create invite link
```bash
curl -X POST http://localhost:4000/api/share/link \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "documentId": "...", "role": "editor" }'

Response:
{ "link": "http://localhost:3000/invite/abc123xyz..." }
```

#### POST `/api/share/accept` — Accept invite link
```bash
curl -X POST http://localhost:4000/api/share/accept \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "token": "abc123xyz..." }'

Response: { "documentId": "..." }
```

---

## 🔑 Permission System

### Three Roles
1. **Owner** — Full control
   - Edit title & content
   - Invite people to collaborate
   - Delete document
   - Change permissions
   
2. **Editor** — Edit content only
   - Edit title & content
   - Cannot invite
   - Cannot delete
   
3. **Viewer** — Read-only
   - See content
   - Cannot edit
   - Cannot share

### Permission Checks

#### REST API (Express Middleware)
```typescript
router.patch("/:id", async (req, res) => {
  const doc = await DocModel.findById(req.params.id)
  
  // Check if user can edit (owner OR editor role)
  const canEdit = doc.ownerId.toString() === req.userId ||
                  doc.collaborators.some(c => 
                    c.userId.toString() === req.userId && c.role === "editor"
                  )
  
  if (!canEdit) return res.status(403).json({ error: "Forbidden" })
  
  // ... perform update
})
```

#### Socket.IO (on join)
```typescript
socket.on("doc:join", async ({ docId }) => {
  const doc = await DocModel.findById(docId)
  const isOwner = doc.ownerId.toString() === userId
  const collab = doc.collaborators.find(c => c.userId.toString() === userId)
  
  if (!isOwner && !collab) {
    return socket.emit("doc:error", "Forbidden")
  }
  
  // ... allow join
})
```

---

## 📊 Client-Server Communication Flow

### Complete User Journey

```
┌─ REGISTRATION ────────────────────────────────────────┐
│ 1. User fills form: email, password, name             │
│ 2. Client POST /api/auth/register                     │
│ 3. Server hashes password, creates user in MongoDB    │
│ 4. Server signs JWT, returns token                    │
│ 5. Client stores token + redirects to /dashboard      │
└───────────────────────────────────────────────────────┘

┌─ VIEWING DASHBOARD ───────────────────────────────────┐
│ 1. Page mounts, useAuth() reads token from localStorage
│ 2. Client GET /api/auth/me (with auth header)        │
│ 3. Server verifies token, returns user data          │
│ 4. Client GET /api/documents                         │
│ 5. Server finds all docs where user is owner/collab  │
│ 6. Display list of docs                              │
└───────────────────────────────────────────────────────┘

┌─ OPENING DOCUMENT ────────────────────────────────────┐
│ 1. User clicks doc, navigates to /doc/[id]           │
│ 2. Client GET /api/documents/:id (verify access)     │
│ 3. Load document content into Editor.js              │
│ 4. socket.emit("doc:join", { docId })                │
│ 5. Server verifies permission, adds to room          │
│ 6. Server broadcasts updated presence list           │
│ 7. User sees other users' avatars                    │
└───────────────────────────────────────────────────────┘

┌─ REAL-TIME EDITING ───────────────────────────────────┐
│ 1. User types in editor                              │
│ 2. Editor fires onChange → client debounces (700ms)  │
│ 3. socket.emit("doc:change", { content })            │
│ 4. Server broadcasts to others in room               │
│ 5. Other clients' editors update in real-time        │
│ 6. Server batches saves (800ms debounce) to MongoDB  │
│ 7. Content is persisted                              │
└───────────────────────────────────────────────────────┘

┌─ SHARING DOCUMENT ────────────────────────────────────┐
│ 1. Owner clicks "Share" button                        │
│ 2. Client POST /api/share/link { role: "editor" }    │
│ 3. Server creates ShareLink with nanoid token        │
│ 4. Server returns invite URL                         │
│ 5. Owner copies link and sends to collaborator       │
└───────────────────────────────────────────────────────┘

┌─ ACCEPTING INVITE ────────────────────────────────────┐
│ 1. Recipient visits /invite/[token]                  │
│ 2. Page extracts token from URL                      │
│ 3. Client POST /api/share/accept { token }           │
│ 4. Server finds ShareLink with that token            │
│ 5. Server adds user to doc.collaborators             │
│ 6. Recipient can now edit/view per role              │
│ 7. Redirected to /doc/[id]                           │
└───────────────────────────────────────────────────────┘
```

---

## 🛠️ Developer's Mental Model

### When Building Features, Ask:

1. **Is it real-time?**
   - No → Use REST API (GET, POST, PATCH, DELETE)
   - Yes → Use Socket.IO event emitters

2. **Does it need permission?**
   - Authenticate with JWT (check auth middleware)
   - Check role on access (canEdit, isOwner, etc.)

3. **Does it change state?**
   - Yes → Persist to MongoDB
   - No → Just compute and return

4. **Does other users need to see it?**
   - Yes → Broadcast with socket.to(room).emit()
   - No → Just return to requester

### Example: "Add emoji reaction to doc"

```
Is it real-time? YES → Socket.IO
  socket.on("reaction:add", { docId, emoji, position })

Does it need permission? YES → Check canEdit
  Only editors can react

Does it change state? YES → Save to MongoDB
  Add to reactions array

Do others need to see it? YES → Broadcast
  socket.to(docId).emit("reaction:add", { userId, emoji, position })
```

---

## 🚀 How to Build This From Scratch

### Phase 1: Backend Setup (Server)
1. Create `server/` folder
2. `npm init -y`, install: express, mongoose, bcryptjs, jsonwebtoken, socket.io
3. Setup MongoDB connection
4. Create User, Document, ShareLink models
5. Build auth routes (register, login)
6. Build document CRUD routes
7. Add permission checks to routes
8. Setup Socket.IO server
9. Implement doc:join, doc:change, presence broadcasting
10. Deploy or test locally

### Phase 2: Frontend Setup (Client)
1. `create-next-app` with TypeScript, Tailwind
2. Create AuthProvider context (login, register, logout)
3. Create Auth interceptor (axios auto-adds token)
4. Create Socket.IO client (connect with token)
5. Build Login/Register pages
6. Build Dashboard (list docs)
7. Build Editor page (with Editor.js)
8. Implement Socket.IO doc:join, doc:change
9. Display presence avatars
10. Build Share dialog

### Phase 3: Polish
1. Error handling
2. Loading states
3. Styling
4. Mobile responsive
5. Deployment

---

## 📝 Key Concepts Summary

| Concept | Purpose | Example |
|---------|---------|---------|
| **JWT** | Stateless auth token | Client sends `Authorization: Bearer xyz` |
| **bcrypt** | Password hashing | Never store plain passwords! |
| **Mongoose** | MongoDB ODM | Define schemas, perform queries |
| **Socket.IO** | Real-time bidirectional comms | Broadcast to room: `io.to(room).emit()` |
| **Debounce** | Batch rapid changes | Wait 800ms before DB write |
| **Rooms** | Group socket connections | `socket.join(docId)` → broadcast to room |
| **Middleware** | Function before handler | Verify auth, attach userId |
| **Role-Based Access** | Permission system | owner/editor/viewer |
| **Context** | React state management | Auth context holds user + login/logout |

---

## 🔍 Common Patterns in This Codebase

### Pattern 1: Protected Route
```typescript
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const doc = await DocModel.findById(req.params.id)
  if (!canAccess(doc, req.userId)) return res.status(403).json({ error: "Forbidden" })
  // ... safe to proceed
})
```

### Pattern 2: Broadcast to Room
```typescript
socket.on("doc:change", ({ docId, content }) => {
  // Tell everyone EXCEPT sender
  socket.to(docId).emit("doc:remote-change", { content })
  
  // Debounce persistence
  pendingContent.set(docId, content)
  clearTimeout(saveTimers.get(docId))
  saveTimers.set(docId, setTimeout(() => {
    DocModel.findByIdAndUpdate(docId, { content })
  }, 800))
})
```

### Pattern 3: Axios Auto-Auth
```typescript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("collabpad_token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

### Pattern 4: Context for Auth State
```typescript
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  
  const login = async (email, password) => {
    const { data } = await api.post("/api/auth/login", { email, password })
    localStorage.setItem("collabpad_token", data.token)
    setUser(data.user)
  }
  
  return <AuthCtx.Provider value={{ user, login, ... }}>{children}</AuthCtx.Provider>
}
```

---

## 💡 Architecture Decisions Explained

### Why JWT instead of sessions?
- **Session**: Store user data on server (needs database/memory)
- **JWT**: Encode user data in token, server just validates signature
- **Result**: JWT is stateless, scales to many servers without shared state

### Why Socket.IO instead of HTTP polling?
- **Polling**: Client asks "any updates?" every N seconds (wasteful)
- **WebSocket**: Server pushes updates immediately (efficient)
- **Result**: Real-time feel, lower latency, less bandwidth

### Why debounce persistence?
- User types fast → many changes per second
- Without debounce: 1000 DB writes/second (crashes!)
- With debounce: 1 DB write per 800ms (efficient)
- **Result**: Responsive UI + efficient database

### Why role-based permissions?
- Different users need different access levels
- Store role in database (not just token)
- Verify role on every write operation
- **Result**: Secure, flexible permission system

---

## 📚 Next Steps

1. **Read this guide** and understand each section
2. **Trace through** a user interaction (e.g., registration → open doc → edit → save)
3. **Rebuild from scratch** using this guide as reference (don't copy-paste!)
4. **Test each feature** as you build (auth, docs, real-time, sharing)
5. **Deploy** to Vercel + Render + MongoDB Atlas
6. **Extend** with new features (emoji reactions, document history, comments, etc.)

---

## 🔗 File References

**Backend Files:**
- [server/src/index.ts](server/src/index.ts) — Entry point, Express + Socket.IO setup
- [server/src/config/jwt.ts](server/src/config/jwt.ts) — JWT signing/verification
- [server/src/middleware/auth.ts](server/src/middleware/auth.ts) — requireAuth middleware
- [server/src/models/User.ts](server/src/models/User.ts) — User schema
- [server/src/models/Document.ts](server/src/models/Document.ts) — Document schema
- [server/src/routes/auth.ts](server/src/routes/auth.ts) — Auth endpoints
- [server/src/routes/documents.ts](server/src/routes/documents.ts) — Document CRUD
- [server/src/sockets/doc.ts](server/src/sockets/doc.ts) — Real-time collaboration

**Frontend Files:**
- [client/lib/auth.tsx](client/lib/auth.tsx) — Auth context provider
- [client/lib/api.ts](client/lib/api.ts) — Axios instance with auth
- [client/lib/socket.ts](client/lib/socket.ts) — Socket.IO initialization

Happy building! 🚀
