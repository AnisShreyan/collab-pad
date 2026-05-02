# Collabpad — Architecture

## Overview
Collabpad is a real-time collaborative notepad. Two users can open the same document and see each other's edits and presence avatars instantly. The stack is intentionally portfolio-friendly: classic, well-known pieces wired together cleanly.

## Stack
| Layer    | Tech                                               |
|----------|----------------------------------------------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind, Editor.js |
| Realtime | Socket.IO (client + server)                        |
| Backend  | Node.js, Express, TypeScript                       |
| Auth     | JWT (HS256) + bcrypt                               |
| DB       | MongoDB 7 via Mongoose                             |
| Deploy   | Docker Compose (local) / Vercel + Render + Atlas (prod) |

## Data model
- **User**: `email`, `password (bcrypt)`, `displayName`, `avatarColor`
- **Document**: `title`, `content (Editor.js JSON)`, `ownerId`, `collaborators: [{ userId, role }]`
- **ShareLink**: `documentId`, `token (nanoid)`, `role`, `createdBy`

## Real-time flow
1. Client connects to Socket.IO with JWT in `auth.token`.
2. Server middleware verifies the JWT and attaches `userId` to the socket.
3. Client emits `doc:join { docId }`. Server checks that the user is owner or collaborator, joins the `docId` room, and broadcasts an updated presence list.
4. On every Editor.js change, the client debounces (700ms) and emits `doc:change { docId, content }`.
5. Server broadcasts `doc:remote-change` to other clients in the room and debounces (800ms) a `findByIdAndUpdate` to MongoDB. This batches rapid keystrokes into one DB write per ~800ms per document.
6. Remote clients ignore changes that match their own last-saved snapshot to avoid render loops, and skip applying remote changes while the user is mid-edit.

## Permissions
- `owner` — full control (edit, share, delete)
- `editor` — can edit content & title
- `viewer` — read-only

Express guards check role on every API write. Socket.IO checks access on `doc:join`.

## Sharing via link
Owner generates a `ShareLink` with a 24-char `nanoid` token + role. Recipient visits `/invite/<token>` → if logged in, they're added to `collaborators` (or upgraded if already present) and redirected to the doc.

## Why not CRDT/OT?
True conflict-free editing (Yjs / Automerge) is the next step. The current "last write within debounce window wins" approach works well for the typical case (people editing different paragraphs) and keeps the codebase small enough to be a clear portfolio piece.

## Local dev
```bash
docker compose up --build
```

## Production deploy
- **Frontend (Vercel)**: import the `client/` folder, set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` to your server URL.
- **Backend (Render/Railway/Fly/VPS)**: deploy `server/` with Node 20+. Set `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`.
- **DB (MongoDB Atlas)**: free M0 cluster works.
- **VPS option**: clone the repo, install Docker + Docker Compose, run `docker compose up -d`.

## File map
```
collab-pad/
├── docker-compose.yml
├── README.md
├── docs/ARCHITECTURE.md
├── server/
│   ├── Dockerfile, package.json, tsconfig.json, .env.example
│   └── src/
│       ├── index.ts                 # Express + Socket.IO bootstrap
│       ├── config/jwt.ts
│       ├── middleware/auth.ts
│       ├── models/{User,Document,ShareLink}.ts
│       ├── routes/{auth,documents,share}.ts
│       └── sockets/doc.ts           # Real-time co-editing + presence
└── client/
    ├── Dockerfile, package.json, tsconfig.json, next.config.js, tailwind.config.ts
    ├── styles/globals.css
    ├── lib/{api.ts, auth.tsx, socket.ts}
    ├── components/{Editor.tsx, ShareDialog.tsx}
    └── app/
        ├── layout.tsx, page.tsx (landing)
        ├── auth/login/page.tsx, auth/register/page.tsx
        ├── dashboard/page.tsx
        ├── doc/[id]/page.tsx        # Editor + realtime
        └── invite/[token]/page.tsx  # Accept share link
```
