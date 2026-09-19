import { createFileRoute } from "@tanstack/react-router";
import { AccountsPage } from "@/components/QxtSite";
export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "Trading Accounts — QXT Funded" },
      { name: "description", content: "Compare Instant and Challenge trading accounts." },
      { property: "og:title", content: "Trading Accounts — QXT Funded" },
      { property: "og:description", content: "Compare Instant and Challenge trading accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountsPage,
});
