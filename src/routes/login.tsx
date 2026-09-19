import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/QxtSite";
export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — QXT Funded" },
      { name: "description", content: "Sign in to your QXT Funded trader dashboard." },
      { property: "og:title", content: "Sign In — QXT Funded" },
      { property: "og:description", content: "Sign in to your QXT Funded trader dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});
