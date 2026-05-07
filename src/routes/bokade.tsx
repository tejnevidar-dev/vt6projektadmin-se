import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StageView";

export const Route = createFileRoute("/bokade")({
  component: () => <StagePage stage="bokad" description="Leads med bokat möte." />,
  head: () => ({ meta: [{ title: "Bokade – Säljpanel" }] }),
});
