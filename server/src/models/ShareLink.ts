import { Schema, model, Document, Types } from "mongoose";

export interface IShareLink extends Document {
  documentId: Types.ObjectId;
  token: string;
  role: "viewer" | "editor";
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const ShareLinkSchema = new Schema<IShareLink>({
  documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
  token: { type: String, required: true, unique: true },
  role: { type: String, enum: ["viewer", "editor"], default: "viewer" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

export const ShareLink = model<IShareLink>("ShareLink", ShareLinkSchema);
