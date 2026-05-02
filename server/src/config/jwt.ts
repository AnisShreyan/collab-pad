import jwt from "jsonwebtoken";
const SECRET = process.env.JWT_SECRET || "dev-secret";

export const signToken = (payload: object) =>
  jwt.sign(payload, SECRET, { expiresIn: "30d" });

export const verifyToken = <T = any>(token: string): T =>
  jwt.verify(token, SECRET) as T;
