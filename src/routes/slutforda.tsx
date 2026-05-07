import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StageView";

export const Route = createFileRoute("/slutforda")({
  component: () => <StagePage stage="slutford" description="Slutförda leads." />,
  head: () => ({ meta: [{ title: "Slutförda – Säljpanel" }] }),
});
