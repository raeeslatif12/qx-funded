import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "@/components/QxtSite";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset Funded Account Password — QXT Funded" },
      {
        name: "description",
        content: "Submit a secure, admin-reviewed funded account password reset.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});
