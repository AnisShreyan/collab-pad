import { Router } from "express";
import { Types } from "mongoose";
import { DocModel } from "../models/Document";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const canAccess = (doc: any, userId: string) =>
  doc.ownerId.toString() === userId ||
  doc.collaborators.some((c: any) => c.userId.toString() === userId);

const canEdit = (doc: any, userId: string) =>
  doc.ownerId.toString() === userId ||
  doc.collaborators.some((c: any) => c.userId.toString() === userId && c.role === "editor");

router.get("/", async (req: AuthRequest, res) => {
  const uid = new Types.ObjectId(req.userId);
  const docs = await DocModel.find({
    $or: [{ ownerId: uid }, { "collaborators.userId": uid }],
  })
    .sort({ updatedAt: -1 })
    .populate("ownerId", "displayName avatarColor")
    .populate("editLogs.userId", "displayName avatarColor")
    .select("title ownerId updatedAt createdAt editLogs");
  res.json({ documents: docs });
});

router.post("/", async (req: AuthRequest, res) => {
  const doc = await DocModel.create({
    title: req.body.title || "Untitled",
    content: { blocks: [] },
    ownerId: req.userId,
  });
  res.json({ document: doc });
});

router.get("/:id", async (req: AuthRequest, res) => {
  const doc = await DocModel.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: "Not found" });
  if (!canAccess(doc, req.userId!)) return res.status(403).json({ error: "Forbidden" });
  res.json({
    document: doc,
    canEdit: canEdit(doc, req.userId!),
    isOwner: doc.ownerId.toString() === req.userId,
  });
});

router.patch("/:id", async (req: AuthRequest, res) => {
  const doc = await DocModel.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: "Not found" });
  if (!canEdit(doc, req.userId!)) return res.status(403).json({ error: "Forbidden" });
  if (typeof req.body.title === "string") doc.title = req.body.title;
  if (req.body.content) doc.content = req.body.content;
  await doc.save();
  res.json({ document: doc });
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const doc = await DocModel.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: "Not found" });
  if (doc.ownerId.toString() !== req.userId) return res.status(403).json({ error: "Owner only" });
  await doc.deleteOne();
  res.json({ ok: true });
});

export default router;
