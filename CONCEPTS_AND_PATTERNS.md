# 🧠 Collabpad — Concepts & Patterns Deep Dive

This guide explains the **why** behind key architectural decisions and teaches you the mental models needed to understand (and extend) Collabpad.

---

## 🔐 Authentication Deep Dive

### The Problem: How Do We Know Who the User Is?

Every request needs to know:
- ✓ Who is making this request?
- ✓ Are they allowed to do this?

**Without authentication:** Anyone can request `/api/documents/alice-secret-doc`

### Solution: JWT (JSON Web Tokens)

#### How traditional sessions work (older way)
```
User: login(email, password)
  ↓
Server: verify password, create SESSION in database
  ↓
Server: return SESSION_ID
  ↓
Client: store SESSION_ID in cookie
  ↓
Future request: cookie is auto-sent with request
  ↓
Server: lookup SESSION_ID in database
  ↓
If found: execute request
```

**Problem:** Requires database lookup on every request. Doesn't scale.

#### How JWT works (modern way)
```
User: login(email, password)
  ↓
Server: verify password
  ↓
Server: create JWT = sign(userID, SECRET_KEY)
  JWT contains: { sub: "user123", exp: 2025-01... }
  ↓
Client: store JWT in localStorage
  ↓
Future request: send header "Authorization: Bearer JWT"
  ↓
Server: verify JWT signature (uses SECRET_KEY)
  ↓
If signature valid: extract userId, execute request
```

**Advantage:** No database lookup needed! JWT is self-contained and cryptographically signed.

### Why This Matters

**JWT with WebSockets:**
- When Socket.IO connection is made, send token in auth
- Server verifies token once (not on every message)
- Attach userId to socket object
- All handlers can access `socket.data.userId`

```typescript
// Socket.IO auth middleware (runs once per connection)
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token
  const { sub } = verifyToken(token)       // Verify signature
  socket.data.userId = sub                 // Extract userId
  next()
})

// Later, in handlers (no auth check needed)
socket.on("doc:change", ({ docId, content }) => {
  const userId = socket.data.userId        // Already verified!
  // ... proceed
})
```

### The Signature: How Do We Know It's Real?

```
JWT = Header.Payload.Signature

Header: { alg: "HS256", typ: "JWT" }
Payload: { sub: "user123", exp: ... }
Signature: HMAC(SECRET, Header.Payload)
```

**Example:**
```
Header = base64({"alg":"HS256"}) = eyJhbGc...
Payload = base64({"sub":"user123"}) = eyJzdWI...
Signature = HMAC-SHA256(SECRET, "eyJhbGc...eyJzdWI...")
           = abc123xyz789...

JWT = "eyJhbGc...eyJzdWI...abc123xyz789..."
```

**Verification:**
```
Received JWT: "eyJhbGc...eyJzdWI...abc123xyz789..."
  ↓
Extract: Header + Payload = "eyJhbGc...eyJzdWI..."
  ↓
Compute: Signature = HMAC-SHA256(SECRET, "eyJhbGc...eyJzdWI...")
  ↓
Compare: computed signature == received signature (abc123xyz789...)
  ↓
If match: JWT is authentic (wasn't tampered with)
If no match: JWT is fake or corrupted
```

**No one can forge your JWT** without knowing your `SECRET`.

### TokenExpiry: Auto-Logout After 30 Days

```typescript
jwt.sign(payload, SECRET, { expiresIn: "30d" })
```

**Payload includes:**
```
{
  sub: "user123",
  iat: 1697846400,      // issued at (timestamp)
  exp: 1705622400       // expiration (timestamp) = iat + 30 days
}
```

**On verify:**
```typescript
jwt.verify(token, SECRET)
  ↓
Check: current_time < token.exp ?
  ↓
If yes: token valid
If no: throw error (token expired), client redirects to login
```

---

## 🔑 Permissions & Authorization Deep Dive

### The Question Every Handler Must Ask

```
Handler receives request from userId

For operation X on resource Y:
  1. Does user have access to Y?
  2. Does user have permission to do X?
```

### Example: Updating a Document

```typescript
router.patch("/documents/:id", requireAuth, async (req, res) => {
  const userId = req.userId              // From JWT
  const docId = req.params.id
  
  // Step 1: Fetch resource
  const doc = await DocModel.findById(docId)
  if (!doc) return 403 "Not found"
  
  // Step 2: Check access
  const isOwner = doc.ownerId.toString() === userId
  const isEditor = doc.collaborators.some(
    c => c.userId.toString() === userId && c.role === "editor"
  )
  
  if (!isOwner && !isEditor) {
    return 403 "Forbidden"
  }
  
  // Step 3: Execute
  doc.title = req.body.title
  await doc.save()
})
```

**Decision tree:**
```
User wants to PATCH /documents/<id>
  ↓
Is user owner?
  YES → allow
  NO → Is user an editor collaborator?
        YES → allow
        NO → reject with 403
```

### Three Roles, Clear Permissions

```
┌─────────────────────────────────────────┐
│ Owner (created the document)            │
├─────────────────────────────────────────┤
│ ✓ Edit title & content                  │
│ ✓ View all history                      │
│ ✓ Delete document                       │
│ ✓ Invite people (create share links)    │
│ ✓ Change permissions                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Editor (invited with edit permission)   │
├─────────────────────────────────────────┤
│ ✓ Edit title & content                  │
│ ✓ See document                          │
│ ✗ Cannot delete                         │
│ ✗ Cannot invite others                  │
│ ✗ Cannot change permissions             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Viewer (invited with view permission)   │
├─────────────────────────────────────────┤
│ ✓ See document                          │
│ ✓ See changes in real-time              │
│ ✗ Cannot edit                           │
│ ✗ Cannot invite                         │
└─────────────────────────────────────────┘
```

### Enforce at Every Layer

**REST API Layer:**
```typescript
const canEdit = (doc, userId) => 
  doc.ownerId.toString() === userId ||
  doc.collaborators.some(c => 
    c.userId.toString() === userId && c.role === "editor"
  )

router.patch("/:id", (req) => {
  if (!canEdit(doc, userId)) return 403
  // ... proceed
})
```

**Socket.IO Layer:**
```typescript
socket.on("doc:join", async ({ docId }) => {
  const doc = await DocModel.findById(docId)
  if (!isMemberOrOwner(doc, userId)) {
    return socket.emit("error", "Forbidden")
  }
  // ... proceed
})
```

**Why:** Never trust the client. Always verify on server.

---

## 🔄 Real-Time Synchronization Deep Dive

### The Problem: Multiple Users, One Document

```
Timeline:
┌─────────────────────────────────────────┐
│ Time │ Alice         │ Bob               │
├─────────────────────────────────────────┤
│ 0s   │ "Hello"       │ (sees "")         │
│ 1s   │ "Hello W"     │ (types "Hi Bob")  │
│ 2s   │ "Hello World" │ "Hi Bob"          │
│ 3s   │ ?             │ ?                 │
└─────────────────────────────────────────┘

Who's right? What's the final content?
```

### Naive Approach (Breaks!)

```
Alice: emit("doc:change", "Hello World")
  ↓ (2s delay)
Server saves: "Hello World"
  ↓
Bob doesn't see "Hello World" instantly (waiting on save)

Meanwhile:
Bob: emit("doc:change", "Hi Bob")
  ↓ (2s delay)
Server receives, overwrites with "Hi Bob"

Result: "Hello World" is lost!
```

### Collabpad's Approach: Broadcast-First, Persist-Later

```
Alice types "Hello"
  ↓
Alice: socket.emit("doc:change", { docId, content: "Hello" })
  ↓
Server receives
  ↓
Server: socket.to(docId).emit("doc:remote-change", "Hello")
  ↓ (0.1s, fast!)
Bob sees "Hello" in real-time
  ↓
Server: [debounce] wait 800ms for more changes
  ↓ (800ms later, if no more changes)
Server: save to MongoDB
  ↓ (if Alice types "World" in meanwhile)
Server reschedules debounce timer
  ↓ (800ms after last change)
Server: save "Hello World" to MongoDB
```

**Key insight:** Network is fast, database is slow. Broadcast immediately, persist later.

### Debouncing Explained

```
Without debounce:
User types: A  B  C  D  E
Each triggers: save, save, save, save, save (5 DB writes)
Overhead: database gets hammered

With 800ms debounce:
User types: A
  └─ Schedule save for +800ms
User types: B
  └─ Cancel previous timer, reschedule for +800ms
User types: C
  └─ Cancel previous timer, reschedule for +800ms
...
User stops typing
  └─ [wait 800ms]
  └─ Save "ABCDE" (1 DB write)

Benefit: Batches rapid changes into one save
Cost: 800ms delay before persistence (acceptable)
```

### Conflict Resolution: "Last Write Wins"

```
Scenario:
┌─────────────────────────────────────────┐
│ Time │ Alice          │ Bob               │
├─────────────────────────────────────────┤
│ 0s   │ "Hello"        │ "Hello"           │
│ 1s   │ "Hello Alice"  │ "Hello Bob"       │
│ 1.1s │ emit change    │ emit change       │
│ 2s   │ Server receives "Hello Alice"     │
│ 2.1s │ Server receives "Hello Bob"       │
└─────────────────────────────────────────┘

Who wins? Bob! (last to emit)
```

**This works in practice because:**
- People usually edit different parts of document
- Conflicts are rare
- When they happen, latest edit is usually what both want

**Better solutions:**
- **CRDT** (Yjs, Automerge): automatic conflict resolution
- **Operational Transform (OT)**: complex but precise
- Each is overkill for Collabpad's simple use case

---

## 🌐 WebSocket vs REST API Deep Dive

### What's the Difference?

#### REST API (HTTP Requests)
```
Client                        Server
  │
  ├─ Request ────────────────>
  │  (GET /api/documents)
  │
  │                           Process
  │
  │<──── Response ────────────┤
  │      (200, [...])
  │
  (connection closes)
```

**Characteristics:**
- Request-response only
- One direction at a time
- Connection closes after response
- Client initiates everything

#### WebSocket
```
Client                        Server
  │
  ├─ Upgrade to WebSocket ──>
  │
  ├────── Connection open ────┤
  │
  ├─ send(msg1) ───────────>
  │
  │<─────── broadcast ────────┤
  │
  │<─────── broadcast ────────┤
  │
  ├─ send(msg2) ───────────>
  │
  (connection stays open)
```

**Characteristics:**
- Bidirectional
- Both sides can send anytime
- Connection persists
- Server can push to client

### When to Use Each?

#### Use REST API When:
- ✓ Fetching data (GET)
- ✓ One-time operations (POST, PATCH, DELETE)
- ✓ No need for real-time updates
- ✓ Simple stateless requests

**Example:**
```
User clicks "Create new document"
  ↓
Client: POST /api/documents { title: "New" }
  ↓
Server: creates in DB, returns document
  ↓
Client: redirects to /doc/[id]
```

#### Use WebSocket When:
- ✓ Multiple users doing things simultaneously
- ✓ Everyone needs to see updates instantly
- ✓ Server needs to push data to client
- ✓ Persistent connection makes sense

**Example:**
```
User 1 types in document
  ↓
socket.emit("doc:change", content)
  ↓
Server broadcasts to room
  ↓
User 2's editor updates (0.1s)
  ↓
All users see realtime updates
```

### Socket.IO Rooms: Broadcasting to Groups

```typescript
// User 1 joins document "doc-123"
socket.join("doc-123")

// User 2 joins same document
socket.join("doc-123")

// Now both sockets are in room "doc-123"

// Server broadcasts to everyone in room:
io.to("doc-123").emit("presence:update", users)

// Output: both User 1 and User 2 receive message
```

**Why rooms?**
```
Without rooms:
io.emit("presence:update", users)
→ broadcasts to ALL connected users (1000+)
→ inefficient, everyone gets irrelevant updates

With rooms:
io.to("doc-123").emit("presence:update", users)
→ broadcasts only to doc-123 room (~2 users)
→ efficient, only relevant people get update
```

---

## 🛢️ Database Patterns Deep Dive

### Mongoose: MongoDB ODM (Object Document Mapper)

**Why not just use MongoDB driver directly?**

```typescript
// MongoDB driver (low-level)
db.collection("users").insertOne({
  email: "...",
  password: "...",
  // What's the structure? Who knows!
})

// Mongoose (high-level, with schema)
const UserSchema = new Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  // Structure is explicit and validated!
})

const user = await User.create({ email, password })
// User object has type info, methods, middleware
```

**Benefits:**
- Schema validation (email must be string)
- Type safety
- Hooks (middleware: pre/post save)
- Methods on documents
- Relationships/population

### References vs Embedding

#### Option 1: Embed (Denormalization)
```typescript
// Document with embedded user objects
{
  _id: "doc-123",
  title: "Notes",
  ownerId: "user-1",
  content: "...",
  collaborators: [
    {
      _id: "user-2",
      displayName: "Bob",
      email: "bob@example.com",  // DUPLICATED!
      avatarColor: "..."         // DUPLICATED!
    }
  ]
}
```

**Problem:** If Bob changes his display name, must update it in every document where he's a collaborator.

#### Option 2: Reference (Normalization)
```typescript
// Document with references
{
  _id: "doc-123",
  title: "Notes",
  ownerId: "user-1",
  content: "...",
  collaborators: [
    { userId: "user-2", role: "editor" }  // Just reference ID
  ]
}

// When fetching, populate:
await DocModel.findById("doc-123").populate("collaborators.userId")
// Now Bob's full user data is fetched
```

**Advantage:** Single source of truth. Update Bob's data once.

**Collabpad uses references for:** `ownerId`, `collaborators.userId`, `shareLink.createdBy`

**Collabpad embeds:** `displayName`, `avatarColor` in presence list (rarely changes, use case specific)

### Indexes: Query Performance

```typescript
UserSchema.index({ email: 1 })
// Makes queries like:
//   User.findOne({ email: "alice@example.com" })
// Much faster (O(log n) instead of O(n))
```

```typescript
DocSchema.index({ ownerId: 1 })
// Makes queries like:
//   DocModel.find({ ownerId: userId })
// Fast, even with millions of documents
```

---

## 🎯 Client-Server Communication Flow

### Complete Journey of an Edit

```
FRONTEND                SERVER               DATABASE
   │
   │ User types "Hello"
   │
   ├─ Debounce 700ms ──>
   │  (waits, collecting keystrokes)
   │
   │ User types "World"
   │
   ├─ Reschedule debounce
   │  (wait another 700ms)
   │
   │ [700ms of silence]
   │
   ├─ socket.emit("doc:change", {
   │    docId: "doc-123",
   │    content: "Hello World"
   │  })
   │
   │                    Receive event
   │                        │
   │                    ├─ Verify auth ✓
   │                    │
   │                    ├─ socket.to(docId).emit()
   │                    │
   │<─── receive ─────────┤
   │                      │
   │ Update editor locally (merge)
   │                      │
   │ Display to user      │
   │                      ├─ Queue for persistence
   │                      │
   │                      ├─ [Debounce 800ms]
   │                      │
   │                      ├─ No new changes?
   │                      │
   │                      ├─ DocModel.findByIdAndUpdate() ──────> MongoDB
   │                      │                                        │
   │                      │                                    Save to disk
   │                      │                                        │
   │                      │<─── Confirmation ──────────────────
   │                      │
   │                    log("Saved!")
```

### Why Two Debounces?

**Client debounce (700ms):**
- Collect keystrokes
- Don't spam network
- Send once per 700ms of typing

**Server debounce (800ms):**
- Collect incoming changes from multiple users
- Don't spam database
- Batch all changes into one DB write

**Result:** Responsive UI + efficient database usage

---

## 🔍 Error Handling Patterns

### HTTP Status Codes

```typescript
200 OK
  └─ Request succeeded, here's your data

201 Created
  └─ POST created new resource

400 Bad Request
  └─ Client error (invalid input)

401 Unauthorized
  └─ Not authenticated (no valid JWT)

403 Forbidden
  └─ Authenticated but not authorized (no permission)

404 Not Found
  └─ Resource doesn't exist

500 Internal Server Error
  └─ Server bug/crash
```

**Collabpad usage:**
```typescript
if (!doc) return res.status(404).json({ error: "Not found" })
if (!canEdit(doc, userId)) return res.status(403).json({ error: "Forbidden" })
if (!email) return res.status(400).json({ error: "Email required" })
if (invalid token) return res.status(401).json({ error: "Unauthorized" })
```

### Socket.IO Error Handling

```typescript
socket.on("doc:join", async ({ docId }) => {
  try {
    const doc = await DocModel.findById(docId)
    if (!doc) throw new Error("Not found")
    if (!hasAccess) throw new Error("Forbidden")
    
    // Proceed
  } catch (err) {
    socket.emit("doc:error", err.message)
  }
})
```

---

## 🚀 Performance Optimization

### Why Debounce Specifically 700ms and 800ms?

```
700ms client debounce:
  - Fast enough to feel real-time
  - Slow enough to batch rapid keystrokes
  - User won't notice the delay

800ms server debounce:
  - Slightly longer than client
  - Ensures all changes are collected
  - Batches multiple client sends
  - Doesn't overwhelm database
```

### Database Connection Pooling

```typescript
mongoose.connect(MONGO_URI)
// Automatically manages connection pool
// Reuses connections instead of creating new ones
// Improves throughput
```

### Selecting Only Needed Fields

```typescript
// Fetch ALL fields (wasteful)
await DocModel.findById(docId)

// Fetch only needed fields (efficient)
await DocModel.findById(docId).select("title ownerId updatedAt")
```

### Limiting Query Results

```typescript
// Without limit (fetch thousands)
await DocModel.find({ ownerId })

// With sort and reasonable limit
await DocModel.find({ ownerId })
  .sort({ updatedAt: -1 })
  .limit(50)
  .select("title updatedAt")
```

---

## 🧩 Extending Collabpad

### "How do I add emoji reactions?"

Using the mental models from this guide:

```
1. Is it real-time? YES
   → Use Socket.IO
   
2. Does it need permission? MAYBE
   → Only editors can add reactions
   
3. Does it change state? YES
   → Save reactions array to document
   
4. Does others need to see? YES
   → Broadcast to room

Implementation:
```typescript
// 1. Add reactions field to Document model
reactions: [
  { userId, emoji, position, timestamp }
]

// 2. Add permission check
socket.on("reaction:add", async ({ docId, emoji, position }) => {
  const doc = await DocModel.findById(docId)
  if (!canEdit(doc, userId)) return socket.emit("error", "Forbidden")
  
  // 3. Save to database
  doc.reactions.push({ userId, emoji, position, timestamp: new Date() })
  await doc.save()
  
  // 4. Broadcast to room
  socket.to(docId).emit("reaction:added", { userId, emoji, position })
})
```

---

## 📚 Summary: Mental Models

| Concept | Mental Model |
|---------|--------------|
| **JWT** | "Digital signature on ID card - no server lookup needed" |
| **Debounce** | "Wait for silence, then act" |
| **Socket Rooms** | "Broadcast only to the people in this conversation" |
| **Permissions** | "Ask these three questions before proceeding" |
| **Conflict Resolution** | "Last one wins (simple but works)" |
| **REST vs WebSocket** | "One-off questions vs ongoing conversation" |
| **Mongoose Schema** | "Contract between server and database" |

---

## 🎓 Recommended Learning Path

1. **Start here:** Read this guide (current)
2. **Understand structure:** [LEARNING_GUIDE.md](LEARNING_GUIDE.md)
3. **Build it:** [BUILD_FROM_SCRATCH.md](BUILD_FROM_SCRATCH.md)
4. **Extend features:**
   - Add comments
   - Add document history
   - Add notifications
   - Add permissions UI
5. **Deploy and scale**

Happy learning! 🚀
