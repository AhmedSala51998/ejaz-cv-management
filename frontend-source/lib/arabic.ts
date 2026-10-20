import type {CV} from './fields';

export const arabicLabels: Record<string, string[]> = {
 nameAr:['الاسم باللغة العربية','الاسم بالعربية','اسم العاملة','اسم العامل','الاسم الكامل','الاسم'],
 passport:['رقم جواز السفر','رقم الجواز','جواز السفر'],
 nationality:['الجنسية'], job:['المهنة المطلوبة','الوظيفة المطلوبة','المهنة','الوظيفة'],
 salary:['الراتب الشهري','الراتب'],currency:['العملة'],contract:['مدة العقد'],
 birthDate:['تاريخ الميلاد','تاريخ الولادة'],age:['العمر','السن'],
 birthPlace:['مكان الميلاد','محل الميلاد'],religion:['الديانة','الدين'],
 marital:['الحالة الاجتماعية','الحالة الزوجية'],children:['عدد الأطفال','عدد الاطفال','عدد الأبناء'],
 height:['الطول'],weight:['الوزن'],education:['المستوى التعليمي','المؤهل العلمي','التعليم'],
 phone:['رقم التواصل','رقم الهاتف','رقم الجوال','الهاتف'],
 address:['العنوان الحالي','عنوان السكن','مكان السكن','العنوان'],
 issueDate:['تاريخ إصدار الجواز','تاريخ الاصدار','تاريخ الإصدار'],
 expiryDate:['تاريخ انتهاء الجواز','تاريخ الانتهاء'],issuePlace:['مكان الإصدار','مكان الاصدار'],
 english:['اللغة الإنجليزية','اللغة الانجليزية','الإنجليزية','الانجليزية'],
 arabic:['اللغة العربية','العربية'],experience:['الخبرات السابقة','الخبرة العملية','الخبرة السابقة','الخبرة'],
 experienceCountry:['دول الخبرة','بلد العمل السابق'],skills:['المهارات والخبرات','المهارات'],
 relative:['اسم القريب','أحد الأقارب'],relativePhone:['رقم القريب','هاتف القريب'],
 notes:['ملاحظات','الملاحظات']
};
export function digits(s:string){return s.replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<='٩'?1632:1776)));}
export function cleanArabic(s:string){
 return digits(s.normalize('NFKC')).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'')
 .replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/\s+/g,' ').trim();
}
export function arabicNorm(s:string){return cleanArabic(s).replace(/[أإآ]/g,'ا').replace(/[ى]/g,'ي').replace(/[:：|]/g,'').trim();}
const aliases=Object.entries(arabicLabels).flatMap(([key,labels])=>labels.map(label=>({key,label:arabicNorm(label)}))).sort((a,b)=>b.label.length-a.label.length);
const known=new Set(aliases.map(a=>a.label));
function validValue(value:string){return value && !known.has(arabicNorm(value)) && !/^(date of birth|nationality|religion|gender|marital status|no. of children|height|weight|education|passport|issue|expiry|full name|address|monthly salary|contract period|position|languages)/i.test(value) && value.length<2000;}
export function parseArabic(text:string):CV{
 const lines=text.split(/\r?\n/).map(cleanArabic).filter(Boolean),out:CV={};
 for(let i=0;i<lines.length;i++){
  const line=lines[i];const normalized=arabicNorm(line);
  for(const {key,label}of aliases){
   if(out[key])continue;
   if(normalized===label){const next=lines[i+1]||'';if(validValue(next))out[key]=next;continue;}
   const re=new RegExp('(?:^|[|؛])\\s*'+label+'\\s*[:：]?\\s+(.+)$');
   const match=normalized.match(re);
   if(match){
    let value=match[1];
    for(const other of aliases){const idx=value.indexOf(other.label);if(idx>0)value=value.slice(0,idx).trim();}
    // Preserve original Arabic spelling in the value, not the normalized search spelling.
    const originalStart=line.search(/[:：]/);
    if(originalStart>=0){const raw=line.slice(originalStart+1).trim();if(arabicNorm(raw)===value)value=raw;}
    if(validValue(value))out[key]=value;
   }
  }
 }
 if(out.passport)out.passport=digits(out.passport).replace(/\s+/g,'').toUpperCase();
 for(const k of ['age','children'])if(out[k])out[k]=digits(out[k]).match(/\d+/)?.[0]||'';
 if(out.salary){out.currency=/دولار|USD/i.test(out.salary)?'USD':/ريال|SAR/i.test(out.salary)?'SAR':out.currency||'';out.salary=digits(out.salary).match(/[\d,.]+/)?.[0]?.replace(/,/g,'')||'';}
 return Object.fromEntries(Object.entries(out).filter(([,value])=>value.trim()));
}
export function spatialArabic(items:any[]):CV{
 const cells=items.filter(i=>i.str?.trim()).map(i=>({text:cleanArabic(i.str),x:i.transform[4],y:i.transform[5],w:i.width}));
 const out:CV={};
 for(const {key,label}of aliases){
  if(out[key])continue;const c=cells.find(c=>arabicNorm(c.text)===label);if(!c)continue;
  const row=cells.filter(v=>v!==c&&Math.abs(v.y-c.y)<4&&v.x+v.w<=c.x+3).sort((a,b)=>b.x-a.x);
  const parts:string[]=[];let edge=c.x;
  for(const v of row){if(edge-(v.x+v.w)>150||known.has(arabicNorm(v.text)))break;
   // Bilingual tables often end in an English label on the far left.
   if(/^(name|nationality|religion|passport|age|weight|height|marital|date|salary|english|arabic|education|address|phone|position|contract|issue|expiry|number|full|no\.)\b/i.test(v.text))break;
   parts.push(v.text);edge=v.x;
  }
  if(parts.length)out[key]=parts.join(' ');
 }
 return out;
}
const names:Record<string,string>={
 erlinda:'إيرليندا',nicolas:'نيكولاس',eden:'إيدن',hafsa:'حفصة',hafsah:'حفصة',akimana:'أكيمانا',
 tsehay:'تسيهاي',yisihak:'يسيحاق',anulo:'أنولو',samena:'سامينا',aktar:'أكتار',
 maria:'ماريا',mary:'ماري',rose:'روز',anna:'آنا',ana:'آنا',jane:'جين',grace:'غريس',joy:'جوي',
 ahmed:'أحمد',ahmad:'أحمد',mohamed:'محمد',mohammed:'محمد',muhammad:'محمد',ali:'علي',fatima:'فاطمة',fatimah:'فاطمة',aisha:'عائشة',amina:'أمينة',
 khadija:'خديجة',sara:'سارة',sarah:'سارة',noor:'نور',nur:'نور',abdul:'عبد',rahman:'الرحمن',abdullah:'عبد الله',
 de:'دي',del:'ديل',dela:'ديلا',cruz:'كروز',santos:'سانتوس',reyes:'رييس',garcia:'غارسيا',lopez:'لوبيز',
 jean:'جين',ann:'آن',josephine:'جوزفين',christine:'كريستين',elizabeth:'إليزابيث',ruth:'روث',esther:'إستر'
};
export function arabicName(name:string):string{
 if(/[\u0600-\u06ff]/.test(name))return cleanArabic(name);
 return name.trim().split(/\s+/).map(word=>{
  const w=word.toLowerCase().replace(/[^a-z'-]/g,'');if(names[w])return names[w];
  const parts:Record<string,string>={tion:'شن',sh:'ش',ch:'تش',kh:'خ',gh:'غ',ph:'ف',th:'ث',oo:'و',ee:'ي',ou:'و',ai:'اي',ay:'اي',ie:'ي',ng:'نغ',ck:'ك'};
  const single:Record<string,string>={a:'ا',b:'ب',c:'ك',d:'د',e:'ي',f:'ف',g:'ج',h:'ه',i:'ي',j:'ج',k:'ك',l:'ل',m:'م',n:'ن',o:'و',p:'ب',q:'ق',r:'ر',s:'س',t:'ت',u:'و',v:'ف',w:'و',x:'كس',y:'ي',z:'ز','-':' ','\'':''};
  let result='';for(let i=0;i<w.length;){const chunk=Object.keys(parts).find(p=>w.startsWith(p,i));if(chunk){result+=parts[chunk];i+=chunk.length;}else{result+=single[w[i]]||'';i++;}}
  return result.replace(/اا+/g,'ا').replace(/يي+/g,'ي').replace(/وو+/g,'و');
 }).filter(Boolean).join(' ');
}
export function completeNames(data:CV):CV{
 const next={...data};if(!next.name&&next.nameAr)next.name=next.nameAr;
 if(next.nameAr&&!/[\u0600-\u06ff]/.test(next.nameAr))next.nameAr=arabicName(next.nameAr);
 if(!next.nameAr&&next.name)next.nameAr=arabicName(next.name);
 return next;
}

export function mergeArabic(base:CV, arabic:CV):CV {
 const result={...base};
 for(const [key,value] of Object.entries(arabic)){
  if(value.trim() && (!result[key]?.trim() || key==='nameAr')) result[key]=value;
 }
 return result;
}
