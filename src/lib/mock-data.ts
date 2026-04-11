export type LeadStatus = "cold" | "warm" | "hot" | "customer" | "lost";
export type LeadSource = "field" | "telemarketing" | "scan" | "referral";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  address: string;
  municipality: string;
  region: string;
  buildYear: number;
  roofType: string;
  roofAge: number;
  status: LeadStatus;
  source: LeadSource;
  age: number;
  notes: string;
  hasRoofPermit: boolean;
  lastContact: string | null;
  createdAt: string;
}

export const REGIONS = [
  "Stockholm",
  "Uppsala",
  "Västmanland",
  "Södermanland",
  "Östergötland",
  "Jönköping",
  "Västra Götaland",
  "Skåne",
];

export const MUNICIPALITIES: Record<string, string[]> = {
  Stockholm: ["Norrtälje", "Vallentuna", "Österåker", "Värmdö", "Nacka", "Haninge", "Tyresö", "Huddinge", "Täby", "Danderyd", "Sollentuna", "Sundbyberg"],
  Uppsala: ["Uppsala", "Enköping", "Tierp", "Östhammar", "Knivsta"],
  "Västra Götaland": ["Göteborg", "Mölndal", "Kungälv", "Borås", "Trollhättan"],
  Skåne: ["Malmö", "Lund", "Helsingborg", "Kristianstad", "Ystad"],
};

export const mockLeads: Lead[] = [
  {
    id: "1",
    name: "Erik Johansson",
    phone: "070-123 45 67",
    address: "Storgatan 12, 761 30 Norrtälje",
    municipality: "Norrtälje",
    region: "Stockholm",
    buildYear: 1975,
    roofType: "Betongpannor",
    roofAge: 49,
    status: "warm",
    source: "scan",
    age: 62,
    notes: "Intresserad av offert, ringer tillbaka torsdag",
    hasRoofPermit: false,
    lastContact: "2026-04-09",
    createdAt: "2026-04-05",
  },
  {
    id: "2",
    name: "Maria Lindström",
    phone: "073-456 78 90",
    address: "Björkvägen 8, 184 35 Åkersberga",
    municipality: "Österåker",
    region: "Stockholm",
    buildYear: 1968,
    roofType: "Tegelpannor",
    roofAge: 58,
    status: "hot",
    source: "field",
    age: 55,
    notes: "Vill ha takbyte, besök bokat 15 april",
    hasRoofPermit: true,
    lastContact: "2026-04-10",
    createdAt: "2026-04-02",
  },
  {
    id: "3",
    name: "Anders Bergström",
    phone: "076-234 56 78",
    address: "Industrivägen 3, 186 40 Vallentuna",
    municipality: "Vallentuna",
    region: "Stockholm",
    buildYear: 1982,
    roofType: "Plåttak",
    roofAge: 44,
    status: "cold",
    source: "telemarketing",
    age: 71,
    notes: "",
    hasRoofPermit: false,
    lastContact: null,
    createdAt: "2026-04-08",
  },
  {
    id: "4",
    name: "Karin Nilsson",
    phone: "070-987 65 43",
    address: "Solrosvägen 15, 132 40 Nacka",
    municipality: "Nacka",
    region: "Stockholm",
    buildYear: 1970,
    roofType: "Betongpannor",
    roofAge: 56,
    status: "warm",
    source: "scan",
    age: 48,
    notes: "Behöver taktvätt, kanske takbyte senare",
    hasRoofPermit: false,
    lastContact: "2026-04-07",
    createdAt: "2026-04-03",
  },
  {
    id: "5",
    name: "Lars Eriksson",
    phone: "072-111 22 33",
    address: "Granvägen 22, 187 72 Täby",
    municipality: "Täby",
    region: "Stockholm",
    buildYear: 1960,
    roofType: "Eternit",
    roofAge: 66,
    status: "hot",
    source: "referral",
    age: 73,
    notes: "Granne till befintlig kund, akut takbyte",
    hasRoofPermit: true,
    lastContact: "2026-04-11",
    createdAt: "2026-04-01",
  },
  {
    id: "6",
    name: "Susanne Holm",
    phone: "070-555 66 77",
    address: "Ekebyvägen 4, 182 31 Danderyd",
    municipality: "Danderyd",
    region: "Stockholm",
    buildYear: 1955,
    roofType: "Tegelpannor",
    roofAge: 71,
    status: "customer",
    source: "field",
    age: 65,
    notes: "Takbyte genomfört mars 2026",
    hasRoofPermit: true,
    lastContact: "2026-03-28",
    createdAt: "2026-02-15",
  },
  {
    id: "7",
    name: "Thomas Olsson",
    phone: "073-888 99 00",
    address: "Strandvägen 9, 191 35 Sollentuna",
    municipality: "Sollentuna",
    region: "Stockholm",
    buildYear: 1990,
    roofType: "Betongpannor",
    roofAge: 36,
    status: "cold",
    source: "scan",
    age: 42,
    notes: "Behöver taktvätt",
    hasRoofPermit: false,
    lastContact: null,
    createdAt: "2026-04-10",
  },
  {
    id: "8",
    name: "Anna Svensson",
    phone: "076-444 55 66",
    address: "Lingonvägen 7, 135 40 Tyresö",
    municipality: "Tyresö",
    region: "Stockholm",
    buildYear: 1978,
    roofType: "Plåttak",
    roofAge: 48,
    status: "lost",
    source: "telemarketing",
    age: 58,
    notes: "Valde annan leverantör",
    hasRoofPermit: false,
    lastContact: "2026-04-06",
    createdAt: "2026-03-20",
  },
];
