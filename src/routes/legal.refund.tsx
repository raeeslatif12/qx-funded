import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/QxtSite";
import { legalDocuments } from "@/lib/qxt-legal-data";
export const Route = createFileRoute("/legal/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — QXT Funded" },
      { name: "description", content: legalDocuments.refund.description },
      { property: "og:title", content: "Refund Policy — QXT Funded" },
      { property: "og:description", content: legalDocuments.refund.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <LegalPage document={legalDocuments.refund} />,
});
