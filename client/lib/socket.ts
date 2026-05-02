import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (socket && socket.connected) return socket;
  const token = typeof window !== "undefined" ? localStorage.getItem("collabpad_token") : null;
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
