import {readLanguageColumns} from './language-columns';
import type {CV} from './fields';
export type LayoutWord={text:string;x:number;y:number;w:number;h:number};
type Mark={x:number;y:number;w:number;h:number;fill:number};
const latin=(s:string)=>s.replace(/[^a-z]/gi,'').toLowerCase();
// These marks can be vector paths or images in PDF: they never appear in text extraction.
function components(canvas:HTMLCanvasElement,color:'green'|'check'|'dark',area:{x:number;y:number;w:number;h:number}):Mark[]{
 const x0=Math.max(0,Math.floor(area.x)),y0=Math.max(0,Math.floor(area.y)),w=Math.max(0,Math.min(canvas.width-x0,Math.ceil(area.w))),h=Math.max(0,Math.min(canvas.height-y0,Math.ceil(area.h)));
 if(!w||!h)return [];
 const pixels=canvas.getContext('2d')!.getImageData(x0,y0,w,h).data,mask=new Uint8Array(w*h),out:Mark[]=[];
 for(let i=0;i<w*h;i++){const r=pixels[i*4],g=pixels[i*4+1],b=pixels[i*4+2];mask[i]=+(color==='dark'?r+g+b<300:color==='green'?g>95&&g>r*1.16&&g>b*1.3:r>80&&r>g*1.4&&b>g*1.15);}
 for(let i=0;i<mask.length;i++)if(mask[i]){const queue=[i];mask[i]=0;let minX=w,minY=h,maxX=0,maxY=0,count=0;for(let j=0;j<queue.length;j++){const n=queue[j],x=n%w,y=Math.floor(n/w);count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<w&&ny<h&&mask[ny*w+nx]){mask[ny*w+nx]=0;queue.push(ny*w+nx);}}}const rw=maxX-minX+1,rh=maxY-minY+1;if(count>=4)out.push({x:x0+minX,y:y0+minY,w:rw,h:rh,fill:count/(rw*rh)});}
 return out;
}
function phrase(words:LayoutWord[],name:string){
 const parts=name.split(' ');const exact=words.find(w=>latin(w.text)===latin(name));if(exact)return exact;
 for(const first of words.filter(w=>latin(w.text)===parts[0])){let last=first,ok=true;for(const part of parts.slice(1)){const next=words.filter(w=>latin(w.text)===part&&w.x>=last.x+last.w-2&&w.x-last.x-last.w<first.h*3&&Math.abs(w.y-first.y)<first.h*.65).sort((a,b)=>a.x-b.x)[0];if(!next){ok=false;break;}last=next;}if(ok)return {...first,w:last.x+last.w-first.x};}
}
export function readSelectionTables(canvas:HTMLCanvasElement,words:LayoutWord[]){
 const columnRead=readLanguageColumns(words);const values:CV={...columnRead.values},uncertain:string[]=[...columnRead.uncertain];
 const grades=words.filter(w=>/^(poor|fair|good|excellent|basic|fluent)$/i.test(w.text.trim())).sort((a,b)=>a.y-b.y||a.x-b.x);
 const headers=words.filter(w=>/eng(?:l)?ish|ar[ae]?bic|ambic/i.test(w.text));
 // Each language has its own row of graded boxes; do not treat the printed options as answers.
 const rows:LayoutWord[][]=[];for(const grade of grades){let row=rows.find(r=>Math.abs(r[0].y-grade.y)<grade.h*.8);if(!row){row=[];rows.push(row);}row.push(grade);}
 for(const row of rows){row.sort((a,b)=>a.x-b.x);if(row.length<3)continue;const header=headers.filter(w=>w.y+w.h<=row[0].y+row[0].h&&row[0].y-w.y<row[0].h*5).sort((a,b)=>a.x-b.x);
  let groups:{key:string;grades:LayoutWord[]}[]=[];
  if(row.length===6&&header.some(w=>/eng(?:l)?ish/i.test(w.text))&&header.some(w=>/ar[ae]?bic|ambic/i.test(w.text))){const first=header[0];const englishFirst=/eng(?:l)?ish.*(?:ar[ae]?bic|ambic)/i.test(first.text)||!(/ar[ae]?bic|ambic/i.test(first.text))||header.find(w=>/eng(?:l)?ish/i.test(w.text))!.x<header.find(w=>/ar[ae]?bic|ambic/i.test(w.text))!.x;groups=[{key:englishFirst?'english':'arabic',grades:row.slice(0,3)},{key:englishFirst?'arabic':'english',grades:row.slice(3)}];}
  else for(const key of ['english','arabic']){const h=header.find(w=>new RegExp(key,'i').test(w.text));if(h&&!/eng(?:l)?ish.*(?:ar[ae]?bic|ambic)|(?:ar[ae]?bic|ambic).*eng(?:l)?ish/i.test(h.text))groups.push({key,grades:row.filter(w=>w.x>=h.x-h.h*5&&w.x<=h.x+h.w+h.h*5)});}
  for(const group of groups){if(group.grades.length!==3)continue;const selected=group.grades.filter(g=>components(canvas,'green',{x:g.x-g.h*2.8,y:g.y-g.h*.25,w:g.w+g.h*2.8,h:g.h*3.1}).some(m=>m.w/g.h>.25&&m.w/g.h<1.4&&m.h/g.h>.25&&m.h/g.h<1.4&&m.w/m.h>.65&&m.w/m.h<1.5&&m.fill>.6));
   const darkSelected=selected.length?[]:group.grades.filter(g=>components(canvas,'dark',{x:g.x-g.h*2.8,y:g.y+g.h*.7,w:g.h*2.6,h:g.h*2}).some(m=>m.w/g.h>.35&&m.w/g.h<1.2&&m.h/g.h>.35&&m.h/g.h<1.2&&m.w/m.h>.75&&m.w/m.h<1.35&&m.fill>.75));const answers=selected.length?selected:darkSelected;
   if(answers.length===1)values[group.key]=answers[0].text.toUpperCase();else if(answers.length>1)uncertain.push(group.key);
  }
 }
 const names=[['Driving','driving'],['Cleaning','cleaning'],['Ironing','ironing'],['Cooking','cooking'],['Washing','washing'],['Baby Sitting','baby sitting'],['Baby Sitting','babysitting'],['Sewing','sewing'],['Child Care','child care'],['Elderly Care','elderly care'],['Infant Care','infant care']];
 const labels=names.flatMap(([name,alias])=>{const w=phrase(words,alias);return w?[{...w,name}]:[];});
 if(labels.length>=4){const marks=components(canvas,'check',{x:0,y:Math.min(...labels.map(l=>l.y))-8,w:canvas.width,h:Math.max(...labels.map(l=>l.y+l.h))-Math.min(...labels.map(l=>l.y))+24});
  const selected=labels.filter(l=>{const next=labels.filter(n=>n.x>l.x+l.w&&Math.abs(n.y-l.y)<l.h).sort((a,b)=>a.x-b.x)[0];return marks.some(m=>m.x>=l.x+l.w-l.h*.2&&m.x+m.w<Math.min(next?next.x-l.h*.5:canvas.width,l.x+l.w+l.h*8)&&Math.abs(m.y+m.h/2-l.y-l.h/2)<l.h*.85&&m.w>l.h*.4&&m.w<l.h*2.5&&m.h>l.h*.35&&m.h<l.h*2&&m.fill>.12);});
  if(marks.length&&selected.length)values.skills=[...new Set(selected.map(l=>l.name))].join('، ');
 }
 return {values,uncertain};
}
export function pdfLayoutWords(items:any[],page:any,canvas:HTMLCanvasElement):LayoutWord[]{
 const natural=page.getViewport({scale:1}),scale=canvas.width/natural.width,viewport=page.getViewport({scale});
 return items.filter(i=>i.str?.trim()).map(i=>{const x=viewport.transform[0]*i.transform[4]+viewport.transform[2]*i.transform[5]+viewport.transform[4],baseline=viewport.transform[1]*i.transform[4]+viewport.transform[3]*i.transform[5]+viewport.transform[5],h=Math.abs(i.height||10)*scale;return {text:i.str.trim(),x,y:baseline-h,w:i.width*scale,h};});
}
