import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { listJobs, type JobWithLead, type JobStatus } from "@/lib/jobs-api";
import { useUserRoles } from "@/hooks/use-role";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/jobb")({
  component: () => (
    <RequireAuth>
      <JobsPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Jobb – admin.vt6" }] }),
});

const STATUS_LABEL: Record<JobStatus, string> = {
  ej_paborjad: "Ej påbörjad",
  pagaende: "Pågående",
  klar: "Klar",
};

function JobsPage() {
  const { roles, isAdmin } = useUserRoles();
  const [jobs, setJobs] = useState<JobWithLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setJobs(await listJobs());
      } catch (e: any) {
        toast.error(e.message ?? "Kunde inte ladda jobb");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isHantverkare = roles.includes("hantverkare") && !isAdmin;
  const title = isHantverkare ? "Mina jobb" : "Jobb";

  return (
    <AppShell
      title={title}
      description={
        isAdmin
          ? "Alla aktiva jobb. Skapas automatiskt när ett lead bokas och tilldelas."
          : "Jobb du är tilldelad eller inbjuden till."
      }
      meta={<span>Totalt: <strong className="text-foreground">{jobs.length}</strong></span>}
    >
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kund</TableHead>
              <TableHead>Adress</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tilldelad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Laddar…
                </TableCell>
              </TableRow>
            )}
            {!loading && jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  Inga jobb än. När säljaren bokar och admin tilldelar en arbetsledare eller UE dyker jobbet upp här.
                </TableCell>
              </TableRow>
            )}
            {jobs.map((j) => (
              <TableRow key={j.id} className="cursor-pointer hover:bg-muted/40">
                <TableCell>
                  <Link to="/jobb/$jobId" params={{ jobId: j.id }} className="font-medium hover:underline">
                    {j.lead?.name ?? "—"}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {j.property ? `${j.property.address}, ${j.property.municipality}` : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {j.assignment_type === "underentreprenor" ? "UE" : "Arbetsledare"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={j.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">
                  {j.assigned_to.slice(0, 8)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, string> = {
    ej_paborjad: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    pagaende: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    klar: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
