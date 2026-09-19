import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/QxtSite";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QXT Funded — Prove Your Edge. Get Funded." },
      {
        name: "description",
        content:
          "Access trading capital up to $50,000 and keep up to 92% of the profits you generate.",
      },
      { property: "og:title", content: "QXT Funded — Prove Your Edge. Get Funded." },
      {
        property: "og:description",
        content:
          "Access trading capital up to $50,000 and keep up to 92% of the profits you generate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});
