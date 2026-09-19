import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { CheckoutGatewayPage } from "@/components/CheckoutFlow";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    plan: typeof search["plan"] === "string" ? search["plan"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Secure Checkout — QXT Funded" },
      { name: "description", content: "Complete your QXT Funded account order." },
    ],
  }),
  component: function CheckoutLayout() {
    const location = useLocation();
    return location.pathname === "/checkout" ? <CheckoutGatewayPage /> : <Outlet />;
  },
});
