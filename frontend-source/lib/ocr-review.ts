import {adaptiveImage} from './document-tools';
import {pdfDocumentImages} from './profile-extraction';
import {markedTableSkills} from './skill-checkbox';
import {CV,fields} from './fields';
import {parseText,spatial,textRows,validDate,passportMRZDates,validIssueDate} from './parser';
type Word={text:string;x:number;y:number;w:number;h:number;confidence:number};
function words(tsv:string):Word[]{return tsv.split('\n').slice(1).map(l=>l.split('\t')).filter(c=>c[0]==='5'&&c[11]?.trim()).map(c=>({text:c[11],x:+c[6],y:+c[7],w:+c[8],h:+c[9],confidence:+c[10]}));}
function patch(canvas:HTMLCanvasElement,r:{x:number;y:number;w:number;h:number},scale=2,enhance=true){const out=document.createElement('canvas');r.x=Math.max(0,r.x);r.y=Math.max(0,r.y);r.w=Math.min(canvas.width-r.x,r.w);r.h=Math.min(canvas.height-r.y,r.h);out.width=Math.max(1,Math.round(r.w*scale));out.height=Math.max(1,Math.round(r.h*scale));const ctx=out.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(canvas,r.x,r.y,r.w,r.h,0,0,out.width,out.height);if(!enhance)return out;const image=ctx.getImageData(0,0,out.width,out.height);for(let i=0;i<image.data.length;i+=4){const a=image.data;const gray=Math.min(255,Math.max(0,((a[i]+a[i+1]+a[i+2])/3-80)*1.55));a[i]=a[i+1]=a[i+2]=gray;}ctx.putImageData(image,0,0);return out;}
function numeric(key:string,text:string){text=text.replace(/,/g,'.').replace(/\s+/g,' ').trim();if(key==='height'){const m=text.match(/\b(1[.,]\d{1,2}|2[.,][0-2]\d?)\s*M\b/i);if(m)return m[1]+' M';const cm=text.match(/\b(1\d{2}|2[01]\d)\s*CM\b/i);if(cm)return cm[1]+' CM';}if(key==='weight'){const m=text.match(/\b(\d{2,3}(?:\.\d)?)\s*KG\b/i);if(m&&+m[1]>=25&&+m[1]<=200)return m[1];}if(key==='age'){const m=text.match(/\b(\d{2})\b/);if(m&&+m[1]>=16&&+m[1]<=80)return m[1];}return '';}
// Global Otsu threshold on a separate canvas: retain the untouched source for the other pass.
export function enhanceDocument(canvas:HTMLCanvasElement){
 const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;
 const ctx=out.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(canvas,0,0);
 const image=ctx.getImageData(0,0,out.width,out.height),a=image.data,hist=new Uint32Array(256);let sum=0;
 for(let i=0;i<a.length;i+=4){const g=Math.round(a[i]*.299+a[i+1]*.587+a[i+2]*.114);hist[g]++;sum+=g;}
 const total=a.length/4;let weight=0,partial=0,best=-1,threshold=128;
 for(let t=0;t<255;t++){weight+=hist[t];partial+=t*hist[t];if(!weight||weight===total)continue;const delta=partial/weight-(sum-partial)/(total-weight),score=weight*(total-weight)*delta*delta;if(score>best){best=score;threshold=t;}}
 // Degenerate / almost blank documents should retain their gray levels.
 for(let i=0;i<a.length;i+=4){const g=Math.round(a[i]*.299+a[i+1]*.587+a[i+2]*.114);const v=best>0?(g>threshold?255:0):g;a[i]=a[i+1]=a[i+2]=v;}
 ctx.putImageData(image,0,0);return out;
}
function uncertainFields(values:CV,ws:Word[]){return fields.filter(([key])=>values[key]&&ws.some(w=>w.confidence>=0&&w.confidence<60&&w.text.trim().length>=2&&values[key].toUpperCase().split(/\s+/).includes(w.text.trim().toUpperCase()))).map(([key])=>key);}
export async function reviewOCR(canvas:HTMLCanvasElement,worker:any,page?:any,pdfjs?:any,pageNumber=1){
 await worker.reinitialize('eng');await worker.setParameters({tessedit_pageseg_mode:'11',tessedit_char_whitelist:''});
 const full=await worker.recognize(canvas,{}, {text:true,tsv:true});let text=full.data.text;const ws=words(full.data.tsv||'');const cells=ws.filter(w=>w.confidence>=35).map(w=>({str:w.text,transform:[1,0,0,1,w.x,canvas.height-w.y-w.h],width:w.w,height:w.h}));
 const values:CV={...parseText(text),...spatial(cells)};const passes:{method:string;values:CV;uncertain?:string[]}[]=[{method:'OCR إنجليزي — الصورة الأصلية',values:{...values},uncertain:uncertainFields(values,ws)}];const checkedSkills=markedTableSkills(canvas,ws);if(checkedSkills!==undefined)values.skills=checkedSkills;
 // Re-read individual value cells at a larger scale instead of accepting a single clipped digit.
 for(const key of ['age','height','weight']){
  const label=ws.find(w=>w.text.replace(/[^a-z]/gi,'').toLowerCase()===key);let value=key==='age'?numeric(key,values.age||''):'';
  if(label&&!value){const right=ws.filter(w=>w.x>label.x+label.w&&Math.abs(w.y-label.y)<Math.max(label.h,w.h)*.6&&/^(weight|height|religion|position)$/i.test(w.text)).sort((a,b)=>a.x-b.x)[0];
   const r=key==='age'?{x:label.x+label.w+3,y:label.y-label.h*.85,w:Math.min(canvas.width*.27,label.h*19),h:label.h*2.6}:{x:label.x-40,y:label.y+label.h+2,w:right?right.x-label.x+33:Math.max(label.w+40,label.h*6),h:label.h*2.8};
   const crop=patch(canvas,r,3);await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:key==='age'?'0123456789':'0123456789.,mMcCkKgG '});let result=(await worker.recognize(crop)).data.text;
   if(key==='weight'&&!/kg/i.test(result)&&/^\s*\d{2,3}\s*$/.test(result))result+=' KG';
   value=numeric(key,result);
   if(!value){await worker.setParameters({tessedit_pageseg_mode:'13'});result=(await worker.recognize(crop)).data.text;if(key==='weight'&&!/kg/i.test(result)&&/^\s*\d{2,3}\s*$/.test(result))result+=' KG';value=numeric(key,result);}
  }
  if(!value&&key!=='age')value=numeric(key,text);
  if(value)values[key]=value;else delete values[key];
 }
 await worker.setParameters({tessedit_pageseg_mode:'11',tessedit_char_whitelist:''});
 if(page&&(!validIssueDate(values.issueDate||'')||!validDate(values.expiryDate||''))&&(pageNumber>1||/passport|passeport|republic/i.test(text))){
  for(const native of await pdfDocumentImages(page,pdfjs,canvas)){const crop=patch(native,{x:0,y:0,w:native.width,h:native.height},Math.min(2,2400/Math.max(native.width,native.height)));const read=await worker.recognize(crop,{}, {text:true,tsv:true});const t=read.data.text;text+='\n'+t;if(!/passport|passeport|P[<B][A-Z]{3}|republic/i.test(t))continue;const fields=parseText(t);for(const k of ['issueDate','expiryDate','birthDate'])if((k==='issueDate'?!validIssueDate(values[k]||''):!validDate(values[k]||''))&&(k==='issueDate'?validIssueDate(fields[k]||''):validDate(fields[k]||'')))values[k]=fields[k];
   if(!validIssueDate(values.issueDate||'')){await worker.setParameters({tessedit_pageseg_mode:'6'});for(const fy of [0,.3,.6])for(const fx of [0,.4]){const tile=patch(native,{x:native.width*fx,y:native.height*fy,w:native.width*.6,h:native.height*.4},3,false);const tileRead=await worker.recognize(tile,{}, {text:true,tsv:true});const part=tileRead.data.text;text+='\n'+part;const candidate=parseText(part);if(validIssueDate(candidate.issueDate||'')){values.issueDate=candidate.issueDate;break;}
    const label=words(tileRead.data.tsv||'').find(w=>/^issu(?:e|ance)$/i.test(w.text.replace(/[^a-z]/gi,'')));if(label){const dateBox={x:Math.max(0,label.x-label.h*20),y:label.y+label.h,w:label.h*40,h:label.h*2.1};for(const mode of ['7','13']){await worker.setParameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ./-'});const cell=(await worker.recognize(patch(tile,dateBox,2,false))).data.text;text+='\n'+cell;const m=cell.match(/(\d{1,2})\s*([A-Z]{3,9})\s*(20\d{2})/i);if(m){const date=m[1]+' '+m[2]+' '+m[3];if(validIssueDate(date)){values.issueDate=date;break;}}}await worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:''});if(validIssueDate(values.issueDate||''))break;}
}await worker.setParameters({tessedit_pageseg_mode:'11'});}
  }
 }
 // Passport dates often sit in the lower part of a scanned page with a noisy security background.
 if(!validIssueDate(values.issueDate||'')||!validDate(values.expiryDate||'')){
  if(/passport|passeport|P[<B][A-Z]{3}|republic|date of (?:birth|issue|issuance)/i.test(text)){
   const crop=patch(canvas,{x:0,y:canvas.height*.43,w:canvas.width,h:canvas.height*.57},1.8);const pass=await worker.recognize(crop,{}, {text:true,tsv:true});text+='\n'+pass.data.text;const found=parseText(pass.data.text);for(const key of ['issueDate','expiryDate','birthDate'])if(!validDate(values[key]||'')&&validDate(found[key]||''))values[key]=found[key];
  }
 }
 const finalDates=parseText(text);for(const k of ['issueDate','expiryDate','birthDate'])if(!validDate(values[k]||'')&&validDate(finalDates[k]||''))values[k]=finalDates[k];const mrz=passportMRZDates(text);if(mrz.expiryDate)values.expiryDate=mrz.expiryDate;
 await worker.reinitialize('eng+ara');await worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:''});
 const enhanced=await worker.recognize(enhanceDocument(canvas),{}, {text:true,tsv:true});const enhancedText=enhanced.data.text||'';
 const enhancedWords=words(enhanced.data.tsv||'').filter(w=>w.confidence>=50);const enhancedValues:CV={...parseText(enhancedText),...spatial(enhancedWords.map(w=>({str:w.text,transform:[1,0,0,1,w.x,canvas.height-w.y-w.h],width:w.w,height:w.h})))};
 passes.push({method:'OCR عربي وإنجليزي — صورة محسّنة',values:enhancedValues,uncertain:uncertainFields(enhancedValues,words(enhanced.data.tsv||''))});text+='\n[قراءة الصورة المحسّنة]\n'+enhancedText;
 // Fill gaps only; competing nonempty readings stay available for field review.
 for(const [key,value] of Object.entries(enhancedValues))if(!values[key]&&value)values[key]=value;
 if(fields.filter(([key])=>values[key]).length<12||ws.filter(w=>w.confidence<50).length>ws.length*.3){await worker.setParameters({tessedit_pageseg_mode:'11',tessedit_char_whitelist:''});const adaptive=await worker.recognize(adaptiveImage(canvas),{}, {text:true,tsv:true});const alt=parseText(adaptive.data.text||'');passes.push({method:'OCR بتباين محلي للمناطق المظللة',values:alt,uncertain:uncertainFields(alt,words(adaptive.data.tsv||''))});text+='\n'+(adaptive.data.text||'');for(const [key,value]of Object.entries(alt))if(!values[key]&&value)values[key]=value;}
 return {values,text,passes,skillsVerified:checkedSkills!==undefined};
}
