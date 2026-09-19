import { createFileRoute } from "@tanstack/react-router";
import { UserOrdersDashboardPage } from "@/components/CheckoutFlow";
export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Trader Dashboard — QXT Funded" },
      { name: "description", content: "Track your QXT Funded orders." },
    ],
  }),
  component: UserOrdersDashboardPage,
});
