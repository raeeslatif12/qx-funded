import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/components/QxtSite";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — QXT Funded" },
      {
        name: "description",
        content:
          "Contact the QXT Funded team with questions about accounts, evaluations, or support.",
      },
      { property: "og:title", content: "Contact Us — QXT Funded" },
      {
        property: "og:description",
        content:
          "Contact the QXT Funded team with questions about accounts, evaluations, or support.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});
