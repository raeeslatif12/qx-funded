import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/QxtSite";
import { legalDocuments } from "@/lib/qxt-legal-data";
export const Route = createFileRoute("/legal/risk")({
  head: () => ({
    meta: [
      { title: "Risk Disclosure — QXT Funded" },
      { name: "description", content: legalDocuments.risk.description },
      { property: "og:title", content: "Risk Disclosure — QXT Funded" },
      { property: "og:description", content: legalDocuments.risk.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <LegalPage document={legalDocuments.risk} />,
});
