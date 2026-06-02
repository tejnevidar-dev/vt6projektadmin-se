export type SelfCheckFieldType = "checkbox" | "text" | "textarea";

export interface SelfCheckField {
  label: string;
  type: SelfCheckFieldType;
  required?: boolean;
}

export interface SelfCheckTemplate {
  key: string;
  name: string;
  description: string;
  fields: SelfCheckField[];
}

export const SELF_CHECK_TEMPLATES: SelfCheckTemplate[] = [
  {
    key: "tak",
    name: "Takarbete",
    description: "Egenkontroll för takläggning och takbyte.",
    fields: [
      { label: "Underlagspapp är hel och korrekt monterad", type: "checkbox" },
      { label: "Strö- och bärläkt enligt ritning", type: "checkbox" },
      { label: "Takpannor/plåt monterade enligt tillverkarens anvisningar", type: "checkbox" },
      { label: "Nockpannor och vindskivor täta", type: "checkbox" },
      { label: "Genomföringar tätade (skorsten, ventilation)", type: "checkbox" },
      { label: "Hängrännor och stuprör monterade och justerade", type: "checkbox" },
      { label: "Snörasskydd monterade enligt krav", type: "checkbox" },
      { label: "Material från (leverantör/batch)", type: "text" },
      { label: "Avvikelser och åtgärder", type: "textarea" },
    ],
  },
  {
    key: "plat",
    name: "Plåtarbete",
    description: "Egenkontroll för plåtarbeten och beslag.",
    fields: [
      { label: "Plåtkvalitet och tjocklek enligt beställning", type: "text" },
      { label: "Fotplåt monterad korrekt", type: "checkbox" },
      { label: "Vinkelränna tätad och fallande", type: "checkbox" },
      { label: "Väggbeslag och fönsterbleck täta", type: "checkbox" },
      { label: "Falsar utförda enligt standard", type: "checkbox" },
      { label: "Inga skarpa kanter eller skador på ytbehandling", type: "checkbox" },
      { label: "Avvikelser och åtgärder", type: "textarea" },
    ],
  },
  {
    key: "sakerhet",
    name: "Säkerhet",
    description: "Daglig säkerhetskontroll på arbetsplatsen.",
    fields: [
      { label: "Personlig skyddsutrustning används (hjälm, sele, skor)", type: "checkbox" },
      { label: "Fallskydd monterat och kontrollerat", type: "checkbox" },
      { label: "Avspärrning runt arbetsområde på mark", type: "checkbox" },
      { label: "Stegar och uppgångar säkrade", type: "checkbox" },
      { label: "Verktyg och material säkrade mot fall", type: "checkbox" },
      { label: "Första hjälpen och brandsläckare tillgängliga", type: "checkbox" },
      { label: "Tillbud eller incidenter under dagen", type: "textarea" },
    ],
  },
  {
    key: "stallning",
    name: "Ställning",
    description: "Kontroll av byggnadsställning innan användning.",
    fields: [
      { label: "Ställning rest av behörig person", type: "checkbox" },
      { label: "Skylt med ställningsbyggare och datum finns", type: "checkbox" },
      { label: "Förankringar kontrollerade", type: "checkbox" },
      { label: "Arbetsplan komplett (inga glipor, hela plank)", type: "checkbox" },
      { label: "Räcken och fotlist på plats", type: "checkbox" },
      { label: "Uppstigning säkrad (stege/trappa)", type: "checkbox" },
      { label: "Stabil och plan grund (fotplattor)", type: "checkbox" },
      { label: "Senaste besiktningsdatum", type: "text" },
      { label: "Avvikelser och åtgärder", type: "textarea" },
    ],
  },
];

export function getSelfCheckTemplate(key: string): SelfCheckTemplate | undefined {
  return SELF_CHECK_TEMPLATES.find((t) => t.key === key);
}

export function getSelfCheckTemplateLabel(key: string): string {
  return getSelfCheckTemplate(key)?.name ?? key;
}
