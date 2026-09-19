import { createFileRoute } from "@tanstack/react-router";
import { PaymentProofPage } from "@/components/CheckoutFlow";
export const Route = createFileRoute("/checkout/proof")({ component: PaymentProofPage });
