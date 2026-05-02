import { Router } from "express";
import { nanoid } from "nanoid";
import { Types } from "mongoose";
import { ShareLink } from "../models/ShareLink";
import { DocModel } from "../models/Document";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Create share link (owner only)
router.post("/:docId", async (req: AuthRequest, res) => {
  const doc = await DocModel.findById(req.params.docId);
  if (!doc) return res.status(404).json({ error: "Not found" });
  if (doc.ownerId.toString() !== req.userId) return res.status(403).json({ error: "Owner only" });
  const role = req.body.role === "editor" ? "editor" : "viewer";
  const link = await ShareLink.create({
    documentId: doc._id,
    token: nanoid(24),
    role,
    createdBy: req.userId,
  });
  res.json({ link });
});

// Accept invite token → adds caller as collaborator
router.post("/accept/:token", async (req: AuthRequest, res) => {
  const link = await ShareLink.findOne({ token: req.params.token });
  if (!link) return res.status(404).json({ error: "Invalid invite" });
  const doc = await DocModel.findById(link.documentId);
  if (!doc) return res.status(404).json({ error: "Document missing" });
  const uid = new Types.ObjectId(req.userId);
  if (doc.ownerId.equals(uid)) return res.json({ documentId: doc.id });
  const existing = doc.collaborators.find((c) => c.userId.equals(uid));
  if (existing) {
    if (existing.role !== link.role) existing.role = link.role;
  } else {
    doc.collaborators.push({ userId: uid, role: link.role });
  }
  await doc.save();
  res.json({ documentId: doc.id, role: link.role });
});

export default router;
