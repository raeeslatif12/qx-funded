import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/QxtSite";
import { legalDocuments } from "@/lib/qxt-legal-data";
export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Agreement — QXT Funded" },
      { name: "description", content: legalDocuments.terms.description },
      { property: "og:title", content: "Terms & Agreement — QXT Funded" },
      { property: "og:description", content: legalDocuments.terms.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <LegalPage document={legalDocuments.terms} />,
});
