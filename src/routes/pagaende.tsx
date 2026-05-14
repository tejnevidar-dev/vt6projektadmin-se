import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StageView";

export const Route = createFileRoute("/pagaende")({
  component: () => <StagePage stage="pagaende" description="Leads där arbete pågår." />,
  head: () => ({ meta: [{ title: "Pågående" }] }),
});
