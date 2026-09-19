import { createFileRoute } from "@tanstack/react-router";
import { HowPage } from "@/components/QxtSite";
export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — QXT Funded" },
      { name: "description", content: "See the path from account selection to funded trading." },
      { property: "og:title", content: "How It Works — QXT Funded" },
      {
        property: "og:description",
        content: "See the path from account selection to funded trading.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowPage,
});
