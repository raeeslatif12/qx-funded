import { createFileRoute } from "@tanstack/react-router";
import { AdminLoginPage } from "@/components/CheckoutFlow";

export const Route = createFileRoute("/admin-dashboard/login")({
  component: AdminLoginPage,
});
