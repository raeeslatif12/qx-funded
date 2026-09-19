import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/QxtSite";
import { legalDocuments } from "@/lib/qxt-legal-data";
export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Agreement — QXT Funded" },
      { name: "description", content: legalDocuments.privacy.description },
      { property: "og:title", content: "Privacy Agreement — QXT Funded" },
      { property: "og:description", content: legalDocuments.privacy.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <LegalPage document={legalDocuments.privacy} />,
});
