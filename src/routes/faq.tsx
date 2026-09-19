import { createFileRoute } from "@tanstack/react-router";
import { FaqPage } from "@/components/QxtSite";
export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Frequently Asked Questions — QXT Funded" },
      {
        name: "description",
        content: "Answers about QXT Funded accounts, rules, brokers, and payouts.",
      },
      { property: "og:title", content: "Frequently Asked Questions — QXT Funded" },
      {
        property: "og:description",
        content: "Answers about QXT Funded accounts, rules, brokers, and payouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FaqPage,
});
