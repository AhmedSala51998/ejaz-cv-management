import type {CV} from './fields';
import type {LayoutWord} from './selection-tables';
const clean=(s:string)=>s.trim().toLowerCase().replace(/[^a-z]/g,'');
const rating=(s:string)=>/^(poor|fair|good|excellent|basic|fluent)$/.test(clean(s));
export function readLanguageColumns(words:LayoutWord[]){
 const values:CV={},uncertain:string[]=[];
 for(const guide of words.filter(w=>/^evaluat{1,2}ion$/.test(clean(w.text)))){
  const headers=words.filter(w=>/^(english|arabic)$/.test(clean(w.text))&&Math.abs(w.y-guide.y)<Math.max(w.h,guide.h));
  if(!headers.some(w=>clean(w.text)==='english')||!headers.some(w=>clean(w.text)==='arabic'))continue;
  const columns=[guide,...headers].sort((a,b)=>a.x+a.w/2-b.x-b.w/2);
  const guideIndex=columns.indexOf(guide);
  const bounds=(i:number)=>{const c=columns[i],center=c.x+c.w/2;return {left:i?((columns[i-1].x+columns[i-1].w/2)+center)/2:center-(columns[i+1].x+columns[i+1].w/2-center)/2,right:i<columns.length-1?(center+columns[i+1].x+columns[i+1].w/2)/2:center+(center-columns[i-1].x-columns[i-1].w/2)/2};};
  const gb=bounds(guideIndex);
  const rows=words.filter(w=>rating(w.text)&&w.y>guide.y+guide.h*.5&&w.y-guide.y<guide.h*9&&w.x+w.w/2>=gb.left&&w.x+w.w/2<gb.right);
  if(new Set(rows.map(w=>clean(w.text))).size<3)continue;
  for(const header of headers){const key=clean(header.text),b=bounds(columns.indexOf(header));
   const candidates=words.filter(w=>rating(w.text)&&w.x+w.w/2>=b.left&&w.x+w.w/2<b.right&&rows.some(r=>Math.abs(w.y-r.y)<Math.max(w.h,r.h)*.6));
   const answers=[...new Set(candidates.map(w=>clean(w.text)))];
   if(answers.length===1&&candidates.every(w=>rows.some(r=>clean(r.text)===clean(w.text)&&Math.abs(w.y-r.y)<Math.max(w.h,r.h)*.6)))values[key]=answers[0].toUpperCase();
   else if(answers.length)uncertain.push(key);
  }
 }
 return {values,uncertain:[...new Set(uncertain)]};
}
