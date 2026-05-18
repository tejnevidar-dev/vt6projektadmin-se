import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StageView";

export const Route = createFileRoute("/offerterade")({
  component: () => <StagePage stage="offererad" description="Leads där offert har skickats." />,
  head: () => ({ meta: [{ title: "Offerterade" }] }),
});
