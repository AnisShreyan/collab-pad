import { Server, Socket } from "socket.io";
import { verifyToken } from "../config/jwt";
import { DocModel } from "../models/Document";
import { User } from "../models/User";

interface PresenceUser {
  userId: string;
  displayName: string;
  avatarColor: string;
}

interface RemoteCursor {
  socketId: string;
  userId: string;
  displayName: string;
  avatarColor: string;
  range: { index: number; length: number } | null;
  x?: number;
  y?: number;
}

// docId -> Map<socketId, PresenceUser>
const rooms = new Map<string, Map<string, PresenceUser>>();
// docId -> Map<socketId, RemoteCursor>
const cursors = new Map<string, Map<string, RemoteCursor>>();
// docId -> debounce timer
const saveTimers = new Map<string, NodeJS.Timeout>();
// docId -> latest pending content
const pendingContent = new Map<string, any>();

export const registerDocSocket = (io: Server) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token"));
      const { sub } = verifyToken<{ sub: string }>(token);
      (socket.data as any).userId = sub;
      next();
    } catch {
      next(new Error("Auth failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    socket.on("doc:join", async ({ docId }) => {
      const userId = (socket.data as any).userId as string;
      const doc = await DocModel.findById(docId);
      if (!doc) return socket.emit("doc:error", "Not found");
      const isOwner = doc.ownerId.toString() === userId;
      const collab = doc.collaborators.find((c) => c.userId.toString() === userId);
      if (!isOwner && !collab) return socket.emit("doc:error", "Forbidden");

      const user = await User.findById(userId);
      if (!user) return;
      const presenceUser: PresenceUser = {
        userId,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
      };

      socket.join(docId);
      let map = rooms.get(docId);
      if (!map) { map = new Map(); rooms.set(docId, map); }
      map.set(socket.id, presenceUser);

      io.to(docId).emit("presence:update", Array.from(map.values()));
    });

    socket.on("doc:change", ({ docId, content }) => {
      const userId = (socket.data as any).userId as string;
      // Broadcast to others
      socket.to(docId).emit("doc:remote-change", { content, from: userId });

      // Debounced persistence
      pendingContent.set(docId, { content, userId });
      const existing = saveTimers.get(docId);
      if (existing) clearTimeout(existing);
      saveTimers.set(
        docId,
        setTimeout(async () => {
          const pending = pendingContent.get(docId);
          if (!pending) return;
          const { content: c, userId: uid } = pending;

          const doc = await DocModel.findById(docId);
          if (!doc) return;

          const lastLog = doc.editLogs[doc.editLogs.length - 1];
          const fiveMins = 5 * 60 * 1000;
          const shouldLog = !lastLog || 
                            lastLog.userId.toString() !== uid || 
                            (new Date().getTime() - lastLog.timestamp.getTime() > fiveMins);

          const update: any = { content: c };
          if (shouldLog) {
            const user = await User.findById(uid);
            if (user) {
              update.$push = { 
                editLogs: { 
                  userId: user._id, 
                  userName: user.displayName, 
                  avatarColor: user.avatarColor,
                  timestamp: new Date() 
                } 
              };
              // Limit logs to last 100 to prevent document bloat
              if (doc.editLogs.length > 100) {
                update.$pop = { editLogs: -1 };
              }
            }
          }

          await DocModel.findByIdAndUpdate(docId, update).catch(() => {});
          
          pendingContent.delete(docId);
          saveTimers.delete(docId);
        }, 800)
      );
    });

    socket.on("doc:title", async ({ docId, title }) => {
      await DocModel.findByIdAndUpdate(docId, { title }).catch(() => {});
      socket.to(docId).emit("doc:title", { title });
    });

    socket.on("cursor:update", ({ docId, range, x, y }) => {
      const userId = (socket.data as any).userId as string;
      const map = rooms.get(docId);
      if (!map) return;
      const presenceUser = map.get(socket.id);
      if (!presenceUser) return;

      let cursorMap = cursors.get(docId);
      if (!cursorMap) {
        cursorMap = new Map();
        cursors.set(docId, cursorMap);
      }

      const remoteCursor: RemoteCursor = {
        socketId: socket.id,
        userId,
        displayName: presenceUser.displayName,
        avatarColor: presenceUser.avatarColor,
        range,
        x,
        y,
      };

      cursorMap.set(socket.id, remoteCursor);
      socket.to(docId).emit("cursor:update", remoteCursor);
    });

    socket.on("disconnect", () => {
      for (const [docId, map] of rooms.entries()) {
        if (map.delete(socket.id)) {
          if (map.size === 0) rooms.delete(docId);
          io.to(docId).emit("presence:update", Array.from(map.values()));
        }
      }
      for (const [docId, cursorMap] of cursors.entries()) {
        if (cursorMap.delete(socket.id)) {
          if (cursorMap.size === 0) cursors.delete(docId);
          io.to(docId).emit("cursor:remove", { socketId: socket.id });
        }
      }
    });
  });
};
