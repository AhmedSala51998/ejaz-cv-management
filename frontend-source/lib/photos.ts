import {basePath} from './base';
export type PhotoCandidate={src:string;label:string};
let detectorPromise:Promise<any>|null=null;
async function detector(){
 if(!detectorPromise)detectorPromise=(async()=>{
  const {FaceDetector,FilesetResolver}=await import('@mediapipe/tasks-vision');
  const wasm=await FilesetResolver.forVisionTasks((basePath+"/vendor/face"));
  return FaceDetector.createFromOptions(wasm,{baseOptions:{modelAssetPath:(basePath+"/vendor/face/face.tflite"),delegate:'CPU'},runningMode:'IMAGE',minDetectionConfidence:.55});
 })().catch(e=>{detectorPromise=null;throw e;});
 return detectorPromise;
}
export async function imageCanvas(src:Blob|string){
 const image=new Image();const url=typeof src==='string'?src:URL.createObjectURL(src);
 try{image.src=url;await image.decode();if(!image.width||!image.height||image.width*image.height>50000000)throw Error('أبعاد الصورة غير مناسبة.');
  const canvas=document.createElement('canvas');const scale=Math.min(1,2400/Math.max(image.width,image.height));
  canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
  canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);return canvas;
 }finally{if(typeof src!=='string')URL.revokeObjectURL(url);}
}
export function encodePhoto(canvas:HTMLCanvasElement){
 const out=document.createElement('canvas');const scale=Math.min(1,1000/Math.max(canvas.width,canvas.height));out.width=Math.max(1,Math.round(canvas.width*scale));out.height=Math.max(1,Math.round(canvas.height*scale));
 const ctx=out.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(canvas,0,0,out.width,out.height);
 let result=out.toDataURL('image/jpeg',.88);if(result.length>1100000)result=out.toDataURL('image/jpeg',.65);return result;
}
export async function normalizePhoto(file:File|Blob|string){
 if(file instanceof File&&(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>10*1024*1024))throw Error('اختر صورة JPG أو PNG أو WebP حتى 10 ميجابايت.');
 return encodePhoto(await imageCanvas(file));
}
export function portraitRect(face:{x:number,y:number,w:number,h:number},width:number,height:number){
 let h=face.h*2.9,w=h*.75;
 w=Math.min(w,width);h=Math.min(h,height);
 const x=Math.max(0,Math.min(width-w,face.x+face.w/2-w/2));
 const y=Math.max(0,Math.min(height-h,face.y-face.h*.55));
 return{x,y,w,h};
}
export async function portraits(canvas:HTMLCanvasElement,label:string):Promise<PhotoCandidate[]>{
 const model=await detector();const width=canvas.width,height=canvas.height;const boxes:{x:number,y:number,w:number,h:number,score:number}[]=[];
 const tiles=[{x:0,y:0,w:width,h:height},...Array.from({length:4},(_,i)=>({x:(i%2)*width*.45,y:Math.floor(i/2)*height*.45,w:width*.55,h:height*.55}))];
 for(const t of tiles){
  const tile=document.createElement('canvas');tile.width=Math.round(t.w);tile.height=Math.round(t.h);tile.getContext('2d')!.drawImage(canvas,t.x,t.y,t.w,t.h,0,0,tile.width,tile.height);
  const result=model.detect(tile);
  for(const d of result.detections){const b=d.boundingBox;if(!b)continue;const face={x:t.x+b.originX,y:t.y+b.originY,w:b.width,h:b.height,score:d.categories?.[0]?.score||0};
   if(face.w<20||face.h<20)continue;
   if(boxes.some(p=>Math.abs(p.x+p.w/2-face.x-face.w/2)<Math.max(p.w,face.w)*.6&&Math.abs(p.y+p.h/2-face.y-face.h/2)<Math.max(p.h,face.h)*.6))continue;
   boxes.push(face);
  }
 }
 return boxes.sort((a,b)=>b.w*b.h-a.w*a.h).slice(0,4).map((face,i)=>{
  const r=portraitRect(face,width,height),out=document.createElement('canvas');out.width=Math.round(r.w);out.height=Math.round(r.h);out.getContext('2d')!.drawImage(canvas,r.x,r.y,r.w,r.h,0,0,out.width,out.height);
  return{src:encodePhoto(out),label:label+' • صورة '+(i+1)};
 });
}
export async function wordPhotos(buffer:ArrayBuffer):Promise<string[]>{
 // Legacy DOC image streams commonly embed complete JPEG or PNG payloads.
 const a=new Uint8Array(buffer),images:string[]=[];
 for(let i=0;i<a.length-12&&images.length<12;i++){
  let end=-1,type='';
  if(a[i]===255&&a[i+1]===216&&a[i+2]===255){
   for(let j=i+3;j<Math.min(a.length,i+8000000)-1;j++)if(a[j]===255&&a[j+1]===217){end=j+2;type='image/jpeg';break;}
  }else if(a[i]===137&&a[i+1]===80&&a[i+2]===78&&a[i+3]===71){
   for(let j=i+8;j<Math.min(a.length,i+8000000)-8;j++)if(a[j]===73&&a[j+1]===69&&a[j+2]===78&&a[j+3]===68){end=j+8;type='image/png';break;}
  }
  if(end>i+1000){try{const c=await imageCanvas(new Blob([a.slice(i,end)],{type}));if(c.width>80&&c.height>80)images.push(c.toDataURL());}catch{}i=end-1;}
 }
 return images;
}
