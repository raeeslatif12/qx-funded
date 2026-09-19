import { createFileRoute } from "@tanstack/react-router";
import { SupportPage } from "@/components/QxtSite";
export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support Center — QXT Funded" },
      { name: "description", content: "Get 24/7 support for your QXT Funded account." },
      { property: "og:title", content: "Support Center — QXT Funded" },
      { property: "og:description", content: "Get 24/7 support for your QXT Funded account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportPage,
});
