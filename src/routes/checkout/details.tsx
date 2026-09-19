import { createFileRoute } from "@tanstack/react-router";
import { PaymentDetailsPage } from "@/components/CheckoutFlow";
export const Route = createFileRoute("/checkout/details")({ component: PaymentDetailsPage });
