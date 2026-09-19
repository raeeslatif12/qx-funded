import { createFileRoute } from "@tanstack/react-router";
import { BrokersPage } from "@/components/QxtSite";
export const Route = createFileRoute("/brokers")({
  head: () => ({
    meta: [
      { title: "Trading Platforms — QXT Funded" },
      { name: "description", content: "Explore supported QXT Funded trading platforms." },
      { property: "og:title", content: "Trading Platforms — QXT Funded" },
      { property: "og:description", content: "Explore supported QXT Funded trading platforms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrokersPage,
});
