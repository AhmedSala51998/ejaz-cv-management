import {basePath} from './base';
import {parseTicket} from './ticket-parser';
import {reviewImageOrientation} from './document-tools';

async function ticketWorker(){const {createWorker}=await import('tesseract.js');return createWorker('eng',1,{workerPath:basePath+'/vendor/ocr/worker.min.js',corePath:basePath+'/vendor/ocr',langPath:basePath+'/vendor/ocr',logger:()=>{}});}
async function readTicketImage(canvas:HTMLCanvasElement,worker:any){const oriented=await reviewImageOrientation(canvas,worker);await worker.setParameters({tessedit_pageseg_mode:'3'});const second=await worker.recognize(oriented.canvas);return {text:second.data.text||oriented.result.data.text||'',confidence:second.data.confidence||0};}

export function ticketLayout(items:any[],pageWidth:number):string {
 const rows:{y:number;items:any[]}[]=[];
 for(const item of items.filter(i=>i.str?.trim())){const y=item.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<Math.max(2,(item.height||8)*.35));if(!row){row={y,items:[]};rows.push(row);}row.items.push(item);}
 return rows.sort((a,b)=>b.y-a.y).map(r=>{let line='';for(const item of r.items.sort((a,b)=>a.transform[4]-b.transform[4])){const at=Math.round(item.transform[4]/pageWidth*140);line+=' '.repeat(Math.max(line?2:0,at-line.length))+item.str.trim();}return line;}).join('\n');
}
export async function extractTicket(file:File,progress:(s:string)=>void){
 if(file.size>25*1024*1024)throw Error('الحد الأقصى للملف 25 ميجابايت.');
 const ext=file.name.split('.').pop()?.toLowerCase();if(!['pdf','png','jpg','jpeg','webp'].includes(ext||''))throw Error('ارفع تذكرة PDF أو صورة JPG / PNG / WebP.');
 let text='',ocr=false,worker:any=null,pdf:any=null,pdfTask:any=null;let pages=1;const warnings:string[]=[];
 try{
  if(ext==='pdf'){
   const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=basePath+'/vendor/pdf/pdf.worker.min.mjs';
   pdfTask=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});pdf=await pdfTask.promise;
   pages=pdf.numPages;if(pages>30)throw Error('التذكرة أكثر من 30 صفحة؛ قسّم الملف أولًا.');
   for(let n=1;n<=pages;n++){
    progress(`قراءة التذكرة — صفحة ${n} من ${pages}`);const page=await pdf.getPage(n);const content=await page.getTextContent();let pageText=ticketLayout(content.items,page.getViewport({scale:1}).width);
    const compact=pageText.replace(/\s/g,'');const incomplete=compact.length<350&&!/\d{1,2}\s*[:∶]\s*\d{2}/.test(pageText);
    if(compact.length<70||incomplete){
     ocr=true;progress(`OCR — صفحة ${n} من ${pages}`);const v=page.getViewport({scale:Math.min(3,2200/Math.max(page.view[2],page.view[3]))});const canvas=document.createElement('canvas');canvas.width=v.width;canvas.height=v.height;
     await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport:v}).promise;worker=worker||await ticketWorker();const result=await readTicketImage(canvas,worker);pageText=result.text;if(result.confidence<65)warnings.push(`جودة OCR في الصفحة ${n} منخفضة؛ راجعها بعناية.`);canvas.width=canvas.height=1;
    }
    text+='\n'+pageText+'\n';page.cleanup();
   }
  }else{
   ocr=true;progress('قراءة صورة التذكرة OCR');const image=new Image();const src=URL.createObjectURL(file);
   try{image.src=src;await image.decode();if(image.naturalWidth*image.naturalHeight>50000000)throw Error('أبعاد الصورة كبيرة؛ صغّرها إلى أقل من 50 ميجابكسل.');const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d')!.drawImage(image,0,0);worker=await ticketWorker();const result=await readTicketImage(canvas,worker);text=result.text;if(result.confidence<65)warnings.push('جودة الصورة منخفضة؛ راجع جميع الحقول.');canvas.width=canvas.height=1;}finally{URL.revokeObjectURL(src);}
  }
 }finally{if(worker)await worker.terminate();if(pdfTask)await pdfTask.destroy();}
 if(!text.trim())throw Error('لم يُستخرج نص مقروء. يمكنك إدخال البيانات يدويًا مع حفظ الملف الأصلي.');
 if(text.length>200000)throw Error('النص أطول من الحد المسموح؛ قسّم الملف حتى لا تُفقد أي صفحات من النص المستخرج.');
 const data=parseTicket(text);data.extractionMethod=ocr?'PDF / Image + OCR':'PDF text';
 if(!data.passengers.length)warnings.push('لم يُقرأ اسم مسافر موثوق؛ أدخله يدويًا.');
 if(/^\s*(?:MS|MR|MRS)\s+(?:\d|CHICKEN|$)/im.test(text))warnings.push('يوجد صف مسافر بلا اسم واضح في الأصل؛ راجع عدد المسافرين ولا تعتمد الدفعة قبل التأكد.');
 if(!data.segments.length)warnings.push('لم تُقرأ مراحل الرحلة؛ أضفها من الأصل.');
 if(data.segments.some(s=>!s.from||!s.to||!s.departureDate||!s.departureTime||!s.arrivalDate||!s.arrivalTime))warnings.push('بعض حقول الرحلة ناقصة؛ راجع الأصل وأكمل المتاح.');
 if(data.baseFare&&data.taxes&&data.total&&Math.abs(Number(data.baseFare)+Number(data.taxes)-Number(data.total))>.011)warnings.push('الأجرة والضرائب لا تطابق الإجمالي المقروء؛ راجع تفاصيل الدفع.');
 if(data.passengers.some(p=>p.passport&&!/^[A-Z0-9]{5,20}$/.test(p.passport)))warnings.push('يوجد رقم جواز يحتاج مراجعة قبل المطابقة.');
 warnings.push('الأوقات محلية لكل مطار. راجع التواريخ ورقم الجواز والرحلات قبل اعتماد الحفظ.');
 return {data,text,ocr,pages,warnings};
}
