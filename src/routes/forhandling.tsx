import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StageView";

export const Route = createFileRoute("/forhandling")({
  component: () => <StagePage stage="forhandling" description="Leads i förhandling om pris och villkor." />,
  head: () => ({
    meta: [
      { title: "Förhandling – admin.vt6" },
      { name: "description", content: "Överblick över affärer i förhandling om pris och villkor." },
      { property: "og:title", content: "Förhandling – admin.vt6" },
      { property: "og:description", content: "Överblick över affärer i förhandling om pris och villkor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
