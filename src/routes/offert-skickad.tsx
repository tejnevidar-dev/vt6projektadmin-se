import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StageView";

export const Route = createFileRoute("/offert-skickad")({
  component: () => <StagePage stage="offert_skickad" description="Leads där offerten är skickad till kund och väntar på svar." />,
  head: () => ({
    meta: [
      { title: "Offert skickad – admin.vt6" },
      { name: "description", content: "Överblick över alla leads där offert har skickats och väntar på kundens svar." },
      { property: "og:title", content: "Offert skickad – admin.vt6" },
      { property: "og:description", content: "Överblick över alla leads där offert har skickats och väntar på kundens svar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
