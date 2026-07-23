import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserCircle, CheckCircle2 } from "lucide-react";
import { BASE_URL } from "@/lib/api";

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name ?? "");
  const [company, setCompany] = useState(user?.company ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");

    const body: Record<string, string> = {};
    if (name.trim()) body.name = name.trim();
    body.company = company.trim();
    if (newPassword) {
      body.currentPassword = currentPassword;
      body.newPassword = newPassword;
    }

    try {
      const res = await fetch(`${BASE_URL}api/auth/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? "Failed to save changes");
        setStatus("error");
        return;
      }

      // Refresh the auth cache so name/company update in the header
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setCurrentPassword("");
      setNewPassword("");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setErrorMsg("Network error — please try again");
      setStatus("error");
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Edit Profile</h1>
        <p className="text-muted-foreground text-sm">Update your name, company, or password.</p>
      </div>

      {/* Avatar placeholder */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <UserCircle className="w-10 h-10 text-primary" />
        </div>
        <div>
          <div className="font-semibold text-foreground">{user?.name}</div>
          <div className="text-sm text-muted-foreground">{user?.email}</div>
          <div className="text-xs text-muted-foreground capitalize mt-0.5">
            {user?.role} {user?.company ? `· ${user.company}` : ""}
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-card border border-card-border rounded-xl p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email Address</label>
          <Input
            value={user?.email ?? ""}
            disabled
            className="bg-muted text-muted-foreground cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground">Email cannot be changed. Contact an admin if you need to update it.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Full Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
            autoComplete="name"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Company</label>
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Your company name"
            autoComplete="organization"
          />
        </div>

        <hr className="border-border" />

        <div className="space-y-1">
          <p className="text-sm font-medium">Change Password <span className="text-muted-foreground font-normal">(optional)</span></p>
          <p className="text-xs text-muted-foreground">Leave blank to keep your current password.</p>
        </div>

        {/*
          Hidden username field anchors the browser's credential autofill to the
          correct email address, preventing it from dumping the email into Full Name.
        */}
        <input type="hidden" autoComplete="username" value={user?.email ?? ""} readOnly />

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Current Password</label>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">New Password</label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
          />
        </div>

        {status === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {status === "saved" && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <AlertDescription>Profile updated successfully.</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
