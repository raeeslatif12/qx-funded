import { createFileRoute } from "@tanstack/react-router";
import { PaymentMethodSelectionPage } from "@/components/CheckoutFlow";
export const Route = createFileRoute("/checkout/payment-method")({
  component: PaymentMethodSelectionPage,
});
