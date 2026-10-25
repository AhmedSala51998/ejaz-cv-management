import {validMeasurement} from './measurements';
import type {CV} from './fields';
import {normalizePassport} from './fields';
import {normalizeNationality,labeledNationality} from './countries';
const labels:Record<string,string[]>={name:["worker’s name","worker's name",'workers name','full name','name in full','name of applicant','applicant name','name'],passport:['passport details number','passport no','passport number','passport #','passport no.'],nationality:['nationality'],job:['job description','post applied','post applied for','apply for','occupation','position desired','position applied','function','position'],salary:['monthly salary','salary'],contract:['contract period'],birthDate:['dateof birth','date of birth','birth date','dateof bith'],age:['real age','age'],birthPlace:['place of birth'],religion:['religion'],marital:['maritial status','civil status','marital status','social status'],children:['no of children','no. of childern','number of kids','no. of children','number of children'],height:['heigth','height','length','height/weight'],weight:['weight'],education:['education level','educational attainment','academic qualification','education','educational leve','education qualifications'],phone:['contact number','mobile no','mobile number','phone number','telephone','tel. number','contact no','contact no.','whats app #'],address:['living town','living place','provincial address','residential address','complete address','address','current address'],issueDate:['date of issuance','date de délivrance','date de delivrance','date of issue','issue date','release date','issue'],expiryDate:['date d’expiration','date expiration','valable jusqu’au','date of expiry','date of exp.','date of expiration','valid until','expiry date','expiry'],issuePlace:['place of iss.','issue place','place of issue'],english:['english'],arabic:['arabic'],relative:['next of kin name','one of the relativ'],relativePhone:['next of kin number'],notes:['remarks','remark','notes']};
const strip=(s:string)=>s.replace(/[\u0600-\u06ff\u0750-\u077f\uFB50-\uFDFF\uFE70-\uFEFF]/g,'').replace(/[\u0000-\u0008\u200e\u200f\u202a-\u202e]/g,'').replace(/(^|\s)\/(?=\s|$)/g,'$1').replace(/\s+/g,' ').trim();
const norm=(s:string)=>strip(s).replace(/^[^a-z]+/i,'').toLowerCase().replace(/[:.#|：/ -]+$/,'').trim();
const known=new Set([...Object.values(labels).flat(),'duration','country','position','speaking','writing','level','personal information','passport details','language & skills','work experience','name','number','gender','health status','blood type','allergies','next of kin','contact information','previous employment abroad','language known','language & education','language and education','qualifications','activities','details of candidate','reference no','new/experience','country of employment','status','personal photo','abroad experience','language level'].map(norm));
const valid=(s:string)=>!!s&&!known.has(norm(s))&&!/^[:|.#–-]+$/.test(s);
function acceptable(key:string,value:string){
 if(!valid(value))return false;
 if(['address','birthPlace','education','religion','issuePlace'].includes(key)&&/^(?:date of|place of|full name|passport|marital|contract period|no\. of)/i.test(value))return false;
 if(/Date$/.test(key))return validDate(value);
 if(key==='religion')return /^[A-Za-z\u0600-\u06ff][A-Za-z\u0600-\u06ff ().'’-]+$/.test(value);
 if(key==='job')return /^[A-Za-z\u0600-\u06ff][A-Za-z\u0600-\u06ff /().'’&-]+$/.test(value);
 if(key==='nationality')return !!normalizeNationality(value)||/BANGLADESH(?:I)?/i.test(value);
 if(key==='name')return !/^[\s/|:.-]/.test(value)&&/[a-z\u0600-\u06ff]/i.test(value)&&!/^(?:all|full name|name)$/i.test(value);
 if(key==='passport')return /\b[A-Z]{0,3}\d{5,12}[A-Z]?\b/i.test(value);
 if(key==='experience'&&/^(?:خارج البلاد|خارج البلد|previous employment abroad|overseas experience|country|period)$/i.test(value.trim()))return false;
 if(key==='age')return /^\d{2,3}(?:\s*(?:YEARS?(?: OLD)?|YRS?))?$/i.test(value.trim())&&parseInt(value)>=16&&parseInt(value)<=100;
 if(key==='height'||key==='weight')return validMeasurement(key,value);
 if(key==='salary')return /\d/.test(value);
 if(key==='children')return /^(?:\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten|none|nil)(?:\s*(?:childs?|children|kids?))?$/i.test(value.trim());
 if(key==='marital')return /^(?:single|married|marrieed|divorced|widowed)$/i.test(value.trim());
 if(['english','arabic'].includes(key)&&(value.match(/\b(?:poor|fair|good|fluent|excellent|basic|beginner|average|intermediate|advanced)\b/gi)||[]).length>1)return false;
 if(['english','arabic'].includes(key))return /^(?:yes|no|good|fair|fluent|fullent|poor|excellent|average|basic|beginner|normal|none|little|very good|intermediate|advanced|not fluent|fairly can|not at all|some)(?:\s|$)/i.test(value)&&value.length<45;
 if(key==='phone'||key==='relativePhone')return /^[+\d][\d\s().-]*(?:\s*\([A-Z]+\))?$/.test(value.replace(/^[. :–-]+/,''));
 return true;
}
const fieldBoundary=new RegExp('\\b(?:'+Object.entries(labels).filter(([key])=>key!=='name').flatMap(([,list])=>list).filter(l=>l.length>4&&!['english','arabic'].includes(l)).sort((a,b)=>b.length-a.length).map(l=>l.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?=\\s|[:/#.]|$)','i');
const startsField=new RegExp('^(?:'+Object.values(labels).flat().sort((a,b)=>b.length-a.length).map(l=>l.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?=\\s|[:/]|$)','i');
function trimNextField(value:string){const clean=strip(value).replace(/^[\s/:|.-]+/,'');const next=clean.search(fieldBoundary);return (next>=0?clean.slice(0,next):clean).replace(/[\s/:|.-]+$/,'').trim();}
// OCR emits individual words; combine only nearby words on the same baseline.
export function groupTextCells(items:any[]){
 const rows:{y:number;cells:any[]}[]=[];
 for(const c of items.filter(i=>i.str?.trim())){let row=rows.find(r=>Math.abs(r.y-c.transform[5])<Math.max(3,Math.min(5,(c.height||10)*.45)));if(!row){row={y:c.transform[5],cells:[]};rows.push(row);}row.cells.push(c);}
 return rows.flatMap(r=>{const out:any[]=[];for(const c of r.cells.sort((a,b)=>a.transform[4]-b.transform[4])){const previous=out.at(-1),gap=previous?c.transform[4]-previous.transform[4]-previous.width:Infinity;if(previous&&gap>=-2&&gap<Math.min(previous.height||10,c.height||10)*.8){previous.str+=' '+c.str;previous.width=c.transform[4]+c.width-previous.transform[4];}else out.push({...c,transform:[...c.transform]});}return out;});
}
export function textRows(items:any[]){
 const rows:{y:number,cells:any[]}[]=[];for(const c of items.filter(i=>i.str?.trim())){const y=c.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<Math.max(2,Math.min(4,(c.height||10)*.3)));if(!row){row={y,cells:[]};rows.push(row);}row.cells.push(c);}
 return rows.sort((a,b)=>b.y-a.y).map(r=>r.cells.sort((a,b)=>a.transform[4]-b.transform[4]).map(c=>c.str).join('  ')).join('\n');
}
export function parseText(text:string):CV{
 const d:CV={};text=text.replace(/\bMARITAL[ \t]*\n[ \t]*STATUS\b/gi,'MARITAL STATUS');const rawLines=text.split('\n').flatMap(line=>line.split(new RegExp('\\s{2,}(?='+fieldBoundary.source+')','i'))).filter(line=>strip(line));const lines=rawLines.map(strip);
 for(const[k,ls]of Object.entries(labels)){
  for(const label of [...ls].sort((a,b)=>b.length-a.length)){
   const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   const re=new RegExp('^'+escaped+'(?:\\s*[:#：]\\s*[-:]?\\s*|\\s+[-:]?\\s*)(.+)$','i');
   for(let i=0;i<lines.length;i++){
    if(rawLines[i].includes('/')&&norm(rawLines[i].split('/')[0])===norm(label)){const next=lines[i+1]||'';if(!startsField.test(next)&&!fieldBoundary.test(next)&&!known.has(norm(next))&&!/^(?:experience|knowledge of language|skills|country|period|duration)\b/i.test(next)&&acceptable(k,next)){d[k]=next;break;}}
    if(norm(lines[i])===norm(label)){let next=lines[i+1]||'';if(acceptable(k,next))d[k]=next;}
    const m=lines[i].match(re);if(m){const value=trimNextField(m[1]);if(acceptable(k,value))d[k]=value;}
    if(d[k])break;
   }
   if(d[k])break;
  }
 }
 if(!d.passport){const m=text.match(/(?:PASSPORT DETAILS?|PASSPORT INFORMATION)[\s\S]{0,350}?\bNUMBER\s*[:#]?\s*([A-Z]{0,3}\d{5,12}[A-Z]?)\b/i);if(m)d.passport=m[1];}
 if(d.passport){const m=d.passport.match(/\b[A-Z0-9]{6,12}\b/i);d.passport=m?normalizePassport(m[0]):'';}
 const remarks=text.match(/remarks?\s*:?\s*([\s\S]*)/i);if(remarks)d.notes=remarks[1].trim().slice(0,12000);
 const selectedMarital=markedMarital(text.split('\n').find(l=>/marital status|social status/i.test(l))||'');if(selectedMarital)d.marital=selectedMarital;
 if(d.age)d.age=d.age.match(/\d{1,3}/)?.[0]||'';
 if(d.salary){d.currency=/USD|\$/i.test(d.salary)?'USD':/SAR|SR|ريال/i.test(d.salary)?'SAR':'';d.salary=d.salary.match(/[\d,]+(?:\.\d+)?/)?.[0]?.replace(/,/g,'')||'';}
 const employment=text.match(/PREVIOUS EMPLOYMENT(?: ABROAD)?([\s\S]*?)(?:WORK EXPERIENCE|Skills\s*&\s*Experience|REMARKS|$)/i);
 if(/FIRST TIMER/i.test(text)||employment&&/\bNIL\b/i.test(employment[1]))d.experience='FIRST TIMER';
 if(!d.nationality){for(const n of ['FILIPINO','ETHIOPIA','BURUNDIAN','BANGLADESH','KENYAN','UGANDAN','INDIAN','SRI LANKAN'])if(text.toUpperCase().includes(n)){d.nationality=n;break;}}
 const skills:string[]=[];for(const line of lines){const m=line.match(/^(Cleaning and Washing|Taking Care of the Old|Old People Care|Care of the Eldery|Cleaning|Cooking|Washing|Ironing|Sewing|Driving|Infant Care|Child Care|Kids Care|Baby Sitting|Children Care|Laundry|Arabic Cooking|Elderly Care|Baby Care)\b\s*[:| -]*\s*(YES|OK|GOOD|FAIR|BASIC|LITTLE|EXCELLENT|☒|✓|✔)\b/i);if(m)skills.push(skillLabel(m[1])+( /^(GOOD|FAIR|BASIC|LITTLE|EXCELLENT)$/i.test(m[2])?' ('+m[2].toUpperCase()+')':' '+m[2].toUpperCase()));}
 if(skills.length)d.skills=[...new Set(skills)].join('، ');
 if(d.marital)d.marital=d.marital.replace(/marrieed/i,'MARRIED');
 if(d.children){const nums=['zero','one','two','three','four','five','six','seven','eight','nine','ten'];const word=d.children.toLowerCase().match(/^[a-z]+/)?.[0];d.children=word&&nums.includes(word)?String(nums.indexOf(word)):String(parseInt(d.children,10)||0);}
 if(d.name)d.name=d.name.replace(/^[\s/|:.-]+|[\s/|:.-]+$/g,'').trim();
 if(d.nationality){const m=d.nationality.match(/FILIPINO|PHILIPPINES|ETHIOPIA(?:N)?|BURUNDI(?:AN)?|BANGLADESH(?:I)?|KENYA(?:N)?|UGANDA(?:N)?|INDIAN|INDIA|SRI LANKAN|SRI LANKA/i);if(m)d.nationality=m[0];}
 if(!d.job){const m=text.match(/HOUSE WORKER|HOUSEMAID|HOUSE MAID|DOMESTIC HELPER/i);if(m)d.job=m[0];}
 if(!d.religion||/height|weight|position/i.test(d.religion)){const m=text.match(/NON[ -]MUSLIM|ROMAN CATHOLIC|MUSLIM|ISLAM/i);if(m)d.religion=m[0];}
 if(d.phone){d.phone=d.phone.replace(/^[. :–-]+/,'').replace(/\s*\([A-Z]+\)$/,'');if(!/^[+\d][\d\s().-]{5,}$/.test(d.phone))delete d.phone;}
 if(d.education&&/^th$/i.test(d.education))delete d.education;
 if(!d.education){const m=text.match(/(?:ACADEMIC QUALIFICATION)[\s\S]{0,45}?(\d+)\s+(Passed)/i);if(m)d.education=m[1]+'th '+m[2];}
 const dates=readLabeledDates(text);Object.assign(d,dates);const mrz=passportMRZDates(text);for(const k of ['birthDate','expiryDate'])if(!validDate(d[k]||'')&&mrz[k])d[k]=mrz[k];Object.assign(d,readEmployment(text));
 const labeled=labeledNationality(text);if(labeled)d.nationality=labeled;
 if(d.marital&&/single/i.test(d.marital)&&/married/i.test(d.marital))d.marital='';
 for(const k of Object.keys(d))if(!valid(d[k]))delete d[k];
 return d;
}
export function spatial(items:any[]):CV{
 const out:CV={};items=items.map(c=>{if(!/^marital$/i.test(strip(c.str||'')))return c;const continuation=items.find(v=>/^status$/i.test(strip(v.str||''))&&c.transform[5]-v.transform[5]>0&&c.transform[5]-v.transform[5]<Math.max(24,(c.height||10)*2.5)&&Math.abs(v.transform[4]-c.transform[4])<8);return continuation?{...c,str:'Marital Status'}:c;});const cells=groupTextCells(items).filter(i=>i.str?.trim()).map(i=>({raw:i.str,text:strip(i.str.split(/[\u0600-\u06ff\u0750-\u077f\uFB50-\uFDFF\uFE70-\uFEFF]/)[0]),x:i.transform[4],y:i.transform[5],w:i.width,h:Math.abs(i.height||10)})).filter(i=>i.text);
 const stops=new Set([...known,'number','next of kin','skin color','other languages','washing','cleaning','cooking','children care','sewing','previous employment abroad','period','country','gender','qualifications','name']);
 for(const[k,ls]of Object.entries(labels)){
  for(const label of [...ls].sort((a,b)=>b.length-a.length)){const cell=cells.find(c=>norm(c.text)===norm(label)||(c.raw.includes('/')&&norm(c.raw.split('/')[0])===norm(label)));if(!cell)continue;
   const row=cells.filter(c=>c!==cell&&Math.abs(c.y-cell.y)<(k==='marital'?Math.max(12,cell.h*1.4):Math.max(3.5,Math.min(cell.h,c.h)*.5))&&c.x>=cell.x+cell.w-2).sort((a,b)=>a.x-b.x);
   const parts:string[]=[];let last=cell.x+cell.w;
   for(const c of row){if(stops.has(norm(c.text))||fieldBoundary.test(c.text)&&trimNextField(c.text)===''||c.x-last>(parts.length?35:145))break;if(valid(c.text))parts.push(trimNextField(c.text));last=c.x+c.w;}
   if(parts.length&&acceptable(k,parts.join(' '))){out[k]=parts.join(' ');if(k==='notes'){const first=row.find(c=>valid(c.text));const continuation=first&&cells.filter(c=>cell.y-c.y>5&&cell.y-c.y<25&&Math.abs(c.x-first.x)<20&&valid(c.text)).sort((a,b)=>b.y-a.y)[0];if(continuation)out[k]+=' '+continuation.text;}break;}
   const above=cells.filter(c=>c!==cell&&c.y-cell.y>3&&c.y-cell.y<Math.max(24,cell.h*2.2)&&c.x>=cell.x-5&&c.x<cell.x+180&&valid(c.text)).sort((a,b)=>a.y-b.y);
   if(['phone','address','salary','age'].includes(k)){const v=above.find(c=>k==='phone'?/^[+\d][\d\s()-]{6,}$/.test(c.text):k==='age'?/^\d{1,3}$/.test(c.text):k==='salary'?/^\d+(?:SR|SAR|USD|\$)$/i.test(c.text):/^[A-Z][A-Z .,-]{2,}$/i.test(c.text));if(v){out[k]=v.text;break;}}
   const below=cells.filter(c=>cell.y-c.y>4&&cell.y-c.y<Math.max(32,cell.h*2.5)&&Math.abs(c.x+c.w/2-cell.x-cell.w/2)<50&&!stops.has(norm(c.text))).sort((a,b)=>(cell.y-a.y)-(cell.y-b.y));
   if(below[0]&&acceptable(k,below[0].text)&&['name','address','salary','contract','height','weight'].includes(k)){out[k]=below[0].text;break;}
   // No aligned value: preserve the text parser's result. 
  }
 }
 if(!out.name){const names=['first name','middle name','family name'].map(label=>{const c=cells.find(i=>norm(i.text)===label);if(!c)return '';return cells.filter(i=>i.x>c.x+c.w-2&&Math.abs(i.y-c.y)<3).sort((a,b)=>a.x-b.x)[0]?.text||'';});if(names[0])out.name=names.filter(Boolean).join(' ');}
 const skillNames=['Care of the Eldery','Taking Care of the Old','Old People Care','Cleaning and Washing','Wash & Iron','Cleaning','Cooking','Washing','Ironing','Sewing','Driving','Infant Care','Child Care','Kids Care','Baby Sitting','Children Care','Laundry','Arabic Cooking','Elderly Care','Baby Care','Shopping'];
 const skillItems=items.flatMap(i=>{const matches=[...String(i.str||'').matchAll(/\b(?:Cleaning|Washing|Ironing|Kids Care|Baby Care)\b/gi)];if(matches.length<2||/\band\b/i.test(i.str))return [i];return matches.map(m=>({...i,str:m[0],transform:[...i.transform.slice(0,4),i.transform[4]+i.width*m.index!/i.str.length,i.transform[5]],width:i.width*m[0].length/i.str.length}));});
 const skillCells=[...skillItems.filter(i=>i.str?.trim()).map(i=>({raw:i.str,text:strip(i.str),x:i.transform[4],y:i.transform[5],w:i.width,h:Math.abs(i.height||10)})),...cells];
 out.skills=skillNames.flatMap(name=>{const c=skillCells.find(i=>norm(i.text).replace(/\s/g,'')===norm(name).replace(/\s/g,''));if(!c)return [];
 if(['Cleaning','Washing'].includes(name)&&cells.some(v=>/^Cleaning and Washing$/i.test(v.text)&&Math.abs(v.y-c.y)<4&&c.x>=v.x-2&&c.x<v.x+v.w))return [];
 const next=cells.filter(i=>i.x>=c.x+c.w-2&&Math.abs(i.y-c.y)<Math.max(3.5,Math.min(c.h,i.h)*.5)).sort((a,b)=>a.x-b.x)[0];
 const below=skillCells.filter(i=>i.y<c.y&&c.y-i.y<Math.max(22,c.h*3.5)&&Math.abs(i.x+i.w/2-c.x-c.w/2)<Math.max(16,c.w/2)&&/^(YES|OK|NO)$/i.test(i.text)).sort((a,b)=>b.y-a.y)[0];
 const mark=items.some(i=>/^[☒✓✔vV]$/.test((i.str||'').trim())&&i.transform[4]<c.x&&c.x-i.transform[4]<38&&i.transform[5]-c.y>=-3&&i.transform[5]-c.y<20);
 if(next&&/^(NO|NOT GOOD|NONE|NIL)$/i.test(next.text))return [];
 if(next&&/^(SOMETHING|BASIC|LITTLE|FAIR|GOOD|EXCELLENT)$/i.test(next.text))return skillLabel(name).split('، ').map(n=>n+' ('+next.text.toUpperCase()+')');
 return mark||next&&/^(YES|OK|☒|✓|✔||v)$/i.test(next.text)||below&&/^(YES|OK)$/i.test(below.text)?[skillLabel(name)]:[];
 }).join('، ');
 const country=cells.find(c=>norm(c.text)==='country'&&cells.some(p=>norm(p.text)==='position'&&Math.abs(p.y-c.y)<4));if(country){const row=cells.filter(c=>country.y-c.y>5&&country.y-c.y<25).sort((a,b)=>a.x-b.x);const position=cells.find(c=>norm(c.text)==='position'&&Math.abs(c.y-country.y)<4),duration=cells.find(c=>norm(c.text)==='duration'&&Math.abs(c.y-country.y)<4);if(position&&duration){const value=row.find(c=>Math.abs(c.x-position.x)<40&&valid(c.text));const period=row.find(c=>Math.abs(c.x-duration.x)<40&&/\d/.test(c.text));const place=row.find(c=>Math.abs(c.x-country.x)<40&&valid(c.text));if(value)out.job=value.text;if(period)out.experience=period.text;if(place)out.experienceCountry=place.text;}}
 for(const c of cells.filter(c=>norm(c.text)==='next of kin')){
  const sub=cells.filter(v=>v.y<c.y&&c.y-v.y<Math.max(25,c.h*3)&&Math.abs(v.x-c.x)<30).sort((a,b)=>b.y-a.y).find(v=>/^(name|number)$/i.test(v.text));
  if(!sub)continue;const row=cells.filter(v=>v.x>=c.x+c.w-2&&Math.abs(v.y-c.y)<Math.max(4,c.h*.6)).sort((a,b)=>a.x-b.x);
  if(/^number$/i.test(sub.text)){const value=row.find(v=>/^[+\d][\d\s().-]{5,}$/.test(v.text));if(value)out.relativePhone=value.text;}
  else{const first=row.find(v=>valid(v.text)&&/^[A-Z][A-Za-z .'’-]+$/.test(v.text));if(first){const second=cells.filter(v=>v.y<first.y&&first.y-v.y<Math.max(24,c.h*3)&&Math.abs(v.x-first.x)<25&&valid(v.text)&&/^[A-Z][A-Za-z .'’-]+$/.test(v.text)).sort((a,b)=>b.y-a.y)[0];out.relative=first.text+(second?' '+second.text:'');}}
 }
 if(out.skills)out.skills=out.skills.replace(/Wash & Iron/g,'Washing، Ironing').replace(/Care of the Eldery/g,'Elderly Care');
 if(out.education==='HIGH SCHOOL'&&cells.some(c=>c.text==='GRADUATE'))out.education='HIGH SCHOOL GRADUATE';
 if(out.marital&&/married/i.test(out.marital)&&/single/i.test(out.marital))out.marital='';
 const maritalLabel=items.find(c=>/marital status|social status/i.test(c.str||''));
 if(maritalLabel){
  const row=items.filter(c=>Math.abs(c.transform[5]-maritalLabel.transform[5])<Math.max(5,c.height||10));
  const choices=row.filter(c=>/\b(single|married|divorced|widowed)\b/i.test(c.str));
  const marks=row.filter(c=>/^[☒✓✔]+$/.test((c.str||'').trim()));
  const selected=marks.map(m=>choices.filter(c=>c.transform[4]+c.width<=m.transform[4]+3&&m.transform[4]-c.transform[4]-c.width<45).sort((a,b)=>b.transform[4]-a.transform[4])[0]).filter(Boolean);
  if(selected.length===1)out.marital=selected[0].str.match(/single|married|divorced|widowed/i)[0].toUpperCase();
 }
 const remarksLabel=cells.find(c=>/^remarks?$/i.test(c.text));
 if(remarksLabel&&!out.notes){const value=cells.filter(c=>c.y>remarksLabel.y&&c.y-remarksLabel.y<remarksLabel.h*3&&c.x>remarksLabel.x+remarksLabel.w&&valid(c.text)&&!stops.has(norm(c.text))).sort((a,b)=>a.y-b.y)[0];if(value)out.notes=value.text;}

 if(out.phone)out.phone=out.phone.replace(/\s*\([A-Z]+\)$/,'');
 if(out.phone&&!/^[+\d][\d\s().-]{5,}$/.test(out.phone))delete out.phone;
 if(!out.skills)delete out.skills;
 if(out.marital)out.marital=out.marital.replace(/marrieed/i,'MARRIED');
 if(out.children){const n=parseText('No of children '+out.children).children;if(n!==undefined)out.children=n;}
 return Object.fromEntries(Object.entries(out).filter(([k,v])=>acceptable(k,v)));
}


export function finalizeData(input:CV,text:string){
 const data={...input},warnings:string[]=[];
 const employment=text.match(/PREVIOUS EMPLOYMENT(?: ABROAD)?([\s\S]*?)(?:WORK EXPERIENCE|Skills\s*&\s*Experience|REMARKS|$)/i);if(employment&&!strip(employment[1]).replace(/\b(?:COUNTRY|PERIOD|POSITION|DURATION)\b/gi,'').replace(/[\s\-—–:|.]+/g,'')&&!data.experience&&!data.experienceCountry)warnings.push('جدول الخبرة الخارجية لا يذكر دولة أو مدة. المهارات العملية موضّحة في حقل المهارات، ولا تُحسب مدة العقد كخبرة.');
 const nationality=normalizeNationality(data.nationality||'')||labeledNationality(text);if(nationality)data.nationality=nationality;else if(data.nationality){warnings.push('راجع الجنسية: القيمة المستخرجة لا تطابق الدول التسع المعتمدة.');data.nationality='';}
 if(data.name)data.name=data.name.replace(/^[\s/|:.-]+|[\s/|:.-]+$/g,'').trim();
 if(data.nameAr&&!/[\u0600-\u06ff]/.test(data.nameAr)&&/worker[’']?s? name|full name/i.test(data.nameAr))delete data.nameAr;
 if(data.nameAr&&/^(?:الكامل|الاسم|الاسم الكامل|الجنسية)$/.test(data.nameAr.trim()))data.nameAr='';
 if(data.marital&&/^(single|married|divorced|widowed)\b/i.test(data.marital))data.marital=data.marital.match(/^(single|married|divorced|widowed)/i)![0].toUpperCase();
 if(data.issueDate&&!validIssueDate(data.issueDate)){warnings.push('تاريخ إصدار الجواز في المستقبل أو غير صالح؛ راجع صورة الجواز.');data.issueDate='';}
 for(const key of Object.keys(data))if(!acceptable(key,data[key]))delete data[key];
 if(data.phone&&!/^[+\d][\d\s().-]{5,}$/.test(data.phone))data.phone='';
 const maritalLine=text.split('\n').find(line=>/marital status|social status/i.test(line));
 if(maritalLine&&/single/i.test(maritalLine)&&/married/i.test(maritalLine)&&!['SINGLE','MARRIED','DIVORCED','WIDOWED'].includes(input.marital||'')&&!markedMarital(maritalLine)){data.marital='';warnings.push('الحالة الاجتماعية تحتوي على أكثر من اختيار؛ راجع علامة الاختيار في الأصل.');}
 if(data.notes&&/^(?:PLACE|Wednesday|Page \d)/i.test(data.notes))data.notes='';
 if(data.weight)data.weight=data.weight.replace(/\s+/g,'').replace(/kg$/i,'');
 if(data.height)data.height=data.height.replace(/\s+/g,'');
 if(data.salary){data.currency=/USD|\$/i.test(data.salary)?'USD':/SAR|SR/i.test(data.salary)?'SAR':data.currency||'';data.salary=data.salary.match(/[\d,]+(?:\.\d+)?/)?.[0]?.replace(/,/g,'')||'';}
 for(const key of ['birthDate','issueDate','expiryDate'])if(data[key]&&!validDate(data[key])){warnings.push('تاريخ غير واضح في المصدر: '+data[key]);data[key]='';}
 if(data.issueDate&&data.expiryDate&&dateValue(data.expiryDate)<=dateValue(data.issueDate)){warnings.push('تاريخ انتهاء الجواز في المصدر أقدم من تاريخ الإصدار؛ راجعه يدويًا.');data.expiryDate='';}
 if(!data.age&&data.birthDate&&validDate(data.birthDate)){const birth=new Date(dateValue(data.birthDate)),now=new Date();let age=now.getUTCFullYear()-birth.getUTCFullYear();if(now.getUTCMonth()<birth.getUTCMonth()||(now.getUTCMonth()===birth.getUTCMonth()&&now.getUTCDate()<birth.getUTCDate()))age--;if(age>=16&&age<=100)data.age=String(age);}
 return {data,warnings};
}
function dateValue(value:string){
 const cleaned=value.trim().replace(/,/g,'').replace(/\s+/g,' ');
 const m=cleaned.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);return m?Date.UTC(+m[3],+m[2]-1,+m[1]):Date.parse(cleaned);
}
export function validDate(value:string){
 const cleaned=value.trim().replace(/,/g,'').replace(/\s+/g,' ');
 const m=cleaned.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
 if(m){const date=new Date(dateValue(cleaned));return date.getUTCDate()===+m[1]&&date.getUTCMonth()===+m[2]-1&&date.getUTCFullYear()===+m[3];}
 return /^(?:\d{1,2}[ -][A-Z]{3,9}[ -]\d{4}|[A-Z]{3,9} \d{1,2} \d{4}|\d{4}-\d{2}-\d{2})$/i.test(cleaned)&&Number.isFinite(dateValue(cleaned));
}

function readLabeledDates(text:string):CV{const out:CV={},lines=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').split('\n').map(l=>l.trim()).filter(Boolean);const labels:Record<string,RegExp>={issueDate:/date\s*(?:of\s*)?(?:issuance|issue|de\s+delivrance)/i,expiryDate:/date\s*(?:of\s*)?(?:expiry|expiration)|valable\s+jusqu/i,birthDate:/date\s*(?:of\s*)?birth|date\s+de\s+naissance/i};for(const[key,label]of Object.entries(labels))for(let i=0;i<lines.length;i++){if(!label.test(lines[i]))continue;const sectionLines:string[]=[];for(let j=i;j<Math.min(lines.length,i+3);j++){if(j>i&&Object.entries(labels).some(([other,re])=>other!==key&&re.test(lines[j])))break;sectionLines.push(lines[j]);}const section=sectionLines.join(' ');const matches=section.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/g)||[];const date=matches.find(validDate);if(date){out[key]=date.replace(/[.-]/g,'/');break;}}return out;}
export function validIssueDate(value:string){return validDate(value)&&dateValue(value)<=Date.now()+86400000;}
export function datesInOrder(issue:string,expiry:string){return validDate(issue)&&validDate(expiry)&&dateValue(expiry)>dateValue(issue);}
export function passportMRZDates(text:string):CV{
 const out:CV={},check=(s:string)=>[...s].reduce((n,c,i)=>n+(c==='<'?0:/\d/.test(c)?+c:c.charCodeAt(0)-55)*[7,3,1][i%3],0)%10;
 for(const line of text.toUpperCase().split('\n').map(l=>l.replace(/\s/g,''))){const m=line.match(/[A-Z]{3}(\d{6})(\d)[MF<](\d{6})(\d)/);if(!m||check(m[1])!==+m[2]||check(m[3])!==+m[4])continue;
 const date=(s:string,birth=false)=>{let year=2000+Number(s.slice(0,2));if(birth&&year>new Date().getFullYear()||!birth&&year>new Date().getFullYear()+20)year-=100;return s.slice(4,6)+'/'+s.slice(2,4)+'/'+year;};
 const expiry=date(m[3]);if(validDate(expiry))out.expiryDate=expiry;const birth=date(m[1],true);if(validDate(birth))out.birthDate=birth;
 }return out;
}
function readEmployment(text:string):CV{
 const lines=text.split('\n').map(strip).map(s=>s.trim()).filter(Boolean),out:CV={};let start=lines.findIndex(l=>/^(?:EXPERIENCE ABROAD|EXPERIENCE OUTSIDE THE COUNTRY|EXPERIENCE|OVERSEAS EXPERIENCE|PREVIOUS EMPLOYMENT(?: ABROAD)?)(?:\s*[:：])?$/i.test(l));if(start<0){const header=lines.findIndex((line,i)=>/\bcountry\b/i.test(line)&&/\b(?:period|duration)\b/i.test(line+' '+(lines[i+1]||'')));if(header<0)return out;start=header-1;}
 const rows:string[]=[];for(let i=start+1;i<Math.min(lines.length,start+14);i++){if(/^(?:WORKING EXPERIENCE|WORK EXPERIENCE|Skills(?:\s*&\s*Experience)?|REMARKS|LANGUAGE)/i.test(lines[i]))break;rows.push(lines[i]);}
 for(let i=0;i<rows.length;i++){const c=rows[i].match(/^COUNTRY\s*[:：]?\s+([A-Z][A-Z .-]+)$/i);if(c&&!/PERIOD|POSITION|DURATION/i.test(c[1]))out.experienceCountry=c[1].trim();if(/^COUNTRY$/i.test(rows[i])&&/^[A-Z][A-Z .-]{2,40}$/.test(rows[i+1]||'')&&!/PERIOD|POSITION|DURATION|FIRST TIMER|NIL|NONE/.test(rows[i+1]))out.experienceCountry=rows[i+1];const p=rows[i].match(/^(?:PERIOD|DURATION)\s*[:：]?\s+(\d+\s*(?:YEARS?|MONTHS?))/i);if(p)out.experience=p[1];if(/^(?:PERIOD|DURATION)$/i.test(rows[i])&&/^\d+\s*(?:YEARS?|MONTHS?)/i.test(rows[i+1]||''))out.experience=rows[i+1];}
 if(/FIRST TIMER|NO EXPERIENCE|\b(?:NIL|NEW|NONE)\b/i.test(rows.join(' ')))out.experience='FIRST TIMER';return out;
}

function markedMarital(line:string){const options=[...line.matchAll(/\b(single|married|divorced|widowed)\b/gi)];const selected=options.filter((m,i)=>/[☒✓✔]/.test(line.slice(m.index!+m[0].length,options[i+1]?.index)));return selected.length===1?selected[0][0].toUpperCase():'';}

function skillLabel(name:string){return name.replace(/^(?:Taking Care of the Old|Old People Care|Care of the Eldery)$/i,'Elderly Care').replace(/^Kids Care$/i,'Child Care').replace(/^Cleaning and Washing$/i,'Cleaning، Washing').replace(/^Wash & Iron$/i,'Washing، Ironing');}
