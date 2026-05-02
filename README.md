# Collabpad — Collaborative Notepad (Next.js + Express + MongoDB + Socket.IO)

A real-time collaborative notepad inspired by Notion. Built with Editor.js, with multi-user co-editing, presence avatars, share-link permissions, and JWT auth.

## Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + TailwindCSS + Editor.js + socket.io-client
- **Backend**: Node.js + Express + TypeScript + Socket.IO + Mongoose (MongoDB) + JWT
- **DB**: MongoDB 7

## Quick start (Docker — recommended)

```bash
docker compose up --build
```
- Frontend: http://localhost:3000
- Backend:  http://localhost:4000
- Mongo:    mongodb://localhost:27017

## Quick start (local, no Docker)

1. Start MongoDB locally (or use MongoDB Atlas).
2. Backend:
   ```bash
   cd server
   cp .env.example .env   # edit MONGO_URI / JWT_SECRET
   npm install
   npm run dev
   ```
3. Frontend (new terminal):
   ```bash
   cd client
   cp .env.example .env.local
   npm install
   npm run dev
   ```

## Deploy
- **Frontend** → Vercel (set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` to your server URL)
- **Backend** → Render / Railway / Fly.io / any VPS with Node 20+ (set `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`)
- **DB** → MongoDB Atlas free tier

See `docs/ARCHITECTURE.md` for a full writeup.

## Features
- Email/password auth (JWT, bcrypt)
- Document CRUD with owner + collaborator roles (viewer / editor)
- Real-time co-editing via Socket.IO rooms (`doc:<id>`)
- Live presence avatars (color per user)
- Share via tokenized invite links with role
- Notion-like minimal UI
