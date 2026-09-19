import { createFileRoute } from "@tanstack/react-router";
import { ReviewsPage } from "@/components/QxtSite";
export const Route = createFileRoute("/reviews")({
  head: () => ({
    meta: [
      { title: "Trader Reviews — QXT Funded" },
      { name: "description", content: "Read trader experiences with QXT Funded." },
      { property: "og:title", content: "Trader Reviews — QXT Funded" },
      { property: "og:description", content: "Read trader experiences with QXT Funded." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewsPage,
});
