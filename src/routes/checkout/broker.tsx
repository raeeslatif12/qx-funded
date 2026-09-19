import { createFileRoute } from "@tanstack/react-router";
import { BrokerSelectionPage } from "@/components/CheckoutFlow";
export const Route = createFileRoute("/checkout/broker")({ component: BrokerSelectionPage });
