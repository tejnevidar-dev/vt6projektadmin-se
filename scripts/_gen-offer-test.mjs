import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync } from 'fs';

function sanitize(s){return (s||'').replace(/\r/g,'').replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/\u00A0/g,' ').replace(/\u2022/g,'•');}
function fmtSek(n){const r=Math.round(n);const s=r<0?'-':'';return s+Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' kr';}

const data = {
  offertnr:'2026-1119', offertdatum:'2026-07-02', giltigTom:'2026-08-01',
  betalningsvillkor:'10 dagar netto',
  kundNamn:'Carina Sandsten Seilitz', objektadress:'Vagnsundavägen 355',
  telefon:'0705450283', mail:'carina.sandsten@hotmail.com',
  fastighetsbeteckning:'NORRTÄLJE YXLÖ 1:225',
  intro:'Vi tackar för er förfrågan och offererar enligt följande:',
  rader:[
    'Rivning och sanering av befintligt eternittak',
    'Deponi kopplat till eternittak',
    'Rivning av fotbräda, takavvattning och vindskivor',
    'Montering av ny råspont på hela takytan',
    'Montering av ny fotbräda (färg bestäms i samråd med kund)',
    'Montering av trekantslist',
    'Montering av underlagspapp Mataki Haloten Pro',
    'Montering av fotplåtspapp',
    'Montering av komplett system hängrännor Lindab (färg bestäms i samråd med kund)',
    'Montering av kompletta stuprör Lindab (färg bestäms i samråd med kund)',
    'Montering av fotplåt',
    'Montering av fågelband',
    'Montering av vindskivor (färg bestäms i samråd med kund)',
    'Montering av ströläkt 25x48',
    'Montering av bärläkt 25x48',
    'Montering av nockbräda',
    'Montering av 2-kupiga lertegelpannor Vittinge',
    'Montering av vindskiveplåtar (färg bestäms i samråd med kund)',
    'Montering av nocktätning',
    'Montering av underbeslag skorsten',
    'Montering av bärläktssteg',
    'Montering av glidskydd',
  ].map((b,i)=>({radnr:(i+1)*10,beskrivning:b})),
  entreprenadprisExklMoms:202540, materialkostnad:48000,
  momsProcent:25, rotBelopp:57953, rotEtikett:'(2 ägare)',
  noteringar:[
    'Hantering av eternit ökar kostnaden avsevärt då saneringskostnaden utgör en stor del av entreprenadpriset.',
    'Entreprenören utför inte asbestsanering i egen regi. Sanering och omhändertagande av eternit/asbest utförs via behöriga underentreprenörer med erforderliga utbildningar, tillstånd och certifieringar enligt gällande lagstiftning.',
    'ROT-avdraget i denna offert är beräknat utifrån att fastigheten ägs av två personer.',
  ],
  villkor:[
    {rubrik:'1.1 Offertens giltighet',brodtext:'Offerten gäller i 30 dagar från offertdatum.'},
    {rubrik:'1.2 Betalningsvillkor',brodtext:'Betalningsvillkor: 10 dagar netto.'},
    {rubrik:'1.3 Arbetsstart',brodtext:'Arbetsstart bestäms i samråd med kund.'},
    {rubrik:'1.4 ÄTA-arbeten',brodtext:'Allt arbete som ej är skriftligt nämnt i offerten betraktas som ÄTA-arbete och debiteras med 670 kr/h inkl. moms.'},
    {rubrik:'1.5 Entreprenadansvar',brodtext:'RoslagsTak (VT6 Invest AB) ansvarar för projektet i sin helhet inklusive erforderliga byggställningar, materialleveranser, transporter, avfallshantering, deponikostnader samt övriga åtgärder som krävs för att utföra de arbeten som anges i offerten.'},
    {rubrik:'1.6 ROT-avdrag',brodtext:'ROT-avdraget är preliminärt och förutsätter att beställaren uppfyller Skatteverkets villkor samt har tillgängligt ROT-utrymme.'},
    {rubrik:'1.7 Reducerat eller avslaget ROT-avdrag',brodtext:'Om Skatteverket helt eller delvis avslår ansökan om ROT-avdrag är beställaren skyldig att betala motsvarande belopp till entreprenören.'},
  ],
};

const FOOTER='RoslagsTak (VT6 Invest AB) | Org.nr 559539-3595 | Momsnr SE559539359501 | Godkänd för F-skatt';
const pdf=await PDFDocument.create();
const font=await pdf.embedFont(StandardFonts.Helvetica);
const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
const A4=[595.28,841.89]; const marginX=55, marginTop=55, marginBottom=70;
let page=pdf.addPage(A4); let width=page.getWidth(), height=page.getHeight(); let y=height-marginTop;
const BLACK=rgb(0,0,0), RULE=rgb(0.15,0.15,0.15), MUTED=rgb(0.35,0.35,0.35);
const draw=(t,x,yy,size=10,b=false,c=BLACK)=>page.drawText(sanitize(t),{x,y:yy,size,font:b?bold:font,color:c});
const drawRight=(t,xR,yy,size=10,b=false,c=BLACK)=>{const s=sanitize(t);const f=b?bold:font;const w=f.widthOfTextAtSize(s,size);page.drawText(s,{x:xR-w,y:yy,size,font:f,color:c});};
const hr=(yy,color=RULE,th=0.6)=>page.drawLine({start:{x:marginX,y:yy},end:{x:width-marginX,y:yy},thickness:th,color});
const drawFooter=()=>{const fy=40;page.drawLine({start:{x:marginX,y:fy+14},end:{x:width-marginX,y:fy+14},thickness:0.5,color:RULE});draw(FOOTER,marginX,fy,9,false,MUTED);};
const newPage=()=>{drawFooter();page=pdf.addPage(A4);width=page.getWidth();height=page.getHeight();y=height-marginTop;};
const ensure=(n)=>{if(y-n<marginBottom)newPage();};
const wrap=(text,maxW,size,b=false)=>{const f=b?bold:font;const ps=text.split(/\n/);const out=[];for(const p of ps){if(!p.trim()){out.push('');continue;}const ws=p.split(/\s+/);let c='';for(const w of ws){const t=c?c+' '+w:w;if(f.widthOfTextAtSize(sanitize(t),size)<=maxW)c=t;else{if(c)out.push(c);c=w;}}if(c)out.push(c);}return out;};

draw('ROSLAGSTAK',marginX,y-24,30,true); y-=34;
draw('OFFERT',marginX,y-20,20,true); y-=32;
const colW=(width-marginX*2)/3;
draw(`Offertnr: ${data.offertnr}`,marginX,y,10);
draw(`Offertdatum: ${data.offertdatum}`,marginX+colW,y,10);
draw(`Giltig tom: ${data.giltigTom}`,marginX+colW*2,y,10);
y-=16; draw(`Betalningsvillkor: ${data.betalningsvillkor}`,marginX,y,10); y-=24;
draw('Kund',marginX,y,12,true); y-=16;
for(const [k,v] of [['Namn',data.kundNamn],['Objektadress',data.objektadress],['Telefon',data.telefon],['Mail',data.mail],['Fastighetsbeteckning',data.fastighetsbeteckning]]){if(v){draw(`${k}: ${v}`,marginX,y,10);y-=14;}}
y-=8; hr(y); y-=18;
if(data.intro){draw(data.intro,marginX,y,10);y-=22;}
const colRad=marginX, colBesk=marginX+60;
draw('Rad',colRad,y,10,true); draw('Beskrivning',colBesk,y,10,true); y-=6; hr(y); y-=14;
const beskMax=width-marginX-colBesk;
for(const r of data.rader){const lines=wrap(r.beskrivning,beskMax,10);const needed=Math.max(14,lines.length*13);ensure(needed);draw(String(r.radnr),colRad,y,10);for(let i=0;i<lines.length;i++)draw(lines[i],colBesk,y-i*13,10);y-=needed;}
y-=10;
const moms=Math.round(data.entreprenadprisExklMoms*data.momsProcent/100);
const total=data.entreprenadprisExklMoms+moms; const attB=total-data.rotBelopp;
const rows=[
  {label:'Entreprenadpris exkl. moms',value:fmtSek(data.entreprenadprisExklMoms)},
  {label:'Materialkostnad',value:fmtSek(data.materialkostnad)},
  {label:'Summa exkl. moms',value:fmtSek(data.entreprenadprisExklMoms)},
  {label:`Moms ${data.momsProcent} %`,value:fmtSek(moms)},
  {label:'Totalt inkl. moms',value:fmtSek(total)},
];
if(data.rotBelopp>0){rows.push({label:`Preliminärt ROT-avdrag ${data.rotEtikett}`,value:'-'+fmtSek(data.rotBelopp),rule:true});rows.push({label:'ATT BETALA EFTER ROT',value:fmtSek(attB),bold:true});}
const totH=rows.length*20+14; ensure(totH);
const totLeft=width/2+10, totRight=width-marginX;
page.drawLine({start:{x:totLeft,y:y+6},end:{x:totRight,y:y+6},thickness:0.6,color:RULE});
for(const r of rows){const sz=r.bold?11:10;draw(r.label,totLeft,y-6,sz,r.bold);drawRight(r.value,totRight,y-6,sz,r.bold);y-=20;if(r.rule)page.drawLine({start:{x:totLeft,y:y+8},end:{x:totRight,y:y+8},thickness:0.6,color:RULE});}
newPage();
draw('Övriga noteringar',marginX,y,18,true); y-=24;
for(const n of data.noteringar){const lines=wrap(n,width-marginX*2-14,10);ensure(lines.length*14+4);draw('•',marginX,y,10,true);for(let i=0;i<lines.length;i++)draw(lines[i],marginX+14,y-i*14,10);y-=lines.length*14+4;}
y-=10; ensure(30); draw('Övriga villkor',marginX,y,18,true); y-=22;
for(const v of data.villkor){ensure(30);if(v.rubrik){draw(v.rubrik,marginX,y,11,true);y-=16;}if(v.brodtext){const ls=wrap(v.brodtext,width-marginX*2,10);for(const l of ls){ensure(14);draw(l,marginX,y,10);y-=14;}}y-=8;}
drawFooter();
const bytes=await pdf.save();
writeFileSync('/tmp/offert/out.pdf',bytes);
console.log('OK',bytes.length);
