# 🔨 Building Collabpad From Scratch — Step-by-Step

This guide walks you through rebuilding the entire project from scratch, with detailed explanations and code snippets at each step.

---

## ⚡ Quick Start (Skip to Phase if you know basics)

```bash
# Phase 1: Backend
mkdir collab-pad && cd collab-pad
mkdir server && cd server
npm init -y
npm install express mongoose bcryptjs jsonwebtoken socket.io cors dotenv
npm install -D typescript tsx @types/node @types/express @types/bcryptjs @types/jsonwebtoken

# Phase 2: Frontend
cd ..
npx create-next-app@latest client --typescript --tailwind --app
cd client
npm install socket.io-client axios

# Phase 3: Database
docker run -d -p 27017:27017 --name mongodb mongo:7
```

---

## 🔴 PHASE 1: BACKEND SETUP

### Step 1.1: Initialize Project

```bash
cd server
npm init -y
```

**What this does:** Creates `package.json`

### Step 1.2: Install Dependencies

```bash
npm install \
  express \
  mongoose \
  bcryptjs \
  jsonwebtoken \
  socket.io \
  cors \
  dotenv

npm install -D \
  typescript \
  tsx \
  @types/node \
  @types/express \
  @types/bcryptjs \
  @types/jsonwebtoken
```

**Why each package:**
- **express:** HTTP server framework
- **mongoose:** MongoDB object modeling (schemas, queries)
- **bcryptjs:** Password hashing (never store plain passwords!)
- **jsonwebtoken:** JWT sign/verify
- **socket.io:** Real-time WebSocket server
- **cors:** Allow cross-origin requests from frontend
- **dotenv:** Load environment variables from .env
- **tsx:** Run TypeScript directly (no build step needed)
- **typescript & @types/*:** Type safety

### Step 1.3: Create TypeScript Config

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Step 1.4: Create .env File

**.env:**
```
PORT=4000
MONGO_URI=mongodb://localhost:27017/collabpad
JWT_SECRET=your-super-secret-key-change-in-production
CLIENT_ORIGIN=http://localhost:3000
```

### Step 1.5: Update package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Why:**
- `dev`: Watch mode (auto-restart on file changes) for development
- `build`: Compile TypeScript to JavaScript
- `start`: Run compiled code in production

---

## 🟡 PHASE 2: DATABASE MODELS

### Step 2.1: Create User Model

**src/models/User.ts:**
```typescript
import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  password: string;
  displayName: string;
  avatarColor: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true },
  displayName: { type: String, required: true },
  avatarColor: { type: String, default: "hsl(220 70% 55%)" },
  createdAt: { type: Date, default: Date.now },
});

export const User = model<IUser>("User", UserSchema);
```

**What it does:**
- Defines user document structure
- Ensures email is unique (no duplicate accounts)
- Stores hashed password (not plain text!)
- Stores display name and avatar color (for presence)

### Step 2.2: Create Document Model

**src/models/Document.ts:**
```typescript
import { Schema, model, Document, Types } from "mongoose";

export interface ICollaborator {
  userId: Types.ObjectId;
  role: "viewer" | "editor";
}

export interface IDoc extends Document {
  title: string;
  content: any; // Editor.js JSON
  ownerId: Types.ObjectId;
  collaborators: ICollaborator[];
  createdAt: Date;
  updatedAt: Date;
}

const DocSchema = new Schema<IDoc>(
  {
    title: { type: String, default: "Untitled" },
    content: { type: Schema.Types.Mixed, default: { blocks: [] } },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    collaborators: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["viewer", "editor"], default: "viewer" },
      },
    ],
  },
  { timestamps: true }
);

export const DocModel = model<IDoc>("Document", DocSchema);
```

**What it does:**
- `title`: Document name
- `content`: Rich text (Editor.js format: `{ blocks: [{type, data}, ...] }`)
- `ownerId`: Who created it (has all permissions)
- `collaborators`: Array of shared users + their role
- `timestamps`: Auto-track createdAt and updatedAt

### Step 2.3: Create ShareLink Model

**src/models/ShareLink.ts:**
```typescript
import { Schema, model, Document, Types } from "mongoose";
import { nanoid } from "nanoid";

export interface IShareLink extends Document {
  documentId: Types.ObjectId;
  token: string;
  role: "viewer" | "editor";
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const ShareLinkSchema = new Schema<IShareLink>({
  documentId: {
    type: Schema.Types.ObjectId,
    ref: "Document",
    required: true,
    index: true,
  },
  token: { type: String, default: () => nanoid(24), unique: true },
  role: { type: String, enum: ["viewer", "editor"], default: "viewer" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

export const ShareLink = model<IShareLink>("ShareLink", ShareLinkSchema);
```

**What it does:**
- `token`: Short unique ID (nanoid) for the invite link
- `role`: What permission the invited user gets
- Example link: `http://localhost:3000/invite/abc123xyz789`

---

## 🟢 PHASE 3: AUTHENTICATION

### Step 3.1: JWT Config

**src/config/jwt.ts:**
```typescript
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-secret";

export const signToken = (payload: object): string =>
  jwt.sign(payload, SECRET, { expiresIn: "30d" });

export const verifyToken = <T = any>(token: string): T =>
  jwt.verify(token, SECRET) as T;
```

**What it does:**
- `signToken`: Create JWT (encodes user ID inside)
- `verifyToken`: Check JWT is valid and extract payload
- Tokens expire after 30 days

**How JWT works:**
```
signToken({ sub: "user123" })
  ↓
jwt.sign(..., SECRET, { expiresIn: "30d" })
  ↓
"eyJhbGci..." (token)
  ↓
[Client stores in localStorage]
  ↓
verifyToken("eyJhbGci...")
  ↓
jwt.verify(..., SECRET) ← only works if using same SECRET
  ↓
{ sub: "user123" }
```

### Step 3.2: Auth Middleware

**src/middleware/auth.ts:**
```typescript
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../config/jwt";

export interface AuthRequest extends Request {
  userId?: string;
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;
  
  // Check "Authorization: Bearer <token>" format
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Extract token after "Bearer "
    const token = header.slice(7);
    
    // Verify token and extract user ID
    const { sub } = verifyToken<{ sub: string }>(token);
    
    // Attach userId to request object
    req.userId = sub;
    
    // Allow request to proceed
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};
```

**What it does:**
```
Request comes in with header: "Authorization: Bearer abc123..."
  ↓
Middleware extracts "abc123..."
  ↓
Calls verifyToken("abc123...")
  ↓
If valid: extract userId, store in req.userId, call next()
If invalid: return 401 error
```

**Usage in routes:**
```typescript
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  // req.userId is now available (set by middleware)
  // execute handler
})
```

### Step 3.3: Auth Routes

**src/routes/auth.ts:**
```typescript
import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { signToken } from "../config/jwt";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

const colors = [
  "hsl(220 70% 55%)",
  "hsl(340 75% 55%)",
  "hsl(150 60% 45%)",
  "hsl(35 85% 55%)",
  "hsl(265 70% 60%)",
  "hsl(190 70% 50%)",
];

// ===== REGISTER =====
router.post("/register", async (req, res) => {
  const { email, password, displayName } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  // Check if email already exists
  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  // Hash password with bcrypt (10 rounds = strong)
  const hash = await bcrypt.hash(password, 10);

  // Create user in database
  const user = await User.create({
    email,
    password: hash, // Store hash, never plain text!
    displayName: displayName || email.split("@")[0], // fallback to email prefix
    avatarColor: colors[Math.floor(Math.random() * colors.length)],
  });

  // Sign JWT with user ID
  const token = signToken({ sub: user.id });

  // Return token + user info (WITHOUT password!)
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
    },
  });
});

// ===== LOGIN =====
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Compare provided password with stored hash
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Sign JWT
  const token = signToken({ sub: user.id });

  // Return token + user info
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
    },
  });
});

// ===== GET CURRENT USER =====
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId).select("-password");
  res.json({ user });
});

export default router;
```

**What each endpoint does:**

| Endpoint | Input | Output | Purpose |
|----------|-------|--------|---------|
| POST /register | email, password, displayName | token, user | Create new account |
| POST /login | email, password | token, user | Authenticate existing user |
| GET /me | (auth header) | user | Get current user info |

**Password Security:**
```
Plain password "mypassword123"
  ↓
bcrypt.hash(password, 10) ← 10 rounds (strong)
  ↓
"$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS..." ← hash
  ↓
Stored in database
  ↓
Later: bcrypt.compare("mypassword123", hash)
  ↓
true/false ← correct or not
```

---

## 🔵 PHASE 4: REST API ROUTES

### Step 4.1: Document Routes

**src/routes/documents.ts:**
```typescript
import { Router } from "express";
import { Types } from "mongoose";
import { DocModel } from "../models/Document";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// All routes need auth
router.use(requireAuth);

// Helper functions for permissions
const canAccess = (doc: any, userId: string) =>
  doc.ownerId.toString() === userId ||
  doc.collaborators.some((c: any) => c.userId.toString() === userId);

const canEdit = (doc: any, userId: string) =>
  doc.ownerId.toString() === userId ||
  doc.collaborators.some(
    (c: any) => c.userId.toString() === userId && c.role === "editor"
  );

// ===== LIST USER'S DOCUMENTS =====
router.get("/", async (req: AuthRequest, res) => {
  const uid = new Types.ObjectId(req.userId);
  
  // Find all docs where user is owner OR collaborator
  const docs = await DocModel.find({
    $or: [{ ownerId: uid }, { "collaborators.userId": uid }],
  })
    .sort({ updatedAt: -1 })
    .select("title ownerId updatedAt createdAt");

  res.json({ documents: docs });
});

// ===== CREATE NEW DOCUMENT =====
router.post("/", async (req: AuthRequest, res) => {
  const doc = await DocModel.create({
    title: req.body.title || "Untitled",
    content: { blocks: [] }, // Empty Editor.js content
    ownerId: req.userId,
  });

  res.json({ document: doc });
});

// ===== GET SINGLE DOCUMENT =====
router.get("/:id", async (req: AuthRequest, res) => {
  const doc = await DocModel.findById(req.params.id);

  if (!doc) {
    return res.status(404).json({ error: "Not found" });
  }

  // Check permission
  if (!canAccess(doc, req.userId!)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.json({
    document: doc,
    canEdit: canEdit(doc, req.userId!),
    isOwner: doc.ownerId.toString() === req.userId,
  });
});

// ===== UPDATE DOCUMENT =====
router.patch("/:id", async (req: AuthRequest, res) => {
  const doc = await DocModel.findById(req.params.id);

  if (!doc) {
    return res.status(404).json({ error: "Not found" });
  }

  // Check permission (only editor or owner can edit)
  if (!canEdit(doc, req.userId!)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Update title if provided
  if (typeof req.body.title === "string") {
    doc.title = req.body.title;
  }

  // Update content if provided
  if (req.body.content) {
    doc.content = req.body.content;
  }

  await doc.save();
  res.json({ document: doc });
});

// ===== DELETE DOCUMENT =====
router.delete("/:id", async (req: AuthRequest, res) => {
  const doc = await DocModel.findById(req.params.id);

  if (!doc) {
    return res.status(404).json({ error: "Not found" });
  }

  // Only owner can delete
  if (doc.ownerId.toString() !== req.userId) {
    return res.status(403).json({ error: "Owner only" });
  }

  await doc.deleteOne();
  res.json({ ok: true });
});

export default router;
```

**Permission Logic:**
```
canAccess: Can user see this doc?
  ✓ User is owner
  ✓ User is in collaborators (any role)

canEdit: Can user edit this doc?
  ✓ User is owner
  ✓ User is collaborator with role "editor"
  ✗ User is collaborator with role "viewer"
```

### Step 4.2: Share Routes

**src/routes/share.ts:**
```typescript
import { Router } from "express";
import { DocModel } from "../models/Document";
import { ShareLink } from "../models/ShareLink";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// ===== CREATE INVITE LINK =====
router.post("/link", async (req: AuthRequest, res) => {
  const { documentId, role } = req.body;

  // Verify document exists and user is owner
  const doc = await DocModel.findById(documentId);
  if (!doc) {
    return res.status(404).json({ error: "Document not found" });
  }

  if (doc.ownerId.toString() !== req.userId) {
    return res.status(403).json({ error: "Only owner can share" });
  }

  // Create share link
  const shareLink = await ShareLink.create({
    documentId,
    role: role || "viewer",
    createdBy: req.userId,
  });

  // Return invite URL
  const inviteUrl = `${process.env.CLIENT_ORIGIN}/invite/${shareLink.token}`;
  res.json({ link: inviteUrl });
});

// ===== ACCEPT INVITE LINK =====
router.post("/accept", async (req: AuthRequest, res) => {
  const { token } = req.body;

  // Find share link
  const shareLink = await ShareLink.findOne({ token });
  if (!shareLink) {
    return res.status(404).json({ error: "Link not found or expired" });
  }

  // Get document
  const doc = await DocModel.findById(shareLink.documentId);
  if (!doc) {
    return res.status(404).json({ error: "Document not found" });
  }

  // Check if user already collaborator (upgrade role if needed)
  const existing = doc.collaborators.findIndex(
    (c) => c.userId.toString() === req.userId
  );

  if (existing !== -1) {
    doc.collaborators[existing].role = shareLink.role;
  } else {
    doc.collaborators.push({
      userId: req.userId as any,
      role: shareLink.role as any,
    });
  }

  await doc.save();
  res.json({ documentId: doc.id });
});

export default router;
```

---

## 🟣 PHASE 5: SOCKET.IO REAL-TIME

### Step 5.1: Socket Implementation

**src/sockets/doc.ts:**
```typescript
import { Server, Socket } from "socket.io";
import { verifyToken } from "../config/jwt";
import { DocModel } from "../models/Document";
import { User } from "../models/User";

interface PresenceUser {
  userId: string;
  displayName: string;
  avatarColor: string;
}

// Store connected users per document
const rooms = new Map<string, Map<string, PresenceUser>>();

// Store debounce timers per document (to batch DB writes)
const saveTimers = new Map<string, NodeJS.Timeout>();
const pendingContent = new Map<string, any>();

export const registerDocSocket = (io: Server) => {
  // ===== AUTHENTICATE ON CONNECTION =====
  io.use(async (socket, next) => {
    try {
      // Get token from handshake auth
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token"));

      // Verify token and extract user ID
      const { sub } = verifyToken<{ sub: string }>(token);
      
      // Attach userId to socket.data (accessible in handlers)
      (socket.data as any).userId = sub;
      
      next();
    } catch {
      next(new Error("Auth failed"));
    }
  });

  // ===== CONNECTION HANDLERS =====
  io.on("connection", (socket: Socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    // ----- JOIN DOCUMENT -----
    socket.on("doc:join", async ({ docId }) => {
      const userId = (socket.data as any).userId as string;

      // Fetch document
      const doc = await DocModel.findById(docId);
      if (!doc) {
        return socket.emit("doc:error", "Not found");
      }

      // Check permission
      const isOwner = doc.ownerId.toString() === userId;
      const collab = doc.collaborators.find(
        (c) => c.userId.toString() === userId
      );
      if (!isOwner && !collab) {
        return socket.emit("doc:error", "Forbidden");
      }

      // Fetch user info (for display)
      const user = await User.findById(userId);
      if (!user) return;

      const presenceUser: PresenceUser = {
        userId,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
      };

      // Join socket to room (Socket.IO concept)
      socket.join(docId);

      // Track in-memory presence
      let map = rooms.get(docId);
      if (!map) {
        map = new Map();
        rooms.set(docId, map);
      }
      map.set(socket.id, presenceUser);

      // Broadcast updated presence to all in room
      io.to(docId).emit("presence:update", Array.from(map.values()));
      console.log(`👥 ${user.displayName} joined ${docId}`);
    });

    // ----- REAL-TIME EDIT -----
    socket.on("doc:change", ({ docId, content }) => {
      const userId = (socket.data as any).userId as string;

      // Broadcast to others in room
      socket.to(docId).emit("doc:remote-change", { content, from: userId });

      // Debounce persistence to MongoDB
      pendingContent.set(docId, content);
      
      // Clear existing timer
      const existing = saveTimers.get(docId);
      if (existing) clearTimeout(existing);

      // Set new timer
      saveTimers.set(
        docId,
        setTimeout(async () => {
          const c = pendingContent.get(docId);
          if (!c) return;

          // Update database
          await DocModel.findByIdAndUpdate(docId, { content: c }).catch(() => {});

          // Cleanup
          pendingContent.delete(docId);
          saveTimers.delete(docId);
          
          console.log(`💾 Saved ${docId}`);
        }, 800) // Wait 800ms before persisting
      );
    });

    // ----- UPDATE TITLE -----
    socket.on("doc:title", async ({ docId, title }) => {
      await DocModel.findByIdAndUpdate(docId, { title }).catch(() => {});
      socket.to(docId).emit("doc:title", { title });
    });

    // ----- DISCONNECT -----
    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);

      // Remove from presence tracking
      for (const [docId, map] of rooms.entries()) {
        if (map.delete(socket.id)) {
          if (map.size === 0) {
            rooms.delete(docId);
          }
          // Broadcast updated presence
          io.to(docId).emit("presence:update", Array.from(map.values()));
        }
      }
    });
  });
};
```

**How it works:**

1. **Connection:**
   - Client connects with token in `auth`
   - Server verifies token in middleware
   - If valid, attach userId to socket

2. **Joining a Document:**
   - Client emits `doc:join { docId }`
   - Server checks permissions
   - Server joins socket to Socket.IO room
   - Server broadcasts presence list to room

3. **Real-time Edit:**
   - Client edits content → emits `doc:change { content, docId }`
   - Server broadcasts to others
   - Server debounces persistence (wait up to 800ms)
   - If more changes come, reschedule timer
   - After 800ms silence, save to MongoDB

4. **Disconnect:**
   - Clean up presence
   - Broadcast updated presence list

### Step 5.2: Server Entry Point

**src/index.ts:**
```typescript
import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server as IOServer } from "socket.io";
import mongoose from "mongoose";

import authRoutes from "./routes/auth";
import docRoutes from "./routes/documents";
import shareRoutes from "./routes/share";
import { registerDocSocket } from "./sockets/doc";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

// ===== MIDDLEWARE =====
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// ===== ROUTES =====
app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/documents", docRoutes);
app.use("/api/share", shareRoutes);

// ===== SOCKET.IO + HTTP SERVER =====
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
});

registerDocSocket(io);

// ===== DATABASE CONNECTION =====
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/collabpad")
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Collabpad server running on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed", err);
    process.exit(1);
  });
```

**Start the server:**
```bash
npm run dev
```

---

## 🟠 PHASE 6: FRONTEND SETUP

### Step 6.1: Create Next.js App

```bash
npx create-next-app@latest client \
  --typescript \
  --tailwind \
  --app \
  --no-eslint

cd client

npm install \
  socket.io-client \
  axios
```

### Step 6.2: Auth Context (State Management)

**lib/auth.tsx:**
```typescript
"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

type User = {
  id: string;
  email: string;
  displayName: string;
  avatarColor: string;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<Ctx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // On mount, check if token exists and validate it
    const token =
      typeof window !== "undefined" ? localStorage.getItem("collabpad_token") : null;

    if (!token) {
      setLoading(false);
      return;
    }

    // Validate token by calling /api/auth/me
    api
      .get("/api/auth/me")
      .then((r) => setUser(r.data.user))
      .catch(() => localStorage.removeItem("collabpad_token")) // Invalid token
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/api/auth/login", {
      email,
      password,
    });
    localStorage.setItem("collabpad_token", data.token);
    setUser(data.user);
    router.push("/dashboard");
  };

  const register = async (
    email: string,
    password: string,
    displayName?: string
  ) => {
    const { data } = await api.post("/api/auth/register", {
      email,
      password,
      displayName,
    });
    localStorage.setItem("collabpad_token", data.token);
    setUser(data.user);
    router.push("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("collabpad_token");
    setUser(null);
    router.push("/");
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};
```

### Step 6.3: Axios Interceptor

**lib/api.ts:**
```typescript
import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
});

// Automatically add auth header to all requests
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("collabpad_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
```

### Step 6.4: Socket.IO Client

**lib/socket.ts:**
```typescript
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  // Return existing socket if connected
  if (socket && socket.connected) return socket;

  // Create new socket with auth token
  const token =
    typeof window !== "undefined" ? localStorage.getItem("collabpad_token") : null;

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000", {
    auth: { token },
    transports: ["websocket"],
  });

  return socket;
};

export const closeSocket = () => {
  socket?.disconnect();
  socket = null;
};
```

### Step 6.5: Root Layout

**app/layout.tsx:**
```typescript
import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Collabpad — Collaborative Notepad",
  description: "Real-time collaborative document editor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

### Step 6.6: Login/Register Pages

**app/auth/login/page.tsx:**
```typescript
"use client";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6">Login to Collabpad</h1>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Login"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          No account? <Link href="/auth/register" className="text-blue-600">Register</Link>
        </p>
      </div>
    </div>
  );
}
```

**app/auth/register/page.tsx:**
```typescript
"use client";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const { register, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await register(email, password, displayName);
    } catch (err: any) {
      setError(err.response?.data?.error || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6">Create Collabpad Account</h1>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded"
            required
          />
          <input
            type="text"
            placeholder="Display Name (optional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-2 border rounded"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Register"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account? <Link href="/auth/login" className="text-blue-600">Login</Link>
        </p>
      </div>
    </div>
  );
}
```

### Step 6.7: Dashboard (List Docs)

**app/dashboard/page.tsx:**
```typescript
"use client";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Doc = {
  _id: string;
  title: string;
  updatedAt: string;
};

export default function DashboardPage() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  useEffect(() => {
    if (loading || !user) return;

    api
      .get("/api/documents")
      .then((r) => setDocs(r.data.documents))
      .finally(() => setLoadingDocs(false));
  }, [user, loading]);

  const createNew = async () => {
    const { data } = await api.post("/api/documents", {
      title: "Untitled Document",
    });
    router.push(`/doc/${data.document._id}`);
  };

  if (loading || !user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Collabpad</h1>
            <p className="text-gray-600">Welcome, {user.displayName}</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            Logout
          </button>
        </div>

        {/* New Doc Button */}
        <button
          onClick={createNew}
          className="mb-8 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
        >
          + New Document
        </button>

        {/* Docs List */}
        {loadingDocs ? (
          <p>Loading documents...</p>
        ) : docs.length === 0 ? (
          <p className="text-gray-600">No documents yet. Create one to get started!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {docs.map((doc) => (
              <Link
                key={doc._id}
                href={`/doc/${doc._id}`}
                className="p-4 bg-white rounded-lg shadow hover:shadow-lg cursor-pointer"
              >
                <h3 className="font-semibold">{doc.title}</h3>
                <p className="text-sm text-gray-500">
                  Modified: {new Date(doc.updatedAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 6.8: Editor Page (The Core!)

**app/doc/[id]/page.tsx:**
```typescript
"use client";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";

type PresenceUser = {
  userId: string;
  displayName: string;
  avatarColor: string;
};

export default function EditorPage() {
  const { user, loading } = useAuth();
  const params = useParams();
  const docId = params.id as string;

  const [title, setTitle] = useState("Untitled");
  const [content, setContent] = useState(""); // In real app, use Editor.js
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [loaded, setLoaded] = useState(false);

  const socketRef = useRef<any>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (loading || !user) return;

    // Fetch document
    api.get(`/api/documents/${docId}`).then((r) => {
      setTitle(r.data.document.title);
      setContent(r.data.document.content || "");
      setLoaded(true);
    });
  }, [user, loading, docId]);

  useEffect(() => {
    if (!loaded) return;

    // Connect to Socket.IO
    const socket = getSocket();
    socketRef.current = socket;

    // Join document room
    socket.emit("doc:join", { docId });

    // Listen for presence updates
    socket.on("presence:update", (users: PresenceUser[]) => {
      setPresence(users);
    });

    // Listen for remote changes
    socket.on("doc:remote-change", ({ content: remoteContent }) => {
      setContent(remoteContent);
    });

    // Listen for title updates
    socket.on("doc:title", ({ title: remoteTitle }) => {
      setTitle(remoteTitle);
    });

    return () => {
      socket.off("presence:update");
      socket.off("doc:remote-change");
      socket.off("doc:title");
    };
  }, [loaded, docId]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);

    // Debounce socket emit (700ms)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      socketRef.current?.emit("doc:change", { docId, content: newContent });
    }, 700);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    socketRef.current?.emit("doc:title", { docId, title: newTitle });
  };

  if (loading || !loaded) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="border-b p-4 flex justify-between items-center">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="text-2xl font-bold outline-none px-2"
        />

        {/* Presence Avatars */}
        <div className="flex gap-2">
          {presence.map((p) => (
            <div
              key={p.userId}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: p.avatarColor }}
              title={p.displayName}
            >
              {p.displayName[0]}
            </div>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-4 overflow-auto">
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Start typing..."
          className="w-full h-full p-4 border rounded outline-none resize-none"
        />
      </div>
    </div>
  );
}
```

---

## 🔨 Phase 7: Test Everything

### Test Backend

```bash
cd server
npm run dev
```

Test endpoints:
```bash
# Register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123"}'

# List docs (replace TOKEN)
curl -X GET http://localhost:4000/api/documents \
  -H "Authorization: Bearer TOKEN"
```

### Test Frontend

```bash
cd client
npm install
npm run dev
```

- Navigate to http://localhost:3000
- Register new account
- Create document
- Open in two browser tabs
- Edit → see changes in real-time

---

## 🚀 Deployment

### Backend (Render/Railway)
1. Push to GitHub
2. Create service pointing to `/server` folder
3. Set environment variables: `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`
4. Deploy

### Frontend (Vercel)
1. Create Next.js project
2. Point to `/client` folder
3. Set environment variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`
4. Deploy

### Database (MongoDB Atlas)
1. Create free M0 cluster
2. Get connection string
3. Use in `MONGO_URI`

---

## ✅ Checklist

- [ ] Backend server running on :4000
- [ ] MongoDB connected
- [ ] Auth routes working (register, login)
- [ ] Document CRUD working
- [ ] Socket.IO connecting
- [ ] Real-time edits syncing
- [ ] Presence avatars showing
- [ ] Share links working
- [ ] Permissions enforced
- [ ] Frontend connected to backend
- [ ] Can edit in multiple tabs simultaneously
- [ ] Deployed to production

Happy building! 🎉
