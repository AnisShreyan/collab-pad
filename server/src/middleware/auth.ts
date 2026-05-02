import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../config/jwt";

export interface AuthRequest extends Request {
  userId?: string;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { sub } = verifyToken<{ sub: string }>(header.slice(7));
    req.userId = sub;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};
