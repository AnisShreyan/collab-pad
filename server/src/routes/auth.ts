import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { signToken } from "../config/jwt";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
const colors = [
  "hsl(220 70% 55%)","hsl(340 75% 55%)","hsl(150 60% 45%)",
  "hsl(35 85% 55%)","hsl(265 70% 60%)","hsl(190 70% 50%)",
];

router.post("/register", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email & password required" });
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: "Email already registered" });
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email,
    password: hash,
    displayName: displayName || email.split("@")[0],
    avatarColor: colors[Math.floor(Math.random() * colors.length)],
  });
  const token = signToken({ sub: user.id });
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, avatarColor: user.avatarColor } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  const token = signToken({ sub: user.id });
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, avatarColor: user.avatarColor } });
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId).select("-password");
  res.json({ user });
});

router.patch("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { displayName, avatarColor } = req.body;
    if (!displayName && !avatarColor) {
      return res.status(400).json({ error: "At least one field required" });
    }

    const update: any = {};
    if (displayName && displayName.trim()) update.displayName = displayName.trim();
    if (avatarColor) update.avatarColor = avatarColor;

    const user = await User.findByIdAndUpdate(req.userId!, update, { new: true, runValidators: true }).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user: { id: user.id, email: user.email, displayName: user.displayName, avatarColor: user.avatarColor } });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.patch("/change-password", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid current password" });

    const hash = await bcrypt.hash(newPassword, 10);
    user.password = hash;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Password update error:", err);
    res.status(500).json({ error: "Failed to update password" });
  }
});

export default router;
