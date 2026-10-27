import {enrichTicket} from './ticket-details';
export type Passenger={cvRecordId?:string;identitySource?:string;checkedBaggage?:string;cabinBaggage?:string;personalItem?:string;frequentFlyer?:string;name:string;passport:string;ticketNumber:string;nationality:string;birthDate:string;type:string;baggage:string;seat:string;meal:string};
export type Segment={checkedBaggage?:string;cabinBaggage?:string;personalItem?:string;meal?:string;stops?:string;checkInDeadline?:string;fareFamily?:string;notValidBefore?:string;notValidAfter?:string;airline:string;flightNumber:string;from:string;to:string;departureDate:string;departureTime:string;arrivalDate:string;arrivalTime:string;departureTerminal:string;arrivalTerminal:string;cabin:string;bookingClass:string;baggage:string;seat:string;status:string;duration:string;aircraft:string;airlineReference:string;fareBasis:string;notes:string};
export type Ticket={officeId?:string;officeName?:string;sourceCountry?:string;bookingReference:string;ticketNumber:string;airline:string;agency:string;issueDate:string;bookingDate:string;status:string;currency:string;baseFare:string;taxes:string;total:string;paymentMethod:string;contactEmail:string;contactPhone:string;notes:string;extractedText:string;extractionMethod:string;passengers:Passenger[];segments:Segment[];additional:{label:string;value:string}[]};
export const emptyPassenger=():Passenger=>({name:'',passport:'',ticketNumber:'',nationality:'',birthDate:'',type:'',baggage:'',seat:'',meal:''});
export const emptySegment=():Segment=>({airline:'',flightNumber:'',from:'',to:'',departureDate:'',departureTime:'',arrivalDate:'',arrivalTime:'',departureTerminal:'',arrivalTerminal:'',cabin:'',bookingClass:'',baggage:'',seat:'',status:'',duration:'',aircraft:'',airlineReference:'',fareBasis:'',notes:''});
export function emptyTicket():Ticket{return {bookingReference:'',ticketNumber:'',airline:'',agency:'',issueDate:'',bookingDate:'',status:'',currency:'',baseFare:'',taxes:'',total:'',paymentMethod:'',contactEmail:'',contactPhone:'',notes:'',extractedText:'',extractionMethod:'',passengers:[],segments:[],additional:[]};}
const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const datePattern=String.raw`(?:\d{4}-\d{2}-\d{2}|\d{1,2}[ \t/.-]*(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[ \t/.,-]*(?:\d{4}|\d{2})(?!\d)|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}/\d{1,2}/\d{4})`;
export function ticketDate(raw:string):string{let s=raw.trim(),y=0,m=0,d=0,a:RegExpMatchArray|null;if(a=s.match(/^(\d{4})-(\d{2})-(\d{2})$/)){[,y,m,d]=a.map(Number);}else if(a=s.match(/^(\d{1,2})[ \t/.-]*([a-z]+)[ \t/.,-]*(\d{2}|\d{4})$/i)){d=+a[1];m=months.indexOf(a[2].slice(0,3).toLowerCase())+1;y=+a[3];if(y<100)y+=2000;}else if(a=s.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i)){d=+a[2];m=months.indexOf(a[1].slice(0,3).toLowerCase())+1;y=+a[3];}else if(a=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)){d=+a[1];m=+a[2];y=+a[3];}const dt=new Date(Date.UTC(y,m-1,d));return y>=2000&&m&&dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';}
const dates=(s:string)=>[...s.matchAll(new RegExp(datePattern,'gi'))].map(m=>ticketDate(m[0])).filter(Boolean);
function time(s:string):string{const a=s.match(/\b(\d{1,2})\s*:\s*(\d{2})\s*(am|pm)?/i);if(!a)return '';let h=+a[1];if(a[3])h=h%12+(a[3].toLowerCase()==='pm'?12:0);return h<24&&+a[2]<60?String(h).padStart(2,'0')+':'+a[2]:'';}
function clean(s:string){return s.replace(/\s+/g,' ').trim();}
function nameClean(s:string){return clean(s).replace(/^(?:MR|MS|MRS|MISS)\.?\s+/i,'').replace(/\s+(?:MR|MS|MRS|MISS)$/i,'').trim();}
function after(text:string,label:string,pattern:string){return text.match(new RegExp('(?:'+label+')\\s*[:#.-]?\\s*('+pattern+')','i'))?.[1]||'';}
const airlines:Record<string,string>={SV:'Saudia',ET:'Ethiopian Airlines',PR:'Philippine Airlines',XY:'flynas',OV:'SalamAir',G9:'Air Arabia','6E':'IndiGo'};
const airports:Record<string,string>={MNL:'Manila',RUH:'Riyadh',JED:'Jeddah',ADD:'Addis Ababa',BJM:'Bujumbura',NBO:'Nairobi',DAC:'Dhaka',DEL:'Delhi',SHJ:'Sharjah',ELQ:'Gassim',MCT:'Muscat'};
function cityCodes(s:string){return [...s.matchAll(/\b(MNL|RUH|JED|ADD|BJM|NBO|DAC|DEL|SHJ|ELQ|MCT)\b/g)].map(m=>m[1]);}
export function parseTicket(raw:string):Ticket{
 const t=emptyTicket();const text=raw.replace(/\r/g,'').replace(/\f/g,'\n').replace(/[\u200e\u200f]/g,'').replace(/[∶：]/g,':');const lines=text.split('\n').map(l=>l.trimEnd());t.extractedText=text.slice(0,200000);
 for(const [i,line] of lines.entries())if(/RESERVATION CODE|BOOKING REF(?:ERENCE)?|PNR\/BOOKING[ \t]+REF\.|Reservation Number|Airline PNR/i.test(line)){
  const tail=line.replace(/^.*?(?:RESERVATION CODE|BOOKING REFERENCE|BOOKING REF\.?|PNR\/BOOKING[ \t]+REF\.|Reservation Number|Airline PNR)\s*:?/i,'');
  const candidates=(tail+'\n'+lines.slice(i+1,i+4).join('\n')).match(/\b[A-Z0-9]{6}(?:-\d+)?\b/g)||[];
  const ref=candidates.find(c=>!['TICKET','NUMBER','AIRLINE','ISSUED','GALILE','AGENCY','FLIGHT'].includes(c));if(ref){t.bookingReference=ref;break;}
 }
 const allTickets=[...text.matchAll(/\b\d{3}[- ]?\d{10}\b/g)].map(m=>m[0].replace(/\D/g,''));t.ticketNumber=allTickets[0]||'';
 t.issueDate=ticketDate(after(text,'ISSU(?:E|ED) DATE',datePattern));t.bookingDate=ticketDate(after(text,'Booking Date',datePattern));
 t.status=/\bCONFIRMED\b|Ok to fly/i.test(text)?'Confirmed':'';
 t.airline=clean(after(text,'ISSUING AIRLINE','[^\\n]+'));t.agency=clean(after(text,'ISSUING AGENT(?! LOCATION)|Agency Name','[^\\n]+'));
 t.contactEmail=text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||'';
 t.contactPhone=clean(after(text,'Contact Mobile|Contact Phone|Phone','[+0-9][0-9 ()-]{6,30}'));
 t.paymentMethod=clean(after(text,'FORM OF PAYMENT|Form of Payment','[^\\n]+'));
 const addPerson=(name:string,passport='',ticketNumber='')=>{name=nameClean(name).replace(/\s+null$/i,'');if(!name||name.length<3||/^(?:Name|Passenger|Reference|Economy|Flight|Ticket|Booking)\b/i.test(name))return;const old=t.passengers.find(p=>nameClean(p.name).toLowerCase()===name.toLowerCase());if(old){if(passport)old.passport=passport;if(ticketNumber)old.ticketNumber=ticketNumber;return;}t.passengers.push({...emptyPassenger(),name,passport,ticketNumber});};
 // Trip.com provides first and last names in a table, and a complete name in baggage details.
 if(/Booking No\.\s*\d{10,}/i.test(text)){
  t.additional.push({label:'Booking number',value:after(text,'Booking No\\.','\\d{10,}')});
  for(const m of text.matchAll(/^[ \t]*([A-Z][A-Z '-]+)[ \t]*\((?:Adults?|Children?|Infants?)\)/gm))addPerson(m[1]);
  if(!t.passengers.length){const m=text.match(/([A-Z][A-Z '-]+)\s*\(First[\s\S]{0,120}?name\)\s*([A-Z][A-Z '-]+)\s*\(Last name\)/);if(m)addPerson(m[1]+' '+m[2]);}
  t.bookingReference=text.match(/\b\d{3}[- ]\d{10}\s+([A-Z0-9]{6})\b/)?.[1]||t.bookingReference;
 }
  for(const line of lines){const m=line.match(/^[ \t]*([A-Z][A-Z '-]+\/[A-Z][A-Z '-]+?)(?:[ \t]+(?:MS|MR|MRS))?(?:[ \t]{2,}(.+))?$/);if(!m||/NOTICE|IDENTIFICATION|ISSUING|TAXES|CHARGES|CLASS|COUNTRY|PNR|BOOKING/.test(m[1]))continue;
  const cols=(m[2]||'').trim().split(/ {2,}/);const p=cols.find(c=>/^[A-Z0-9]{5,20}$/.test(c)&&/\d/.test(c)&&!/^\d{13}$/.test(c))||'';addPerson(m[1],p,cols.find(c=>/^\d{13}$/.test(c))||'');
 }
 for(const m of text.matchAll(/\b(\d{13})\s*-\s*([A-Z][A-Z '-]+\/[A-Z][A-Z '-]+?)(?:\s+(?:MS|MR|MRS))?\s*$/gm))addPerson(m[2],'',m[1]);
 const named=after(text,'PASSENGER NAME','[^\\n]+');if(named&&!/Flight|Seats|Baggage/i.test(named))addPerson(named);
 const prepared=text.match(/PREPARED[ \t]+FOR[ \t]*:?[ \t]*(?:\n)?[ \t]*((?:(?:Ms|Mr|Mrs)\.?[ \t]+)?[A-Z][A-Za-z /'-]+)(?:\n|$)/i);if(prepared&&!t.passengers.length)addPerson(prepared[1]);
 for(const line of lines){const m=line.match(/^[ \t]*(?:MRS|MISS|MS|MR)\.?[ \t]{1,2}([A-Z][A-Za-z '-]+?)(?=[ \t]{2,}|[ \t]+XY[ \t]*\d|[ \t]+\d+[xX×]?[ \t]*\d*[ \t]*[kK][gG]|$)/i);if(m)addPerson(m[1]);}
 if(!t.passengers.length){const row=lines.findIndex(l=>/Passenger:/.test(l));if(row>=0){const col=lines[row].indexOf('Passenger:');const next=lines.slice(row+1).find(l=>l.trim());if(next)addPerson(next.slice(col));}}
 if(!t.passengers.length){const i=lines.findIndex(l=>/e-ticket number/i.test(l));if(i>0){const n=lines.slice(0,i).reverse().find(l=>/^\s*(?:Mr|Ms|Mrs)\.?\s+/i.test(l));if(n)addPerson(n);}}
 if(!t.issueDate&&/Airline PNR/.test(text))t.issueDate=dates(text)[0]||'';
 const explicitPassport=after(text,'Passport (?:Number|No\\.?)','[A-Z0-9]{5,20}');if(explicitPassport&&t.passengers.length===1)t.passengers[0].passport=explicitPassport;
 if(t.passengers.length===1&&t.ticketNumber&&!t.passengers[0].ticketNumber)t.passengers[0].ticketNumber=t.ticketNumber;
 // Each flight number creates a separate leg. Repeated numbers in baggage tables are ignored.
 const flightMatches=[...text.matchAll(/\b(SV|ET|PR|XY|OV|G9|6E)[ \t]*(\d{1,4})(?![\d:])/g)];
 const unique=new Set<string>();for(const fm of flightMatches){const number=fm[1]+fm[2];const pos=fm.index!,prev=text.slice(Math.max(0,pos-450),pos),next=text.slice(pos,pos+1800);const s=emptySegment();s.flightNumber=number;s.airline=airlines[fm[1]]||t.airline;s.status=t.status;s.notes=clean(next.slice(0,900));
  if(/Booking No\./i.test(text)){
   const start=text.lastIndexOf('Departure',pos);const block=text.slice(Math.max(0,start),pos);const dep=block.match(/Departure\s+([^\n]+)/i)?.[1]||'';const arr=block.match(/Arrival\s+([^\n]+)/i)?.[1]||'';s.departureDate=dates(dep)[0]||'';s.arrivalDate=dates(arr)[0]||'';s.departureTime=time(dep);s.arrivalTime=time(arr);s.from=clean(dep.split(/,\s*\d{4},/)[1]||'');s.to=clean(arr.split(/,\s*\d{4},/)[1]||'');s.cabin='Economy';
  }else if(/Travel Itinerary/.test(text)&&fm[1]==='G9'){
   const start=text.lastIndexOf('\n',pos-1);const block=text.slice(Math.max(0,start-155),pos+650).split(/Extras/)[0];const codes=cityCodes(block.split(/\n\s*(?:G9\d|Sector)/)[0]);s.from=airports[codes[0]]||'';s.to=airports[codes[1]]||'';const ds=dates(block);s.departureDate=ds[0]||'';s.arrivalDate=ds[1]||'';const times=[...block.matchAll(/\b\d{2}:\d{2}\b/g)].map(m=>time(m[0]));s.departureTime=times[0]||'';s.arrivalTime=times[1]||'';s.cabin='Economy';
  }else if(fm[1]==='OV'){
   const block=prev+next.slice(0,180);const codes=cityCodes(next.slice(0,190));s.from=airports[codes[0]]||'';s.to=airports[codes[1]]||'';s.departureDate=dates(prev).at(-1)||'';s.arrivalDate=s.departureDate;const times=[...next.slice(0,190).matchAll(/\b\d{1,2}\s*:\s*\d{2}\b/g)].map(m=>time(m[0]));s.departureTime=times[0]||'';s.arrivalTime=times[1]||'';
  }else if(/TRAVEL DATE\s+AIRLINE/.test(text)){
   const block=text.slice(Math.max(0,pos-280),pos+1350);const ds=dates(block);s.departureDate=ds[0]||'';s.arrivalDate=ds[1]||s.departureDate;const times=[...next.slice(0,600).matchAll(/\b\d{1,2}:\d{2}\b/g)].map(m=>time(m[0]));s.departureTime=times[0]||'';s.arrivalTime=times[1]||'';
   const routeLines=prev.split('\n').slice(-4);const route=routeLines.find(l=>/MANILA|ADDIS ABABA/.test(l))||'';const cols=route.trim().split(/ {2,}/);const a=cols.findIndex(c=>/MANILA|ADDIS ABABA/.test(c));if(a>=0){s.from=cols[a];s.to=cols[a+1]||'';}s.cabin='Economy';
  }else if(/FLIGHT\s+DEPART\s+ARRIVE/.test(text)){
   const block=next.split(/This is not a boarding pass/)[0];const codes=cityCodes(block.split(/\n\s*(?:G9\d|Sector)/)[0]);s.from=airports[codes[0]]||'';s.to=airports[codes[1]]||'';const ds=dates(block);s.departureDate=ds[0]||'';s.arrivalDate=ds[1]||'';const tm=[...block.matchAll(/\b\d{1,2}:\d{2}\s*(?:am|pm)/gi)].map(m=>time(m[0]));s.departureTime=tm[0]||'';s.arrivalTime=tm[1]||'';s.cabin='Economy';
  }else if(/Coupon status:/.test(text)){
   const ds=dates(text.slice(Math.max(0,pos-1000),pos));s.departureDate=ds.at(-1)||'';s.arrivalDate=s.departureDate;s.from=prev.match(/\d{2}:\d{2}\s*-\s*([^\n]+?)(?= {2,}|$)/m)?.[1]||'';s.to=next.match(/Arrival:\s*\d{2}:\d{2}\s*-\s*([^\n]+)/)?.[1]||'';s.departureTime=time(prev.slice(prev.lastIndexOf('Departure:')));s.arrivalTime=time(next.slice(next.indexOf('Arrival:')));
  }else if(/Flight #\s+From/.test(text)){
   const block=text.slice(text.indexOf('Itinerary Information'));s.from=/Nairobi/.test(block)?'Nairobi':'';s.to=/Jeddah/.test(block)?'Jeddah':'';const ds=dates(block);s.departureDate=ds[0]||'';s.arrivalDate=ds[1]||'';const tm=[...block.matchAll(/\b\d{2}:\d{2}\b/g)].map(m=>time(m[0]));s.departureTime=tm[0]||'';s.arrivalTime=tm[1]||'';
  }else if(fm[1]==='XY'){
   const block=text.slice(0,text.indexOf('Passenger Name')>0?text.indexOf('Passenger Name'):pos+350);s.from=/Addis\s+ababa/i.test(block)?'Addis Ababa':'';s.to=/Jeddah/i.test(block)?'Jeddah':'';s.departureDate=dates(block)[0]||'';s.arrivalDate=s.departureDate;const dep=block.match(/Addis\s+ababa[^\n]*\n\s*(\d{2}:\d{2})/i);s.departureTime=dep?.[1]||'';s.arrivalTime=block.match(/Jeddah\s+(\d{2}:\d{2})/i)?.[1]||'';if(!s.departureTime){const tm=[...block.matchAll(/\b\d{2}:\d{2}\b/g)].map(m=>time(m[0]));s.departureTime=tm.at(-1)||'';s.arrivalTime=tm.length>1?tm[0]:'';}
  }else if(fm[1]==='PR'){
   s.from=/MANILA/i.test(prev+next)?'Manila':'';s.to=/RIYADH/i.test(next)?'Riyadh':'';const ds=dates(prev);s.departureDate=ds.at(-1)||'';if(!s.departureDate){const short=text.slice(Math.max(0,pos-1200),pos).match(/(?:THU|FRI|SAT|SUN|MON|TUE|WED|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+(\d{1,2})\s*([A-Z]{3})/i);const year=t.issueDate.slice(0,4)||text.match(/DATE:(?:\d{2}\/){2}(\d{4})/)?.[1];if(short&&year)s.departureDate=ticketDate(short[1]+' '+short[2]+' '+year);}const block=(prev+next).slice(-1900);const tm=[...block.matchAll(/\b\d{2}:\d{2}\b/g)].map(m=>time(m[0]));s.departureTime=tm[0]||prev.match(/\b(\d{2})(\d{2})\s*$/m)?.slice(1).join(':')||'';s.arrivalTime=tm[1]||next.match(/ARR[^\n]*?\s(\d{2})(\d{2})\s/)?.slice(1).join(':')||'';if(s.departureDate)s.arrivalDate=s.departureDate;
  }else if(fm[1]==='6E'){
   const block=prev.slice(-180)+next.slice(0,480);const ds=dates(block);s.departureDate=ds[0]||'';s.arrivalDate=ds[1]||'';const route=next.match(/\n\s*\d{1,2}\s+[A-Z]{3}\s+\d{4}\s+(.+?)\s+(\d{2}:\d{2})\s+\d{2}:\d{2}\s+(.+?)\s*\n/);if(route){s.from=clean(route[1]);s.to=clean(route[3]);s.departureTime=route[2];}s.arrivalTime=time(prev.slice(-120));
  }
  s.baggage=next.match(/(?:Baggage\s*(?::|Allowance)\s*)(\d+\s*(?:PC|pieces?|kg|K)\b)/i)?.[1]||'';s.airlineReference=after(next,'Airline Reservation Code|AIRLINE RES CODE','[A-Z0-9]{6}');s.fareBasis=after(next,'Fare Basis','[A-Z0-9]+(?:[\\/-][A-Z0-9]+)*');if(/^(?:Ok|Not|Fare|Booking)$/i.test(s.fareBasis))s.fareBasis='';s.cabin=s.cabin||(/ECONOMY/i.test(prev.slice(-100)+next.slice(0,400))?'Economy':'');if(!s.departureDate&&fm[1]==='XY')s.departureDate=dates(text)[0]||'';if(!s.arrivalDate&&s.departureDate&&fm[1]==='XY')s.arrivalDate=s.departureDate;const legKey=[number,s.departureDate,s.from,s.to].join('|');if(!unique.has(legKey)){unique.add(legKey);t.segments.push(s);}
 }
 if(!t.airline)t.airline=[...new Set(t.segments.map(s=>s.airline).filter(Boolean))].join(' / ');
 for(const [key,label] of [['total','TOTAL AMOUNT|Total'],['baseFare','Fare'],['taxes','Taxes']] as const){const m=text.match(new RegExp('(?:'+label+')\\s+(?:([A-Z]{3})\\s+([0-9,]+\\.\\d{2})|([0-9,]+\\.\\d{2})\\s+([A-Z]{3}))','i'));if(m){t[key]=(m[2]||m[3]).replace(/,/g,'');t.currency=(m[1]||m[4]).toUpperCase();}}
 for(const line of lines){const m=line.trim().match(/^(Invoice Number|IATA Number|Tour Code|Issuing Agent Location|Endorsement\s*\/\s*Restrictions|PIN)\s*:?\s{2,}(.+)$/i);if(m)t.additional.push({label:m[1],value:clean(m[2])});}
 const baggage=lines.filter(l=>/Checked baggage|Checked Baggage|Hand Baggage|Carry-on baggage|30Kg|30 Kg|1 × 20kg/i.test(l)).map(clean).join(' | ');if(baggage)t.additional.push({label:'Baggage / الأمتعة',value:baggage.slice(0,3000)});
 return enrichTicket(t,text);
}
