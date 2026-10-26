import type {Ticket,Segment} from './ticket-parser';

const flat=(s:string)=>s.replace(/\s+/g,' ').trim();
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const bagValue=(s:string)=>flat(s).replace(/\s*\|\s*/g,' | ');
const useful=(s:string)=>s&&!/^(?:-|—|N\/A|null|Required|Check-in Required)$/i.test(s);
function cells(line:string){return [...line.matchAll(/\S(?:.*?\S)?(?= {2,}|$)/g)].map(m=>({text:m[0],start:m.index!}));}
function grid(lines:string[],labels:RegExp[]){
 const at=lines.findIndex(l=>labels.every(r=>r.test(l)));if(at<0)return null;
 const starts=labels.map(r=>lines[at].search(r));
 return {at,columns:starts.map((start,i)=>({start,end:starts[i+1]??10000})),rows:lines.slice(at+1)};
}
function col(lines:string[],start:number,end:number){return lines.map(l=>cells(l).filter(c=>c.start>=Math.max(0,start-10)&&c.start<(end===10000?10000:end-10)).map(c=>c.text).join(' ')).filter(Boolean);}
function field(lines:string[],label:RegExp):string{
 for(let i=0;i<lines.length;i++){
  const m=label.exec(lines[i]);if(!m)continue;
  const tail=lines[i].slice(m.index+m[0].length).replace(/^[ :]+/,'');
  if(tail&&useful(tail)){const value=cells(tail)[0]?.text||tail;return flat(value);}
  const x=m.index;
  for(const next of lines.slice(i+1,i+4)){const value=next.slice(Math.max(0,x-2)).trim();if(!value)continue;if(value.match(/^(?:Cabin|Seat|Baggage|Booking|Fare|Not Valid|Terminal|Time)\b/i))break;return flat(cells(value)[0]?.text||value);}
 }
 return '';
}
function tableValue(lines:string[],label:RegExp){
 const i=lines.findIndex(l=>cells(l).some(c=>label.test(c.text)));if(i<0)return '';
 const columns=cells(lines[i]);const c=columns.findIndex(c=>label.test(c.text));if(c<0)return '';
 const start=columns[c].start,end=columns[c+1]?.start??10000;
 return col(lines.slice(i+1,i+4),start,end)[0]||'';
}
function terminal(s:string){const named=s.match(/\b(?:North|South|Main)[ \t]+Terminal\b/i)?.[0];if(named)return named;return s.match(/\b(?:Terminal\s*([0-9]+[A-Z]?|[A-Z])|T([0-9]+|N))\b/i)?.slice(1).find(Boolean)||s.match(/\b(?:North|South|Main) Terminal\b/i)?.[0]||'';}
function money(s:string){const m=s.match(/(?:\b([A-Z]{3})\s*(\d[\d,]*\.\d{2})|(\d[\d,]*\.\d{2})\s*([A-Z]{3})\b)/);return m?{amount:(m[2]||m[3]).replace(/,/g,''),currency:m[1]||m[4]}:null;}
function numTime(s:string){return s.match(/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/i)?.[0]||'';}
function routeColumn(rows:string[]){const out=[];for(const row of rows){if(/^(?:Time|Terminal|\d{1,2}:|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\d{1,2}[ /-])/.test(row))break;out.push(row);}return flat(out.join(' '));}
function nextYearDate(s:string){const m=s.match(/\b(\d{1,2})\s*([a-z]{3})\s*(\d{2}|\d{4})\b/i);if(!m)return '';const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];const month=months.indexOf(m[2].toLowerCase())+1;return month?`${m[3].length===2?'20':''}${m[3]}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';}

export function enrichTicket(t:Ticket,text:string):Ticket{
 const lines=text.split('\n');
 function extra(label:string,value:string){value=flat(value);if(!useful(value)||t.additional.some(a=>a.label.toLowerCase()===label.toLowerCase()&&a.value===value))return;t.additional.push({label,value:value.slice(0,3000)});}
 function common(key:keyof Ticket,label:RegExp){const v=tableValue(lines,label);if(v&&typeof t[key]==='string')(t as any)[key]=v;}
 // Tables carry header positions, so a blank cell cannot consume a neighbour's value.
 if(!t.issueDate){const value=tableValue(lines,/^Issue date:?$/i)||tableValue(lines,/^Date of Issue$/i);const d=nextYearDate(value);if(d)t.issueDate=d;const long=value.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);if(long){const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(long[2].slice(0,3).toLowerCase())+1;if(month)t.issueDate=`${long[3]}-${String(month).padStart(2,'0')}-${long[1].padStart(2,'0')}`;}}
 extra('مكان الإصدار',tableValue(lines,/^Issue place:?$/i));
 extra('Galileo PNR',tableValue(lines,/^Galileo PNR$/i));
 for(const [title,label] of [['Invoice number',/Invoice Number/i],['IATA number',/IATA Number/i],['Tour code',/Tour Code/i],['مكان وكالة الإصدار',/Issuing (?:Agent )?Location/i],['اسم الوكالة',/Agency Name/i],['اسم الموظف',/Agent Name/i],['القيود والتعديلات',/Endorsement\s*\/\s*Restrictions/i]] as const){const value=field(lines,label);if(value)extra(title,value);}
 if(!t.agency){const first=lines.find(l=>l.trim())?.trim()||'';if(/\b(?:Voyage|Travel|Tours)\b/i.test(first)&&first.length<100&&!/Thank you|Booking/i.test(first))t.agency=first;}
 const fareGrid=grid(lines,[/FARE\s+details/i,/\bFARE\b(?!\s+details)/i,/TAXES\s*&\s*FEES/i,/\bTOTAL\b/i,/PAYMENT SUMMARY/i]);
 if(fareGrid){const row=fareGrid.rows.find(l=>/\d+\.\d{2}/.test(l));if(row){for(const [key,index] of [['baseFare',1],['taxes',2],['total',3]] as const){const v=money(row.slice(fareGrid.columns[index].start-1,fareGrid.columns[index].end-1));if(v){t[key]=v.amount;t.currency=v.currency;}}}}
 const receiptStart=lines.findIndex(l=>/Receipt And Payment Details/i.test(l));
 if(receiptStart>=0){const receipt=lines.slice(receiptStart).join('\n').split(/Positive identification|Important Legal Notices/i)[0];const base=receipt.match(/\bFare\s+(USD|SAR|GBP|EUR)\s+(\d+\.\d{2})/i),total=receipt.match(/\bTotal\s+(USD|SAR|GBP|EUR)\s+(\d+\.\d{2})/i);if(base){t.baseFare=base[2];t.currency=base[1].toUpperCase();}if(total){t.total=total[2];t.currency=total[1].toUpperCase();}const taxes=receipt.split(/Taxes\/Fees\/Carrier-Imposed/i)[1]?.split(/Fare Calculation Line/i)[0]||'';const amounts=[...taxes.matchAll(/\b(USD|SAR|GBP|EUR)\s+(\d+\.\d{2})/g)].filter(m=>m[1]===t.currency);const cents=amounts.reduce((sum,m)=>sum+Math.round(Number(m[2])*100),0);if(amounts.length&&t.baseFare&&t.total&&Math.abs(Math.round(Number(t.total)*100)-Math.round(Number(t.baseFare)*100)-cents)<=1){t.taxes=(cents/100).toFixed(2);extra('تفاصيل الضرائب والرسوم',taxes);}}
 // Preserve explicit transfer and baggage-through instructions.
 for(const line of lines){if(/\bTransfer:|Baggage not checked through|layover at|Transit in/i.test(line))extra('الترانزيت وإعادة تسليم الأمتعة',line);}

 const frames=text.split(/This is not a boarding pass/i);
 const etHeader=lines.find(l=>/TRAVEL DATE\s+AIRLINE\s+DEPARTURE\s+ARRIVAL/i.test(l));
 for(const [index,s] of t.segments.entries()){
  const rx=new RegExp('\\b'+escape(s.flightNumber.slice(0,2))+'[ \\t]*'+escape(s.flightNumber.slice(2))+'(?!\\d)');
  const matches=[...text.matchAll(new RegExp(rx.source,'g'))];const p=matches[0]?.index??0;
  const frame=frames.find(f=>rx.test(f))||text.slice(Math.max(0,p-500),p+1600);const fl=frame.split('\n');
  s.departureTerminal=s.departureTerminal||terminal(s.from);s.arrivalTerminal=s.arrivalTerminal||terminal(s.to);
  if(etHeader&&/TRAVEL DATE\s+AIRLINE/.test(text)){
   const cols=grid([etHeader],[/TRAVEL DATE/i,/AIRLINE/i,/DEPARTURE/i,/ARRIVAL/i,/OTHER NOTES/i])!.columns;
   const rows=fl.filter(l=>!l.includes(etHeader));
   // Ignore the document metadata preceding the first timetable.
   const first=rows.findIndex(l=>/Departure:\s*\d|\d{1,2}\s+[A-Za-z]{3}\s+\d{2}\s+ETHIOPIAN/i.test(l));
   const body=first>=0?rows.slice(first):rows;
   const dc=col(body,cols[2].start,cols[2].end),ac=col(body,cols[3].start,cols[3].end),nc=col(body,cols[4].start,cols[4].end);const carrier=col(body,cols[1].start,cols[1].end);const op=carrier.findIndex(v=>/Operated by:/i.test(v));if(op>=0)extra(`شركة التشغيل — ${s.flightNumber}`,carrier.slice(op+1).filter(v=>/^[A-Z ]+$/.test(v)).join(' '));
   const from=routeColumn(dc),to=routeColumn(ac);if(from&&!/DEPARTURE|Booking|DATE/.test(from))s.from=from;if(to&&!/ARRIVAL|Booking|DATE/.test(to))s.to=to;
   s.departureTerminal=terminal(dc.join(' '));s.arrivalTerminal=terminal(ac.join(' '));
   s.airlineReference=field(nc,/Airline Reservation Code/i)||s.airlineReference;
   const cabin=field(nc,/Cabin/i);if(cabin){s.cabin=cabin.split('/')[0].trim();s.bookingClass=cabin.split('/')[1]?.trim()||nc[nc.findIndex(l=>/Cabin/.test(l))+1]?.match(/^[A-Z]$/)?.[0]||'';}
   const seat=field(nc,/Seat Number/i);if(/^\d{1,3}[A-Z]$/.test(seat))s.seat=seat;
   const bag=field(nc,/Baggage Allowance/i);if(/^\d+\s*(?:PC|pieces?|kg|K)\b/i.test(bag))s.baggage=bag;
   const basis=field(nc,/Fare Basis/i);if(/^[A-Z0-9]+(?:[/-][A-Z0-9]+)*$/.test(basis))s.fareBasis=basis;
   if(nc.some(l=>/CHECK-IN/.test(l)))extra(`إجراءات السفر — ${s.flightNumber}`,'Check-in required');
  }else if(/FLIGHT\s+DEPART\s+ARRIVE\s+CABIN\/SEAT/.test(text)){
   const header=lines.find(l=>/FLIGHT\s+DEPART\s+ARRIVE\s+CABIN\/SEAT/.test(l))!;
   const columns=grid([header],[/FLIGHT/i,/DEPART/i,/ARRIVE/i,/CABIN\/SEAT/i,/BAGGAGE/i,/FLIGHT INFO/i])!.columns;
   const cab=col(fl,columns[3].start,columns[3].end),bag=col(fl,columns[4].start,columns[4].end),info=col(fl,columns[5].start,columns[5].end);
   const start=fl.findIndex(l=>rx.test(l));const body=fl.slice(start);const dc=col(body,columns[1].start,columns[1].end),ac=col(body,columns[2].start,columns[2].end);
   s.departureTerminal=terminal(dc.join(' '));s.arrivalTerminal=terminal(ac.join(' '));
   const cv=cab.find(v=>/Economy\s*\//i.test(v));if(cv){s.cabin=cv.split('/')[0].trim();s.bookingClass=cv.split('/')[1].trim();}
   s.baggage=bag.join(' ').match(/\b\d+\s*(?:pieces?|PC|kg)\b/i)?.[0]||s.baggage;
   const basis=body.join(' ').match(/\b[A-Z][A-Z0-9]{3,}\/[A-Z0-9]{2,}\b/)?.[0]||'';if(basis)s.fareBasis=basis;
  }else if(/Flight #\s+From\s+To/.test(text)){
   const g=grid(lines,[/Flight #/i,/\bFrom\b/i,/\bTo\b/i,/\bDepart\b/i,/\bArrive\b/i,/\bSeat\b/i,/\bInfo\b/i]);
   if(g){const dc=col(g.rows,g.columns[1].start,g.columns[1].end),ac=col(g.rows,g.columns[2].start,g.columns[2].end),info=col(g.rows,g.columns[6].start,10000);s.from=flat(dc.join(' '));s.to=flat(ac.join(' '));s.departureTerminal=terminal(s.from);s.arrivalTerminal=terminal(s.to);s.baggage=field(info,/Baggage\s*:/i)||s.baggage;const cabin=field(info,/Class\s*:/i);const cm=cabin.match(/^([A-Z])-([A-Za-z ]+)$/);if(cm){s.bookingClass=cm[1];s.cabin=cm[2];}s.duration=field(info,/Duration\s*:/i);s.aircraft=field(info,/Aircraft\s*:/i);const ai=info.findIndex(l=>/Aircraft\s*:/i.test(l));if(ai>=0&&info[ai+1]&&!/:/.test(info[ai+1]))s.aircraft=flat(s.aircraft+' '+info[ai+1]);}
  }else if(/Coupon status:/.test(text)){
   s.baggage=tableValue(lines,/Baggage's:/i)||s.baggage;s.bookingClass=tableValue(lines,/Fare class:/i)||s.bookingClass;s.fareBasis=tableValue(lines,/^Fare basis:/i)||s.fareBasis;extra('فئة التعرفة',tableValue(lines,/^Fare family:/i));
  }else if(s.flightNumber.startsWith('PR')){
   const nearby=text.slice(Math.max(0,p-1300),p+1500);const exact=nearby.match(new RegExp(escape(s.flightNumber.slice(0,2))+'\\s*'+escape(s.flightNumber.slice(2))+'\\/([A-Z]+)\\/([A-Z])'));if(exact){s.cabin=exact[1];s.bookingClass=exact[2];}else{s.bookingClass=nearby.match(/ECONOMY\s*\(([A-Z])\)/)?.[1]||s.bookingClass;}
   const ts=[...nearby.matchAll(/\bTERMINAL\s+([0-9]+[A-Z]?|[A-Z])\b/g)].map(m=>m[1]);s.departureTerminal=ts[0]||s.departureTerminal;s.arrivalTerminal=ts[1]||s.arrivalTerminal;
   s.airlineReference=nearby.match(/(?:AIRLINE RES CODE\s*:|AIRLINES REF:)\s*([A-Z0-9]{6})/i)?.[1]||s.airlineReference;
   s.aircraft=nearby.match(/\bAIRBUS\s+[A-Z0-9-]+/i)?.[0]||'';s.duration=nearby.match(/\b\d+\s*HR\s*\d+\s*MIN\b/i)?.[0]||'';
  }else if(s.flightNumber.startsWith('6E')){
   const nearby=text.slice(Math.max(0,p-100),p+360);s.aircraft=nearby.match(/\((A\d{3}|B\d{3})\)/)?.[1]||'';const close=nearby.match(/\b\d{1,2}\s+[A-Z]{3}\s+\d{4}\s+.+?\s+\d{2}:\d{2}\s+(\d{2}:\d{2})/);if(close){s.checkInDeadline=close[1];extra(`إغلاق تسجيل السفر — ${s.flightNumber}`,close[1]);}
  }else if(s.flightNumber.startsWith('OV')){const nearby=text.slice(Math.max(0,p-100),p+100);s.duration=nearby.match(/\d+\s*hrs\s*\d+\s*mins/i)?.[0]||'';if(/VALUE FARE/i.test(nearby))s.fareFamily='VALUE FARE';if(/VALUE FARE/i.test(nearby))extra(`فئة التعرفة — ${s.flightNumber}`,'VALUE FARE');
  }else if(s.flightNumber.startsWith('XY')){
   const cabin=text.match(/Outbound\s*\|[^|]+\|\s*([^|]+)/i)?.[1]||text.match(/Cabin:\s*([A-Za-z ]+?)(?=Status:|$)/im)?.[1];if(cabin)s.cabin=flat(cabin);
   s.duration=text.match(/(?:Duration:|buration:|Total travel time:)\s*([^\n]+?)(?=cabin:|Cabin:|Status:|$)/im)?.[1]?.trim()||'';
   s.departureTerminal=text.match(/\bMain Terminal\b/i)?.[0]||s.departureTerminal;
   s.arrivalTerminal=text.match(/King Abdulaziz[^\n]*?Terminal\s+(\d+)/i)?.[1]||s.arrivalTerminal;
  }
  if(s.flightNumber.startsWith('G9')){
   const before=text.slice(Math.max(0,p-200),p).split('\n').reverse().find(l=>/^\s*\d+h\s*\d+m\s*$/.test(l));if(before)s.duration=flat(before);
   const extras=text.slice(text.indexOf('Extras')).split('\n');const header=extras.find(l=>/Sector\s+\w{3}\/\w{3}/.test(l));if(header){const cols=cells(header);const column=cols[index+1];if(column){const hand=cells(extras.find(l=>/Hand Baggage/.test(l))||'')[index+1]?.text||'';const checked=cells(extras.find(l=>/Checked Baggage/.test(l))||'')[index+1]?.text||'';const meal=cells(extras.find(l=>/^\s*Meal\s+/.test(l))||'')[index+1]?.text||'';s.checkedBaggage=checked;s.cabinBaggage=hand;s.personalItem=hand.match(/\d+ Personal Item[^|]*/i)?.[0]||'';s.meal=useful(meal)?meal:'';if(checked||hand)s.baggage=[checked&&'Checked: '+checked,hand&&'Cabin: '+hand].filter(Boolean).join(' | ');if(useful(meal)){extra(`الوجبة — ${s.flightNumber}`,meal);if(t.passengers.length===1)t.passengers[0].meal=[t.passengers[0].meal,`${s.flightNumber}: ${meal}`].filter(Boolean).join(' | ');}}}
  }
  if(s.baggage&&!s.checkedBaggage&&!/^Checked:/.test(s.baggage))s.checkedBaggage=s.baggage;
  s.notes=field(fl,/^[ \t]*NOTES[ \t]*:/i);
  s.stops=s.stops||fl.join(' ').match(/\b(?:NON-STOP|\d+ stops?)\b/i)?.[0]||'';
 }
 // Passenger services are read from their own row, never from the neighbouring passenger.
 const passengerHeader=lines.findIndex(l=>/PASSENGER\s+BAGGAGE\s+SEAT\s+MEAL/.test(l)||/Pax Name\s+Meal\(s\)\s+Baggage/.test(l));
 if(passengerHeader>=0){
  const header=lines[passengerHeader];const specs=/Pax Name/.test(header)?[/Pax Name/,/Meal\(s\)/,/Baggage/]:[/PASSENGER/,/BAGGAGE/,/SEAT/,/MEAL/,/OTHER/];const starts=specs.map(r=>header.search(r));
  for(const [rowIndex,rowLine] of lines.entries()){if(rowIndex<=passengerHeader||!(/^(?:MS|MR|MRS)$/i.test(cells(rowLine)[0]?.text||'')))continue;const nearby=[lines[rowIndex-1],rowLine,lines[rowIndex+1]].filter(Boolean).join(' | ');extra(`صف مسافر بلا اسم واضح — ${rowIndex-passengerHeader}`,nearby);}
  for(const person of t.passengers){const key=person.name.toUpperCase().replace(/^(?:MRS|MS|MR)\s+/,'');const normal=(v:string)=>flat(v).toUpperCase().replace(/^(?:MS|MR)\s+/,'').replace(/^MRS\s+/,'');const i=lines.findIndex((l,n)=>n>passengerHeader&&normal(cells(l)[0]?.text||'')===key);if(i<0)continue;
   if(/Pax Name/.test(header)){const row=cells(lines[i]);person.meal=row[1]?.text||'';person.baggage=row[2]?.text||'';person.checkedBaggage=person.baggage;}
   else{const row=cells(lines[i]);const bagColumn=(line:string)=>cells(line).find(c=>Math.abs(c.start-starts[1])<12)?.text||'';const mealColumn=(line:string)=>cells(line).find(c=>Math.abs(c.start-starts[3])<12)?.text||'';const useRow=bagColumn(lines[i])?i:i-1;const bags=[...new Set(lines.slice(useRow,i+3).map(bagColumn).filter(v=>/\d\s*kg|\d+\s*×/i.test(v)))];person.baggage=bags.join(' | ');person.cabinBaggage=bags.find(v=>/Hand baggage/i.test(v))||'';person.checkedBaggage=bags.find(v=>/×/.test(v))||'';person.meal=mealColumn(lines[useRow]);const seat=cells(lines[i]).find(c=>Math.abs(c.start-starts[2])<5)?.text||'';if(/^[0-9]{1,3}[A-Z]$/.test(seat))person.seat=seat;}

  }
 }
 if(/Booking No\./.test(text)){
  const sections=lines.map((l,i)=>({l,i})).filter(({l})=>/^[ \t]*[A-Za-z '-]+-[A-Za-z '-]+,\s*[A-Za-z]+\s+\d/.test(l));
  for(const [n,segment] of t.segments.entries()){
   const start=sections[n]?.i;const last=start===undefined?-1:lines.findIndex((l,i)=>i>start&&/Important information/.test(l));const block=start===undefined?lines:lines.slice(start,sections[n+1]?.i??(last>=0?last:undefined));
   const blockText=block.join('\n');
   for(const [key,label] of [['personalItem','Personal item'],['cabinBaggage','Carry-on baggage'],['checkedBaggage','Checked baggage']] as const){
    const part=blockText.split(new RegExp('\\b'+label+'\\b','i'))[1]?.split(/Personal item|Carry-on baggage|Checked baggage|Important information/i)[0]||'';
    const value=part.split('\n').map(flat).find(Boolean)||'';
    if(value&&/\d/.test(value))segment[key]=value;
    const dim=part.match(/Dimensions[\s\S]*?(?:cm|centimeters)/i)?.[0];if(dim)extra(`الأبعاد — ${label} — ${segment.flightNumber}`,dim);
    if(part.trim())extra(`قواعد الأمتعة — ${label} — ${segment.flightNumber}`,part);
   }
  }
  for(const person of t.passengers){person.type=text.match(new RegExp(escape(person.name)+'\\s*\\((Adults?|Children?|Infants?)\\)','i'))?.[1]||person.type;person.baggage=[...new Set(t.segments.flatMap(s=>[s.checkedBaggage,s.cabinBaggage,s.personalItem]).filter(Boolean))].join(' | ');}
 }

 if(/Your Flight Details/.test(text)&&t.passengers.length===1){const row=lines.find(l=>/\bXY\s*\d+/.test(l)&&l.includes(t.passengers[0].name));if(row){t.passengers[0].baggage=row.match(/\b\d+[Xx]\d+Kg\b/)?.[0]||'';t.passengers[0].cabinBaggage=t.passengers[0].baggage;}}
 extra('حالة الدفع',field(lines,/Payment Status/i));
 extra('عنوان وكالة السفر',field(lines,/Agency Address/i));
 extra('خدمات خاصة',field(lines,/Special Svc[ \t]*:/i));
 // Retain document identifiers and source snippets, but never invent missing amounts.
 if(t.passengers.length===1&&t.passengers[0].baggage===''){const values=[...new Set(t.segments.map(s=>s.baggage).filter(Boolean))];if(values.length===1)t.passengers[0].baggage=values[0];}
 for(const s of t.segments){if(t.passengers.length){for(const key of ['checkedBaggage','cabinBaggage','personalItem'] as const){const values=t.passengers.map(p=>p[key]||'');if(!s[key]&&values[0]&&values.every(v=>v===values[0]))s[key]=values[0];}}s.notValidBefore=field((frames.find(f=>new RegExp('\\b'+s.flightNumber.slice(0,2)+'\\s*'+s.flightNumber.slice(2)+'(?!\\d)').test(f))||'').split('\n'),/Not Valid Before\s*:?/i);s.notValidAfter=field((frames.find(f=>new RegExp('\\b'+s.flightNumber.slice(0,2)+'\\s*'+s.flightNumber.slice(2)+'(?!\\d)').test(f))||'').split('\n'),/Not Valid After\s*:?/i);}
 if(t.passengers.length===1){const p=t.passengers[0];for(const key of ['checkedBaggage','cabinBaggage','personalItem'] as const){const vals=t.segments.map(s=>s[key]||'');const unique=[...new Set(vals.filter(Boolean))];if(!p[key]&&unique.length)p[key]=unique.length===1?unique[0]:t.segments.filter(s=>s[key]).map(s=>`${s.flightNumber}: ${s[key]}`).join(' | ');}}
 for(const p of t.passengers){if(!p.checkedBaggage&&p.baggage&&!/Hand|Carry-on|Cabin/i.test(p.baggage))p.checkedBaggage=p.baggage;}
 if(t.passengers.some(p=>p.checkedBaggage||p.cabinBaggage)||t.segments.some(s=>s.checkedBaggage||s.cabinBaggage))t.additional=t.additional.filter(a=>a.label!=='Baggage / الأمتعة');
 return t;
}
