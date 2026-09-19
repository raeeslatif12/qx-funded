import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboardPage } from "@/components/CheckoutFlow";

export const Route = createFileRoute("/admin-dashboard/")({
  component: AdminDashboardPage,
});
