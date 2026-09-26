// Genererar idempotent import-SQL för UE-kandidater ur en CSV (kolumner: company_name, org_number, phone, address,
// trade, team_size, pipeline_status, priority, notes). Rader vars org.nr redan finns i subcontractors hoppas över.
//
//   bun run scripts/gen-ue-import.ts ../ledning/ue/prio2-import.csv supabase/imports/ue-prio2-import.sql
import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Ange CSV-fil och SQL-utfil");

function parse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1);
}

const [head, ...rows] = parse(readFileSync(input, "utf8").replace(/\r/g, ""));
const lit = (v: string) => (v === "" ? "NULL" : `$q$${v}$q$`);
const num = (v: string) => (v === "" ? "NULL" : String(Number(v)));
const vals = rows.map((r) => {
  const o: Record<string, string> = {};
  head.forEach((h, i) => (o[h.trim()] = r[i] ?? ""));
  return o;
});

const orgs = vals.map((o) => o.org_number.replace(/\D/g, ""));
if (new Set(orgs).size !== orgs.length) throw new Error("Dubbletter på org.nr i filen");
if (orgs.some((x) => !x)) throw new Error("Rad utan org.nr");

const sql = `-- Import av UE-kandidater (${input.split("/").pop()}): ${vals.length} rader, pipeline 'hittad'.
-- Idempotent: hoppar över rader där org.nr redan finns (jämförs utan bindestreck/mellanslag).
-- Ingen UE får mail eller notis: bara INSERT i subcontractors (inga triggrar skickar något).
WITH src (company_name, org_number, phone, address, trade, team_size, pipeline_status, priority, notes) AS (VALUES
${vals
  .map(
    (o) =>
      `  (${lit(o.company_name)}, ${lit(o.org_number)}, ${lit(o.phone)}, ${lit(o.address)}, ${lit(o.trade)}, ${num(o.team_size)}::int, ${lit(o.pipeline_status)}, ${num(o.priority)}::int, ${lit(o.notes)})`,
  )
  .join(",\n")}
), ins AS (
  INSERT INTO public.subcontractors (company_name, org_number, phone, address, trade, team_size, pipeline_status, priority, notes)
  SELECT s.company_name, s.org_number, s.phone, s.address, s.trade, s.team_size, s.pipeline_status, COALESCE(s.priority, 100), s.notes
  FROM src s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.subcontractors e
    WHERE regexp_replace(COALESCE(e.org_number, ''), '\\D', '', 'g') = regexp_replace(COALESCE(s.org_number, ''), '\\D', '', 'g')
      AND regexp_replace(COALESCE(s.org_number, ''), '\\D', '', 'g') <> ''
  )
  RETURNING id
)
SELECT (SELECT count(*) FROM ins) AS importerade, (SELECT count(*) FROM src) AS i_filen;
`;
writeFileSync(output, sql);
const count = (k: string) => vals.filter((o) => o.trade === k).length;
console.log(`${vals.length} rader; taklaggare ${count("taklaggare")}, platslagare ${count("platslagare")}, bada ${count("bada")}; status ${[...new Set(vals.map((o) => o.pipeline_status))]}`);
