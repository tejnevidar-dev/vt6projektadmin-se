import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StageView";

export const Route = createFileRoute("/uppfoljning")({
  component: () => <StagePage stage="uppfoljning" description="Leads som ska följas upp efter skickad offert." />,
  head: () => ({
    meta: [
      { title: "Uppföljning – admin.vt6" },
      { name: "description", content: "Alla leads i uppföljningssteget – följ upp offerter innan de blir kalla." },
      { property: "og:title", content: "Uppföljning – admin.vt6" },
      { property: "og:description", content: "Alla leads i uppföljningssteget – följ upp offerter innan de blir kalla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
