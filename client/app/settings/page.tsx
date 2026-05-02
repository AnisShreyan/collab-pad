"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Save,
  User as UserIcon,
  Mail,
  Shield,
  Palette,
} from "lucide-react";

const colors = [
  { name: "Deep Sea", value: "hsl(221 83% 53%)" },
  { name: "Rose", value: "hsl(346 84% 61%)" },
  { name: "Emerald", value: "hsl(142 71% 45%)" },
  { name: "Amber", value: "hsl(38 92% 50%)" },
  { name: "Violet", value: "hsl(262 83% 58%)" },
  { name: "Indigo", value: "hsl(239 84% 67%)" },
  { name: "Crimson", value: "hsl(0 72% 51%)" },
  { name: "Teal", value: "hsl(173 80% 40%)" },
];

function Inner() {
  const { user, loading, logout, updateProfile, changePassword } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPass, setChangingPass] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setAvatarColor(user.avatarColor || "hsl(221 83% 53%)");
    }
  }, [user]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error("Display name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      await updateProfile(displayName, avatarColor);
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All password fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setChangingPass(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update password");
    } finally {
      setChangingPass(false);
    }
  };

  if (loading || !user)
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-white">
      {/* Top Nav */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Dashboard</span>
          </Link>
          <button
            onClick={logout}
            className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="space-y-12">
          {/* Header */}
          <section>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-500 mt-2">
              Manage your personal information and security settings.
            </p>
          </section>

          {/* Profile Section */}
          <section className="space-y-8">
            <div className="flex items-center gap-6">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-inner"
                style={{ backgroundColor: avatarColor }}
              >
                {displayName ? displayName[0].toUpperCase() : user.email[0].toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Profile Appearance</h2>
                <p className="text-sm text-gray-500">This is how you'll appear to others.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 max-w-xl">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                  placeholder="Your display name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Email Address</label>
                <input
                  type="text"
                  value={user.email}
                  disabled
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700">Avatar Color</label>
                <div className="flex flex-wrap gap-3">
                  {colors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setAvatarColor(color.value)}
                      className={`w-8 h-8 rounded-full transition-all ${
                        avatarColor === color.value 
                          ? "ring-2 ring-offset-2 ring-black scale-110" 
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.value }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-fit px-6 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-all disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Password Section */}
          <section className="space-y-8">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Security</h2>
              <p className="text-sm text-gray-500">Update your password to keep your account secure.</p>
            </div>

            <form onSubmit={handlePasswordChange} className="grid grid-cols-1 gap-6 max-w-xl">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                  placeholder="••••••••"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={changingPass}
                className="w-fit px-6 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-all disabled:opacity-50"
              >
                {changingPass ? "Updating..." : "Update Password"}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
