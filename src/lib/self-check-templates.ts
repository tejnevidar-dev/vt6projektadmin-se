export type SelfCheckFieldType = "checkbox" | "text" | "textarea";

export interface SelfCheckField {
  label: string;
  type: SelfCheckFieldType;
  /** Instruktion som visas ovanför fältet – så att utföraren vet vad som ska kontrolleras. */
  instruction?: string;
  required?: boolean;
}

export interface SelfCheckTemplate {
  key: string;
  name: string;
  description: string;
  /** Övergripande instruktion som visas högst upp i mallen. */
  instructions?: string;
  /** Valfri instruktionsvideo (t.ex. YouTube-länk). */
  videoUrl?: string;
  videoLabel?: string;
  /** Om utföraren måste ladda upp en eller flera bilder för att kunna lämna in. */
  requiresImages?: boolean;
  /** Om mallen ska skickas till beställaren när projektet markeras Klar. */
  sentToClient?: boolean;
  fields: SelfCheckField[];
}

export const SELF_CHECK_TEMPLATES: SelfCheckTemplate[] = [
  {
    key: "tak",
    name: "Takarbete",
    description: "Egenkontroll för takläggning och takbyte.",
    sentToClient: true,
    instructions:
      "Bocka av varje moment när det är utfört och kontrollerat. Använd punkterna nedan som en checklista – läs instruktionen, kontrollera arbetet på plats och bocka sedan av. Notera eventuella avvikelser sist.",
    fields: [
      {
        label: "Råspont",
        type: "checkbox",
        instruction:
          "Kontrollera att råsponten är hel, torr och ordentligt spikad i varje takstol. Inga sprickor, röta eller bulor får finnas. Skarvar ska ligga över bärande virke.",
      },
      {
        label: "Underlagspapp",
        type: "checkbox",
        instruction:
          "Pappen ska vara hel, sträckt och överlappad enligt tillverkarens anvisning (vanligen 10–15 cm i längsskarv, 20 cm i tvärskarv). Inga veck, hål eller dåligt klistrade skarvar.",
      },
      {
        label: "Fotplåtspapp",
        type: "checkbox",
        instruction:
          "Pappen ska vara dragen ner över fotplåten så att vatten leds ut på plåten, inte bakom. Kontrollera att klistring/svetsning är tät hela vägen.",
      },
      {
        label: "Ströläkt",
        type: "checkbox",
        instruction:
          "Ströläkt ska gå i takfallets riktning, vara rakt monterad ovanpå underlagspappen och ge ventilerad luftspalt. Spikad i varje takstol.",
      },
      {
        label: "Bärläkt",
        type: "checkbox",
        instruction:
          "Bärläktens c/c-avstånd ska följa pannans/plåtens anvisning. Kontrollera att läkten är rak, hel och spikad i varje ströläkt.",
      },
      {
        label: "Nockbräda",
        type: "checkbox",
        instruction:
          "Nockbrädan ska sitta centrerat över nocken, vara rak och stabil samt ge rätt höjd för nockpannor/nockplåt.",
      },
      {
        label: "Trekantslist",
        type: "checkbox",
        instruction:
          "Trekantslist ska sitta tätt mot vägg/skorsten och ge rätt vinkel för anslutande beslag. Inga glipor.",
      },
      {
        label: "Vindskivor",
        type: "checkbox",
        instruction:
          "Vindskivor ska vara raka, hela och målade/behandlade. Skarvar tätade och infästning kontrollerad.",
      },
      {
        label: "Fotbräda",
        type: "checkbox",
        instruction:
          "Fotbrädan ska sitta rakt längs takfoten, vara hel och ge stöd åt fotplåten. Kontrollera infästning.",
      },
    ],
  },
  {
    key: "plat",
    name: "Plåtarbete",
    description: "Egenkontroll för plåtarbeten och beslag.",
    sentToClient: true,
    instructions:
      "Gå igenom varje plåtmoment, kontrollera fall, tätningar och infästningar. Bocka av punkterna efterhand och dokumentera avvikelser längst ner.",
    fields: [
      {
        label: "Ränndal",
        type: "checkbox",
        instruction:
          "Ränndalen ska ha jämnt fall, tät falsning och tillräcklig bredd för att klara vattenmängden. Inga skarpa veck eller punktering.",
      },
      {
        label: "Fotplåt",
        type: "checkbox",
        instruction:
          "Fotplåten ska sticka ut i hängrännan, vara monterad med rätt fall och tätad mot underlagspappen.",
      },
      {
        label: "Vindskiveplåt",
        type: "checkbox",
        instruction:
          "Vindskiveplåt ska täcka hela vindskivan, vara tät i skarvar och ha rätt överlapp mot takpanna/plåttak.",
      },
      {
        label: "Underbeslag",
        type: "checkbox",
        instruction:
          "Underbeslag vid skorsten/genomföring ska gå långt nog upp på vägg och under takmaterial för att leda bort vatten.",
      },
      {
        label: "Överbeslag",
        type: "checkbox",
        instruction:
          "Överbeslaget ska täcka underbeslagets ovankant, vara fastsatt i vägg och tätat med fogmassa där det behövs.",
      },
      {
        label: "Takavvattning",
        type: "checkbox",
        instruction:
          "Hängrännor och stuprör ska vara monterade med rätt fall (ca 2–3 mm/m), säkert infästa och leda ut vattnet från husgrunden.",
      },
      {
        label: "Snörasskydd",
        type: "checkbox",
        instruction:
          "Snörasskydd ska monteras enligt tillverkarens krav ovanför entréer, gångar och där snöras kan skada egendom eller person.",
      },
      {
        label: "Takstege",
        type: "checkbox",
        instruction:
          "Takstege ska vara monterad i bärande underlag, ha rätt avstånd från taket och säkrad infästning.",
      },
      {
        label: "Gångbrygga",
        type: "checkbox",
        instruction:
          "Gångbrygga ska vara monterad på fast underlag, ha glidskydd och vara förankrad enligt tillverkarens anvisning.",
      },
      {
        label: "Plåtkvalitet och tjocklek enligt beställning",
        type: "text",
        instruction: "Ange material, kvalitet och tjocklek (t.ex. 0,6 mm aluzink).",
      },
    ],
  },
  {
    key: "stallning",
    name: "Ställning",
    description:
      "Intern egenkontroll för ställning. Skickas inte till beställaren – den är till för ditt eget och arbetsplatsens bästa.",
    sentToClient: false,
    requiresImages: true,
    instructions:
      "Ställningen ska resas av behörig person och kontrolleras innan användning. Börja från marknivå: lägg ut fotplattor på fast underlag, montera ramar och tvärbalkar enligt tillverkarens manual, säkra med diagonalstag, montera arbetsplan, räcken och fotlist samt förankra mot fasaden minst var 4:e meter på höjd. Märk upp ställningen med skylt och datum när den är godkänd. Ladda upp minst en bild som visar den färdiga ställningen samt eventuella kritiska detaljer (förankring, uppstigning, arbetsplan).",
    videoUrl: "https://www.youtube.com/results?search_query=bygga+byggnadsst%C3%A4llning+steg+f%C3%B6r+steg",
    videoLabel: "Se instruktionsvideo: Bygga byggnadsställning",
    fields: [
      {
        label: "Stabil och plan grund (fotplattor)",
        type: "checkbox",
        instruction: "Fotplattor på fast och plant underlag. Använd plank/spik vid behov för att fördela last.",
      },
      {
        label: "Förankringar mot fasad enligt manual",
        type: "checkbox",
        instruction: "Förankra minst var 4:e meter på höjd. Använd godkända ankare i bärande underlag.",
      },
      {
        label: "Arbetsplan komplett (inga glipor, hela plank)",
        type: "checkbox",
        instruction: "Heltäckt arbetsplan utan glipor större än 25 mm. Kontrollera att inget plank är sprucket.",
      },
      {
        label: "Räcken och fotlist på plats",
        type: "checkbox",
        instruction: "Överledare, mellanledare och fotlist på alla sidor som vetter mot fall.",
      },
      {
        label: "Uppstigning säkrad (stege/trappa)",
        type: "checkbox",
        instruction: "Stege eller trappa monterad inomhus i ställningen, fastsatt i topp och botten.",
      },
      {
        label: "Skylt med ställningsbyggare och datum finns",
        type: "checkbox",
        instruction: "Skylt med byggarens namn, företag och godkännandedatum sitter synligt vid uppstigningen.",
      },
    ],
  },
  {
    key: "sakerhet",
    name: "Säkerhet",
    description: "Daglig säkerhetskontroll på arbetsplatsen. Intern – skickas inte till beställaren.",
    sentToClient: false,
    instructions:
      "Sele och fallskydd är livräddande utrustning. Kontrollera selen visuellt varje dag innan användning: leta efter slitage, brännskador, kemikaliepåverkan, trasiga sömmar eller skadade spännen. Justera selen så att bröstrem sitter mitt på bröstet och benslingor är åtdragna men bekväma. D-ringen i ryggen ska sitta mellan skulderbladen. Använd alltid kort kopplingslina (max 1,8 m) med falldämpare och koppla in dig i förankringspunkt ovanför arbetsplatsen.",
    videoUrl: "https://www.youtube.com/results?search_query=anv%C3%A4nda+sele+fallskydd+korrekt",
    videoLabel: "Se instruktionsvideo: Använda fallskyddssele korrekt",
    fields: [
      {
        label: "Sele visuellt kontrollerad (inga skador, sömmar hela)",
        type: "checkbox",
        instruction: "Kontrollera band, sömmar, spännen och D-ring. Kassera selen om någon del visar skada.",
      },
      {
        label: "Sele rätt justerad (bröstrem på bröstet, D-ring mellan skulderblad)",
        type: "checkbox",
        instruction: "Sele ska sitta tätt men bekvämt. Två fingrar ska få plats under banden.",
      },
      {
        label: "Kopplingslina med falldämpare används",
        type: "checkbox",
        instruction: "Använd godkänd lina max 1,8 m med integrerad falldämpare.",
      },
      {
        label: "Förankringspunkt godkänd och ovanför arbetsplatsen",
        type: "checkbox",
        instruction: "Förankringspunkten ska tåla minst 12 kN och helst sitta ovanför axelhöjd.",
      },
      {
        label: "Personlig skyddsutrustning används (hjälm, skor, glasögon)",
        type: "checkbox",
        instruction: "Hjälm med hakrem, halkfria skor med skyddståhätta och skyddsglasögon vid kapning.",
      },
      {
        label: "Avspärrning runt arbetsområde på mark",
        type: "checkbox",
        instruction: "Spärra av området där material eller verktyg kan falla ner.",
      },
      {
        label: "Första hjälpen och brandsläckare tillgängliga",
        type: "checkbox",
        instruction: "Första-hjälpen-väska och brandsläckare ska finnas på plats och vara märkta.",
      },
      {
        label: "Tillbud eller incidenter under dagen",
        type: "textarea",
        instruction: "Dokumentera även mindre tillbud så att vi kan förebygga olyckor.",
      },
    ],
  },
  {
    key: "taktvatt",
    name: "Taktvätt",
    description: "Egenkontroll för taktvätt och takbehandling.",
    sentToClient: true,
    instructions:
      "Dokumentera takytan före och efter tvätt. Bifoga bilder för varje moment och notera eventuella avvikelser.",
    fields: [
      {
        label: "Före bild på takyta",
        type: "checkbox",
        instruction:
          "Ta bilder på takytan innan tvätt påbörjas. Bilderna ska visa hela taket och eventuella problemområden.",
      },
      {
        label: "Inteckning",
        type: "checkbox",
        instruction:
          "Kontrollera och dokumentera eventuella inteckningar eller skador på taket som påverkar arbetet.",
      },
      {
        label: "Efterbild på takyta",
        type: "checkbox",
        instruction:
          "Ta bilder på takytan efter att tvätt är genomförd. Bilderna ska visa resultatet och att hela taket är rent.",
      },
      {
        label: "Bild på eventuell applicerad behandling",
        type: "checkbox",
        instruction:
          "Om någon behandling (t.ex. alg- eller mossbehandling) har applicerats, ta bilder som visar detta.",
      },
      {
        label: "Övrigt",
        type: "textarea",
        instruction: "Notera eventuella avvikelser, kompletterande åtgärder eller annan relevant information.",
      },
    ],
  },
];

export function getSelfCheckTemplate(key: string): SelfCheckTemplate | undefined {
  return SELF_CHECK_TEMPLATES.find((t) => t.key === key);
}

export function getSelfCheckTemplateLabel(key: string): string {
  return getSelfCheckTemplate(key)?.name ?? key;
}

/**
 * Returnerar de egenkontrollmallar som är aktuella för en given jobbtyp.
 * Om ingen jobbtyp anges visas alla mallar för bakåtkompatibilitet.
 */
export function getApplicableTemplates(jobType?: string): SelfCheckTemplate[] {
  if (!jobType) return SELF_CHECK_TEMPLATES;
  switch (jobType) {
    case "roof_cleaning":
      return SELF_CHECK_TEMPLATES.filter(
        (t) => t.key === "taktvatt" || t.key === "sakerhet"
      );
    case "roof_replacement":
      return SELF_CHECK_TEMPLATES.filter(
        (t) => t.key === "tak" || t.key === "plat" || t.key === "stallning" || t.key === "sakerhet"
      );
    case "light_roof_work":
      return SELF_CHECK_TEMPLATES.filter(
        (t) => t.key === "plat" || t.key === "sakerhet"
      );
    default:
      return SELF_CHECK_TEMPLATES;
  }
}
