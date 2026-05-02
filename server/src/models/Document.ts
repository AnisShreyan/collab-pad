import { Schema, model, Document, Types } from "mongoose";

export interface ICollaborator {
  userId: Types.ObjectId;
  role: "viewer" | "editor";
}
export interface IEditLog {
  userId: Types.ObjectId;
  userName: string;
  avatarColor: string;
  timestamp: Date;
}
export interface IDoc extends Document {
  title: string;
  content: any;
  ownerId: Types.ObjectId;
  collaborators: ICollaborator[];
  editLogs: IEditLog[];
  createdAt: Date;
  updatedAt: Date;
}

const DocSchema = new Schema<IDoc>(
  {
    title: { type: String, default: "Untitled" },
    content: { type: Schema.Types.Mixed, default: { blocks: [] } },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    collaborators: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["viewer", "editor"], default: "viewer" },
      },
    ],
    editLogs: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        userName: { type: String, required: true },
        avatarColor: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const DocModel = model<IDoc>("Document", DocSchema);
