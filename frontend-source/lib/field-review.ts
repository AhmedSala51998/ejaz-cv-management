import {CV,fields} from './fields';
import {validDate,validIssueDate,datesInOrder} from './parser';
export type Evidence={page:number;method:string;values:CV;uncertain?:string[]};
export type FieldIssue={reason:string;candidates?:{value:string;page:number;method:string}[];resolved?:boolean};
export type FieldReview=Record<string,FieldIssue>;
export function getReview(data:CV):FieldReview{try{const parsed=JSON.parse(data._review||'{}');if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};const out:FieldReview={};for(const [key] of fields){const item=parsed[key];if(item&&typeof item.reason==='string')out[key]={reason:item.reason,resolved:item.resolved===true,candidates:Array.isArray(item.candidates)?item.candidates.filter((c:any)=>c&&typeof c.value==='string'&&typeof c.method==='string'&&Number.isInteger(c.page)).slice(0,6):undefined};}return out;}catch{return {};}}
export function unresolved(data:CV){return Object.values(getReview(data)).filter(i=>!i.resolved).length;}
function normalized(key:string,value:string){if(key==='skills')return value.split(/[،,]/).map(v=>v.toUpperCase().replace(/\s+/g,'').trim()).filter(Boolean).sort().join('|');const s=value.normalize('NFKC').trim().toUpperCase().replace(/\s+/g,' ');if(/Date$/.test(key)){const m=value.trim().match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);const t=m?Date.UTC(+m[3],+m[2]-1,+m[1]):Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value)?value:value+' UTC');return validDate(value)?String(t):s;}if(['height','weight','age'].includes(key))return s.replace(/\s|CM|KG|YEARS?|OLD/g,'').replace(/,/g,'.');return s.replace(/[،,.;:_-]/g,'').replace(/\s+/g,'');}
export function buildReview(data:CV,evidence:Evidence[],notices:string[]=[]):FieldReview{
 const result:FieldReview={};
 for(const [key] of fields){if(key==='notes'||key==='nameAr'||key==='currency')continue;
  if(!data[key]?.trim()){result[key]={reason:'لم تُستخرج قيمة لهذا الحقل؛ قد يكون غير موجود أو غير مقروء. راجع الأصل أو أكّد أنه غير مذكور.'};continue;}
  
  const candidates=evidence.filter(e=>e.values[key]?.trim()).map(e=>({value:e.values[key].trim(),page:e.page,method:e.method}));
  const distinct=new Set(candidates.map(c=>normalized(key,c.value)));
  if(distinct.size>1)result[key]={reason:'ظهرت قراءات مختلفة؛ راجع القيمة المختارة مقابل الأصل.',candidates:candidates.filter((c,i,a)=>a.findIndex(x=>normalized(key,x.value)===normalized(key,c.value))===i).slice(0,6)};
 }
 for(const e of evidence)for(const key of e.uncertain||[])if(data[key]&&!result[key])result[key]={reason:'بعض حروف هذه القيمة منخفضة الوضوح في OCR؛ راجعها مقابل الأصل.',candidates:[{value:e.values[key]||data[key],page:e.page,method:e.method}]};
 for(const key of ['issueDate','expiryDate','birthDate'])if(data[key]&&!validDate(data[key]))result[key]={reason:'صيغة التاريخ أو قيمته غير صالحة.'};
 if(data.issueDate&&!validIssueDate(data.issueDate))result.issueDate={reason:'تاريخ إصدار الجواز غير صالح أو في المستقبل.'};
 if(data.issueDate&&data.expiryDate&&!datesInOrder(data.issueDate,data.expiryDate))result.expiryDate={reason:'انتهاء الجواز أقدم من إصداره.'};
 if(data.age&&(Number(data.age)<16||Number(data.age)>100))result.age={reason:'العمر خارج النطاق المتوقع؛ راجع الأصل.'};
 if(notices.some(s=>/إصدار/.test(s)))result.issueDate={...result.issueDate,reason:'وجد تاريخ إصدار غير صالح أو متعارض أثناء القراءة؛ راجع القيمة النهائية.'};
 if(notices.some(s=>/انتهاء|الانتهاء/.test(s)))result.expiryDate={...result.expiryDate,reason:'وجد تعارض في تاريخ الانتهاء؛ راجع القيمة النهائية.'};
 if(data.birthDate&&data.age&&validDate(data.birthDate)){const m=data.birthDate.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);const birth=m?new Date(+m[3],+m[2]-1,+m[1]):new Date(data.birthDate);const today=new Date();let years=today.getFullYear()-birth.getFullYear();if(today.getMonth()<birth.getMonth()||(today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate()))years--;if(Number.isFinite(years)&&Math.abs(Number(data.age)-years)>1)result.age={reason:'العمر لا يوافق تاريخ الميلاد بحسب التاريخ الحالي؛ قد تكون السيرة قديمة. راجع الأصل دون تعديل تلقائي.'};}
 if(data.weight){const n=Number(data.weight.replace(/[^\d.]/g,''));if(n&& (n<25||n>200))result.weight={reason:'الوزن خارج النطاق المتوقع؛ راجع القيمة ووحدتها.'};}
 return result;
}
export function acknowledge(data:CV,key:string):CV{const review=getReview(data);if(review[key])review[key]={...review[key],resolved:true};return {...data,_review:reviewJSON(review)};}

export function acknowledgeAll(data:CV):CV{const review=getReview(data);for(const key of Object.keys(review))review[key]={...review[key],resolved:true};return {...data,_review:reviewJSON(review)};}

export function reviewJSON(review:FieldReview){const safe:FieldReview={};for(const [key,item]of Object.entries(review))safe[key]={...item,reason:item.reason.slice(0,500),candidates:item.candidates?.slice(0,4).map(c=>({...c,value:c.value.slice(0,400),method:c.method.slice(0,100)}))};let result=JSON.stringify(safe);while(result.length>38000){const item=Object.values(safe).sort((a,b)=>(b.candidates?.length||0)-(a.candidates?.length||0))[0];if(!item?.candidates?.length)break;item.candidates.pop();result=JSON.stringify(safe);}return result;}
