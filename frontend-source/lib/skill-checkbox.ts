import type {CV} from './fields';
type W={text:string;x:number;y:number;w:number;h:number};
export function markedTableSkills(canvas:HTMLCanvasElement,words:W[]):string|undefined{
const names=['Wash Iron','Ironing','Cooking','Arabic Cooking','Sewing','Computer','Baby Sitting','Children Care','Tutoring','Cleaning','Washing','Driving','Elderly Care','Shopping','Infant Care','Child Care','Baby Care'];
const width=canvas.width,height=canvas.height,p=canvas.getContext('2d')!.getImageData(0,0,width,height).data;
const dark=(x:number,y:number,limit=360)=>{if(x<0||y<0||x>=width||y>=height)return false;const i=(y*width+x)*4;return p[i]+p[i+1]+p[i+2]<limit;};
const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z]/g,'');const selected:string[]=[];let covered=0;
for(const name of names){const parts=name.toLowerCase().split(' ');let label:W|undefined=words.find(w=>normalize(w.text)===normalize(name));
for(const first of words.filter(w=>normalize(w.text)===parts[0])){let last=first,good=true;for(const part of parts.slice(1)){const next=words.filter(w=>normalize(w.text)===part&&w.x>=last.x+last.w-3&&w.x-last.x-last.w<first.h*3&&Math.abs(w.y-first.y)<first.h*.7).sort((a,b)=>a.x-b.x)[0];if(!next){good=false;break;}last=next;}if(good){label={...first,w:last.x+last.w-first.x};break;}}
if(!label)continue;
// Printed ratings belong to the text parser, not checkbox ink recognition.
const rating=words.filter(w=>w.x>label!.x+label!.w&&Math.abs(w.y-label!.y)<label!.h).sort((a,b)=>a.x-b.x).slice(0,3).map(w=>w.text).join(' ');
if(/^(?:YES|NO|OK|GOOD|FAIR|BASIC|LITTLE|EXCELLENT|NOT GOOD)\b/i.test(rating))return undefined;
const top=Math.max(0,Math.round(label.y-label.h*.35)),bottom=Math.min(height-1,Math.round(label.y+label.h*1.35));
const vertical=(x:number)=>{let n=0;for(let y=top;y<=bottom;y++)if(dark(x,y,660)||dark(x-1,y,660)||dark(x+1,y,660))n++;return n/(bottom-top+1)>.85;};
let left=-1,right=-1;for(let x=Math.ceil(label.x+label.w+2);x<Math.min(width,label.x+label.w+width*.16);x++)if(vertical(x)){left=x;break;}if(left<0)continue;
for(let x=left+10;x<Math.min(width,left+width*.2);x++)if(vertical(x)){right=x;break;}if(right-left<18)continue;
// Ignore the table strokes and evaluate only ink inside the checkbox/value cell.
const y0=Math.max(0,Math.round(label.y-label.h*.15)),y1=Math.min(height-1,Math.round(label.y+label.h*1.1)),x0=left+6,x1=right-6;let count=0,minX=width,maxX=0,minY=height,maxY=0;
for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(dark(x,y)){count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
covered++;const area=(x1-x0+1)*(y1-y0+1),marked=count>Math.max(10,area*.002)&&maxX-minX<(right-left)*.65&&maxY-minY<label.h*1.3;

const explicitNo=words.some(w=>/^(?:no|nil|none)$/i.test(w.text)&&w.x+w.w/2>x0&&w.x+w.w/2<x1&&Math.abs(w.y-label!.y)<label!.h);if(marked&&!explicitNo)selected.push(...(name==='Wash Iron'?['Washing','Ironing']:[name]));
}
return covered>=4?[...new Set(selected)].join('، '):undefined;
}
