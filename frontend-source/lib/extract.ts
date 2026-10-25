import {shouldUseReviewedSkills} from './skill-policy';
import {orderPhotos} from './photo-policy';
import {readSelectionTables,pdfLayoutWords} from './selection-tables';
import {prepareImage,reviewImageOrientation,ocrWorker} from './document-tools';
import {buildReview,Evidence,reviewJSON} from './field-review';
import {reviewOCR} from './ocr-review';
import {basePath} from './base';
import {CV,normalizePassport} from './fields';
import {parseArabic,spatialArabic,completeNames,digits,mergeArabic} from './arabic';
import {portraits,documentPortrait,pdfPortraits,imageCanvas,wordPhotos,PhotoCandidate} from './profile-extraction';
import {parseText,spatial,textRows,finalizeData,validDate,validIssueDate,datesInOrder,passportMRZDates} from './parser';
export {parseText,spatial,textRows} from './parser';
function cleanTable(canvas:HTMLCanvasElement){
 const ctx=canvas.getContext('2d')!;const image=ctx.getImageData(0,0,canvas.width,canvas.height);const a=image.data,w=canvas.width,h=canvas.height;const dark=new Uint8Array(w*h),wipe=new Uint8Array(w*h);
 for(let i=0;i<w*h;i++)dark[i]=(a[i*4]+a[i*4+1]+a[i*4+2])/3<180?1:0;
 for(let y=0;y<h;y++){let start=-1;for(let x=0;x<=w;x++){if(x<w&&dark[y*w+x]){if(start<0)start=x;}else if(start>=0){if(x-start>70)for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=start;xx<x;xx++)wipe[yy*w+xx]=1;start=-1;}}}
 for(let x=0;x<w;x++){let start=-1;for(let y=0;y<=h;y++){if(y<h&&dark[y*w+x]){if(start<0)start=y;}else if(start>=0){if(y-start>60)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++)for(let yy=start;yy<y;yy++)wipe[yy*w+xx]=1;start=-1;}}}
 for(let i=0;i<w*h;i++)if(wipe[i])a[i*4]=a[i*4+1]=a[i*4+2]=255;ctx.putImageData(image,0,0);
}

export async function extract(file:File,onProgress:(s:string)=>void){
 const ext=file.name.split('.').pop()?.toLowerCase();let text='',sourceText='',preview='',pages=0,ocr=false;let data:CV={};const reviewed:CV={};const evidence:Evidence[]=[];const reviewNotices:string[]=[];let photoCandidates:PhotoCandidate[]=[];let photoNotice='';
 if(ext==='pdf'){
  const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=(basePath+"/vendor/pdf/pdf.worker.min.mjs");
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});const doc=await task.promise;
  if(doc.numPages>20){await task.destroy();throw Error('الحد الأقصى 20 صفحة لكل ملف.');}pages=doc.numPages;
  let worker:any=null;
  try{for(let p=1;p<=doc.numPages;p++){
   onProgress(`قراءة الصفحة ${p} من ${doc.numPages}`);const page=await doc.getPage(p);const content=await page.getTextContent();const items=content.items as any[];
   const plain=textRows(items);const nativeValues={...parseText(plain),...spatial(items)};if(items.some(i=>/^[☒✓✔]$/.test((i.str||'').trim()))){for(const key of ['skills','marital'])if(nativeValues[key]&&!reviewed[key])reviewed[key]=nativeValues[key];}const missingNumeric=['age','height','weight'].some(k=>new RegExp('\\b'+k+'\\b','i').test(plain)&&!nativeValues[k]);let pageText=plain,rawPageText=plain;evidence.push({page:p,method:'نص PDF',values:nativeValues});let ocrFallback:CV={};
   const needOCR=plain.replace(/\s/g,'').length<70||((plain.match(/�/g)||[]).length>plain.length*.02);
   {const natural=page.getViewport({scale:1});const renderScale=Math.min(needOCR?2.5:2,Math.sqrt(6500000/(natural.width*natural.height)));const vp=page.getViewport({scale:renderScale});const canvas=document.createElement('canvas');canvas.width=vp.width;canvas.height=vp.height;await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport:vp} as any).promise;
    if(p===1)preview=previewCanvas(canvas);
    const selections=readSelectionTables(canvas,pdfLayoutWords(items,page,canvas));if(Object.keys(selections.values).length){evidence.push({page:p,method:'علامات الاختيار الأصلية في PDF',values:selections.values});for(const [key,value] of Object.entries(selections.values))reviewed[key]=value;}for(const key of selections.uncertain)reviewNotices.push('أكثر من اختيار في جدول اللغة '+key+'؛ راجع الأصل.');
    if(!needOCR){onProgress('البحث عن الصورة الشخصية في الصفحة '+p);try{photoCandidates.push(...await pdfPortraits(page,pdfjs,canvas,p,plain));}catch{photoNotice='تعذر تحديد الصورة تلقائيًا؛ يمكنك رفع صورة أو تحديدها يدويًا من المعاينة.';}}

    if(needOCR){ocr=true;onProgress(`استخراج OCR • الصفحة ${p} من ${doc.numPages}`);if(!worker){const{createWorker}=await import('tesseract.js');worker=await createWorker('eng+ara',1,{workerPath:(basePath+"/vendor/ocr/worker.min.js"),corePath:(basePath+"/vendor/ocr"),langPath:(basePath+"/vendor/ocr"),logger:()=>{}});}await worker.setParameters({tessedit_pageseg_mode:'11'});const result=await worker.recognize(canvas,{}, {text:true,tsv:true});pageText=result.data.text;rawPageText=result.data.text;const ocrItems=ocrCells(result.data.tsv||'',canvas.height);if(ocrItems.length){pageText=textRows(ocrItems);ocrFallback={...parseText(pageText),...spatial(ocrItems)};}
     if(p===1){await worker.reinitialize('eng');await worker.setParameters({tessedit_pageseg_mode:'6'});const englishResult=await worker.recognize(canvas);ocrFallback=mergeArabic(ocrFallback,parseText(englishResult.data.text));await worker.reinitialize('eng+ara');}
}
    {onProgress('مراجعة مستقلة لكل البيانات • الصفحة '+p);if(!worker){const{createWorker}=await import('tesseract.js');worker=await createWorker('eng+ara',1,{workerPath:(basePath+"/vendor/ocr/worker.min.js"),corePath:(basePath+"/vendor/ocr"),langPath:(basePath+"/vendor/ocr"),logger:()=>{}});}const review=await reviewOCR(canvas,worker,page,pdfjs,p);rawPageText+='\n\n[قراءة المراجعة]\n'+review.text;const fallbackValues={...review.values};delete fallbackValues.notes;ocrFallback=mergeArabic(ocrFallback,fallbackValues);evidence.push({page:p,method:'مراجعة OCR',values:review.values});for(const pass of review.passes)evidence.push({page:p,method:pass.method,values:pass.values,uncertain:pass.uncertain});for(const key of ['english','arabic'])if(review.values[key]&&!reviewed[key])reviewed[key]=review.values[key];if(reviewed.skills===undefined&&shouldUseReviewedSkills(nativeValues.skills,review.values.skills,needOCR,review.skillsVerified))reviewed.skills=review.values.skills;for(const k of ['age','height','weight'])if(review.values[k]&&!reviewed[k]&&(needOCR||!nativeValues[k]))reviewed[k]=review.values[k];for(const k of ['issueDate','expiryDate','birthDate'])if((k==='birthDate'||p===1||(/passport|passeport|P<[A-Z]{3}/i.test(rawPageText)||!!passportMRZDates(rawPageText).expiryDate))&&(k==='issueDate'?validIssueDate(review.values[k]||''):validDate(review.values[k]||''))&&!validDate(reviewed[k]||''))reviewed[k]=review.values[k];}
   }
   if(needOCR){try{photoCandidates.push(...await pdfPortraits(page,pdfjs,await renderPage(page),p,pageText));}catch{photoNotice='تعذر تحديد الصورة؛ يمكنك رفعها يدويًا.';}}
   sourceText+='\n\n--- صفحة '+p+' ---\n'+rawPageText;text+='\n'+pageText;
   {
    const primaryPageData=needOCR?mergeArabic({...parseText(pageText),...ocrFallback},parseArabic(pageText)):mergeArabic({...parseText(pageText),...spatial(items)}, {...parseArabic(pageText),...spatialArabic(items)});const pageData=mergeArabic(primaryPageData,ocrFallback);
    evidence.push({page:p,method:needOCR?'OCR أولي':'حقول الصفحة',values:{...pageData}});
    if(pageData.issueDate&&!validIssueDate(pageData.issueDate)){reviewNotices.push('تم تجاهل تاريخ إصدار غير صالح في الصفحة '+p+'؛ راجع القيمة المعتمدة مقابل صورة الجواز.');delete pageData.issueDate;}if(pageData.issueDate&&pageData.expiryDate&&!datesInOrder(pageData.issueDate,pageData.expiryDate)){reviewNotices.push('انتهاء الجواز في الصفحة '+p+' أقدم من الإصدار؛ جرى البحث عن بديل في صفحات الجواز.');delete pageData.expiryDate;}
    for(const k of ['birthDate','issueDate','expiryDate'])if(pageData[k]&&(!validDate(pageData[k])||p>1&&k!=='birthDate'&&!(/passport|passeport|P<[A-Z]{3}/i.test(rawPageText)||!!passportMRZDates(rawPageText).expiryDate)))delete pageData[k];
    data=mergeArabic(data,pageData);
    if(needOCR&&p===1){if(ocrFallback.birthDate?.match(/\d{1,2}[/-]\d{1,2}[/-]\d{4}/))data.birthDate=ocrFallback.birthDate.match(/\d{1,2}[/-]\d{1,2}[/-]\d{4}/)![0];
      for(const k of ['address','birthPlace'])if(ocrFallback[k])data[k]=ocrFallback[k].match(/^[A-Z][A-Z\s]+/)?.[0]?.trim()||data[k];
    }
   }
  }}finally{if(worker)await worker.terminate();await task.destroy();}
 }else if(['jpg','jpeg','png','webp'].includes(ext||'')){
  pages=1;ocr=true;onProgress('تحسين الصورة وفحص اتجاهها');const url=URL.createObjectURL(file);let worker:any=null;try{let canvas=prepareImage(await imageCanvas(url));preview=previewCanvas(canvas);worker=await ocrWorker();const oriented=await reviewImageOrientation(canvas,worker);canvas=oriented.canvas;if(oriented.angle)reviewNotices.push('تمت قراءة نسخة مدوّرة '+oriented.angle+' درجة؛ راجع الحقول مقابل الأصل.');const raw=oriented.result.data.text||'';const primary=mergeArabic(parseText(raw),parseArabic(raw));evidence.push({page:1,method:'OCR الصورة الأصلية',values:primary});onProgress('إعادة قراءة الصورة ومراجعة الخانات');const review=await reviewOCR(canvas,worker,undefined,undefined,1);text=raw+'\n'+review.text;sourceText=text;data=mergeArabic(primary,mergeArabic(review.values,parseArabic(review.text)));for(const pass of review.passes)evidence.push({page:1,method:pass.method,values:pass.values,uncertain:pass.uncertain});photoCandidates.push(...await documentPortrait(canvas,'الصورة المرفوعة'));}finally{if(worker)await worker.terminate();URL.revokeObjectURL(url);}
 }else if(ext==='docx'){
  const buffer=await file.arrayBuffer();const mammoth=await import('mammoth');const result=await mammoth.extractRawText({arrayBuffer:buffer});text=result.value;
  const images:string[]=[];
  const converted=await mammoth.convertToHtml({arrayBuffer:buffer},{convertImage:mammoth.images.imgElement(async image=>{const base64=await image.readAsBase64String();const src='data:'+image.contentType+';base64,'+base64;if(images.length<12)images.push(src);return{src:''};})});
  const html=new DOMParser().parseFromString(converted.value,'text/html');const tableText=[...html.querySelectorAll('tr')].map(row=>[...row.querySelectorAll('td,th')].map(c=>c.textContent?.trim()||'').join(' : ')).join('\n');evidence.push({page:1,method:'نص Word',values:mergeArabic(parseText(text),parseArabic(text))});if(tableText){text+='\n'+tableText;evidence.push({page:1,method:'جداول Word',values:mergeArabic(parseText(tableText),parseArabic(tableText))});}
  for(const src of images){try{const canvas=await imageCanvas(src);photoCandidates.push(...await documentPortrait(canvas,'صورة Word'));if((text.trim().length<180||!parseText(text).passport)&&Math.min(canvas.width,canvas.height)>250){const found=await readImageText(canvas);text+='\n'+found;evidence.push({page:1,method:'OCR صورة داخل Word',values:mergeArabic(parseText(found),parseArabic(found))});}}catch{photoNotice='يمكنك إضافة صورة بديلة إذا لم يتم التعرف على صورة الملف.';}}
  data=mergeArabic(parseText(text),parseArabic(text));

 }else if(ext==='doc'){
  const buffer=await file.arrayBuffer();text=await readDoc(buffer);data=mergeArabic(parseText(text),parseArabic(text));
  for(const src of await wordPhotos(buffer)){try{photoCandidates.push(...await documentPortrait(await imageCanvas(src),'صورة Word'));}catch{photoNotice='يمكنك رفع الصورة يدويًا إذا تعذّر استخراجها.';}}

 }else throw Error('الملفات المدعومة PDF وDOCX وDOC وJPG وPNG وWebP.');
 const combined=mergeArabic(parseText(text),parseArabic(text));delete combined.notes;if(ext==='pdf')for(const k of ['birthDate','issueDate','expiryDate'])delete combined[k];data=mergeArabic(data,combined);
 if(data.passport){const m=digits(data.passport).match(/\b[A-Z]{0,2}\d{6,10}[A-Z]?\b/i);data.passport=m?normalizePassport(m[0]):'';}
 if(data.age)data.age=data.age.match(/\d{1,3}/)?.[0]||'';
 if(data.salary){data.currency=/USD|\$/i.test(data.salary)?'USD':/SAR|SR/i.test(data.salary)?'SAR':data.currency||'';data.salary=data.salary.match(/[\d,]+(?:\.\d+)?/)?.[0]?.replace(/,/g,'')||'';}
 if(data.height&&/kg/i.test(data.height)){data.weight=data.height.match(/(\d+(?:\.\d+)?)\s*kg/i)?.[1]||'';data.height=data.height.match(/(\d+(?:\.\d+)?)\s*cm/i)?.[1]||data.height;}
 for(const k of ['english','arabic'])if(!/[a-z\u0600-\u06ff]/i.test(data[k]||''))data[k]='';
 if(/single/i.test(data.marital||'')&&/married/i.test(data.marital||''))data.marital='';
 else if(/^married$/i.test(data.marital||''))data.marital='MARRIED';
 for(const key of ['skills','english','arabic','marital'])if(reviewed[key]!==undefined)data[key]=reviewed[key];for(const k of ['age','height','weight'])if(reviewed[k])data[k]=reviewed[k];for(const k of ['birthDate','issueDate','expiryDate'])if((!validDate(data[k]||'')||k==='issueDate'&&!validIssueDate(data[k])||k==='expiryDate'&&data.issueDate&&!datesInOrder(data.issueDate,data[k]))&&reviewed[k])data[k]=reviewed[k];
 const finalized=finalizeData(data,text);data=finalized.data;const warnings=[...new Set([...finalized.warnings,...reviewNotices])];
 data=completeNames(data);data._review=reviewJSON(buildReview(data,evidence,warnings));data.extractedText=(sourceText||text).trim().slice(0,200000);const provenance:Record<string,any[]>={};for(const item of evidence)for(const [key,value] of Object.entries(item.values))if(value&&key!=='notes'&&!key.startsWith('_')){const list=provenance[key]||=[];if(list.length<8&&!list.some(v=>v.page===item.page&&v.method===item.method&&v.value===value))list.push({page:item.page,method:item.method,value:value.slice(0,500)});provenance[key]=list;}let provenanceJSON=JSON.stringify(provenance);while(provenanceJSON.length>75000){const list=Object.values(provenance).sort((a,b)=>b.length-a.length)[0];if(!list?.length)break;list.pop();provenanceJSON=JSON.stringify(provenance);}data._evidence=provenanceJSON;
 photoCandidates=orderPhotos(photoCandidates).slice(0,12);
 const preferred=photoCandidates.filter(c=>c.kind==='profile');const fallback=photoCandidates.filter(c=>c.kind==='passport');
 const choices=preferred.length?preferred:fallback;const photo=choices[0]?.src||'';
 if(!photo)photoNotice=photoCandidates.length===1?'الصورة المستخرجة غير مؤكدة؛ اخترها بعد مراجعتها أو ارفع الصورة بنفسك.':photoCandidates.length?'يوجد أكثر من احتمال للصورة؛ اختر صورة صاحب السيرة بنفسك أو ارفعها.':'لم نعثر على صورة شخصية موثوقة في السيرة أو الجواز؛ ارفع الصورة يدويًا.';
 return {data,text,preview,pages,ocr,photoCandidates,photo,photoNotice,warnings};
}
async function readImageText(canvas:HTMLCanvasElement){
 const{createWorker,PSM}=await import('tesseract.js');const worker=await createWorker('eng+ara',1,{workerPath:(basePath+"/vendor/ocr/worker.min.js"),corePath:(basePath+"/vendor/ocr"),langPath:(basePath+"/vendor/ocr")});
 try{cleanTable(canvas);await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK});return(await worker.recognize(canvas)).data.text;}finally{await worker.terminate();}
}
async function readDoc(buffer:ArrayBuffer){
 const CFB=await import('cfb');const cfb=CFB.read(new Uint8Array(buffer),{type:'array'});const w=CFB.find(cfb,'WordDocument');if(!w?.content)throw Error('ملف Word غير صالح. جرّب حفظه DOCX.');
 const bytes=new Uint8Array(w.content as any);const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint16(10,true)&0x100)throw Error('الملف محمي بكلمة مرور. ارفع نسخة غير محمية.');
 const table=CFB.find(cfb,(view.getUint16(10,true)&0x200)?'1Table':'0Table');if(!table?.content)throw Error('تعذر قراءة إصدار Word القديم. احفظه بصيغة DOCX.');
 const tb=new Uint8Array(table.content as any),tv=new DataView(tb.buffer,tb.byteOffset,tb.byteLength);let pos=view.getUint32(0x1a2,true);const end=pos+view.getUint32(0x1a6,true);let text='';
 while(pos<end&&pos<tb.length){if(tb[pos]===1){pos+=3+tv.getUint16(pos+1,true);continue;}if(tb[pos]!==2)break;const len=tv.getUint32(pos+1,true),n=(len-4)/12;base:for(let i=0;i<n;i++){const cp=pos+5;const start=tv.getUint32(cp+i*4,true),finish=tv.getUint32(cp+(i+1)*4,true);const off=tv.getUint32(cp+(n+1)*4+i*8+2,true);const compressed=(off&0x40000000)!==0;const fc=(off&0x3fffffff)/(compressed?2:1);const count=(finish-start)*(compressed?1:2);if(count<0||fc+count>bytes.length)continue base;text+=new TextDecoder(compressed?'windows-1252':'utf-16le').decode(bytes.slice(fc,fc+count));}break;}
 if(!text.trim())throw Error('تعذر استخراج نص هذا الملف؛ احفظه PDF أو DOCX.');return text.replace(/[\r\x07\x0b\x0c]/g,'\n');
}

async function renderPage(page:any){const vp=page.getViewport({scale:1.7});const canvas=document.createElement('canvas');canvas.width=vp.width;canvas.height=vp.height;await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport:vp}).promise;return canvas;}
function ocrCells(tsv:string,height:number){const words=tsv.trim().split('\n').slice(1).map(line=>line.split('\t')).filter(c=>c[0]==='5'&&Number(c[10])>=40&&c[11]?.trim());const lines=new Map<string,any[]>();for(const c of words){const key=c.slice(1,5).join('-');const group=lines.get(key)||[];group.push(c);lines.set(key,group);}return [...lines.values()].flatMap(group=>{const cells:any[]=[];let current:any=null;for(const c of group){const x=Number(c[6]),y=Number(c[7]),w=Number(c[8]),h=Number(c[9]);if(!current||x-current.transform[4]-current.width>Math.max(18,h*1.6)){current={str:c[11],transform:[1,0,0,1,x,height-y-h],width:w,height:h};cells.push(current);}else{current.str+=' '+c[11];current.width=x+w-current.transform[4];}}return cells;});}
function previewCanvas(source:HTMLCanvasElement){const scale=Math.min(1,1400/Math.max(source.width,source.height));const out=document.createElement('canvas');out.width=Math.round(source.width*scale);out.height=Math.round(source.height*scale);out.getContext('2d')!.drawImage(source,0,0,out.width,out.height);return out.toDataURL('image/jpeg',.82);}
