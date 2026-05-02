import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  password: string;
  displayName: string;
  avatarColor: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  displayName: { type: String, required: true },
  avatarColor: { type: String, default: "hsl(220 70% 55%)" },
  createdAt: { type: Date, default: Date.now },
});

export const User = model<IUser>("User", UserSchema);
