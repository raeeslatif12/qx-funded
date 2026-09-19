import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/QxtSite";
import { legalDocuments } from "@/lib/qxt-legal-data";
export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "Cookies Policy — QXT Funded" },
      { name: "description", content: legalDocuments.cookies.description },
      { property: "og:title", content: "Cookies Policy — QXT Funded" },
      { property: "og:description", content: legalDocuments.cookies.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <LegalPage document={legalDocuments.cookies} />,
});
