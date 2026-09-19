import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { getCurrentUser, updateAccountSettings } from "@/lib/backend";
import { Layout } from "@/components/QxtSite";

export const Route = createFileRoute("/account-settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — QXT Funded" },
      { name: "description", content: "Update your account details and security settings." },
    ],
  }),
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (!active) return;
        if (!user) {
          navigate({ to: "/login" });
          return;
        }
        setName(user.name);
        setEmail(user.email);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          navigate({ to: "/login" });
        }
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const nextName = String(form.get("name") || "").trim();
    const nextEmail = String(form.get("email") || "").trim();
    const currentPassword = String(form.get("currentPassword") || "").trim();
    const newPassword = String(form.get("newPassword") || "").trim();

    try {
      if (!nextName || !nextEmail) {
        throw new Error("Name and email are required.");
      }

      const payload: {
        name?: string;
        email?: string;
        password?: string;
        currentPassword?: string;
      } = {
        name: nextName,
        email: nextEmail,
      };

      if (newPassword) {
        payload.password = newPassword;
        payload.currentPassword = currentPassword;
      }

      const updatedUser = await updateAccountSettings(payload);
      setMessage("Your account details were updated successfully.");
      setName(updatedUser.name);
      setEmail(updatedUser.email);
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update your account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <section className="section">
        <div className="container-x max-w-2xl">
          <p className="eyebrow">Profile</p>
          <h1 className="mt-4 text-4xl font-semibold">Account settings</h1>
          <p className="mt-3 text-muted-foreground">
            Update your profile details and change your password securely.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 grid gap-5 rounded-xl border border-border bg-surface p-6"
          >
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading your profile…</p>
            ) : (
              <>
                <label>
                  Full name
                  <input
                    className="field mt-2"
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </label>

                <label>
                  Email address
                  <input
                    className="field mt-2"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>

                <div className="grid gap-5 md:grid-cols-2">
                  <label>
                    Current password
                    <input
                      className="field mt-2"
                      name="currentPassword"
                      type="password"
                      placeholder="Required only for password changes"
                    />
                  </label>

                  <label>
                    New password
                    <input
                      className="field mt-2"
                      name="newPassword"
                      type="password"
                      minLength={8}
                      placeholder="Leave blank to keep current"
                    />
                  </label>
                </div>

                {error && (
                  <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {error}
                  </p>
                )}
                {message && (
                  <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                    {message}
                  </p>
                )}

                <button type="submit" className="btn-gold w-fit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </>
            )}
          </form>
        </div>
      </section>
    </Layout>
  );
}
