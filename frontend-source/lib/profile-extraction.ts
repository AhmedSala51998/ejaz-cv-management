import {photoPageKind,orderPhotos} from './photo-policy';
import {basePath} from './base';
export type PhotoCandidate={src:string;label:string;kind?:'profile'|'passport'|'uncertain';faceRatio?:number;fullBody?:boolean};
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
 let h=face.h*4.6,w=h*.75;
 w=Math.min(w,width);h=Math.min(h,height);
 const x=Math.max(0,Math.min(width-w,face.x+face.w/2-w/2));
 const y=Math.max(0,Math.min(height-h,face.y-face.h*.55));
 return{x,y,w,h};
}
type Face={x:number;y:number;w:number;h:number;score:number};
async function faceBoxes(canvas:HTMLCanvasElement,fine=false){
 const model=await detector(),width=canvas.width,height=canvas.height,boxes:Face[]=[];
 const tiles=[{x:0,y:0,w:width,h:height}];
 for(const factor of (fine?[.18,.1]:[.55,.3])){const tw=width*factor,th=height*factor;const nx=Math.ceil((width-tw)/(tw*.65))+1,ny=Math.ceil((height-th)/(th*.65))+1;
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)tiles.push({x:x*(width-tw)/Math.max(1,nx-1),y:y*(height-th)/Math.max(1,ny-1),w:tw,h:th});}
 for(const t of tiles){const tile=document.createElement('canvas'),scale=Math.min(3,640/Math.max(t.w,t.h));tile.width=Math.round(t.w*scale);tile.height=Math.round(t.h*scale);tile.getContext('2d')!.drawImage(canvas,t.x,t.y,t.w,t.h,0,0,tile.width,tile.height);
  for(const d of model.detect(tile).detections||[]){const b=d.boundingBox;if(!b)continue;const f={x:t.x+b.originX/scale,y:t.y+b.originY/scale,w:b.width/scale,h:b.height/scale,score:d.categories?.[0]?.score||0};
   if(f.score<(fine?.85:.75)||f.w<18||f.h<18||f.w/f.h<.55||f.w/f.h>1.5)continue;
   if(f.x<0||f.y<0||f.x+f.w>width+2||f.y+f.h>height+2)continue;
   const duplicate=boxes.findIndex(p=>Math.abs(p.x+p.w/2-f.x-f.w/2)<Math.max(p.w,f.w)*.45&&Math.abs(p.y+p.h/2-f.y-f.h/2)<Math.max(p.h,f.h)*.45);
   if(duplicate<0)boxes.push(f);else if(f.score>boxes[duplicate].score)boxes[duplicate]=f;
  }
 }
 return boxes;
}
function framedPhotoRect(canvas:HTMLCanvasElement,face:Face){
 const w=canvas.width,h=canvas.height,p=canvas.getContext('2d')!.getImageData(0,0,w,h).data;
 const dark=(x:number,y:number)=>{if(x<0||y<0||x>=w||y>=h)return false;const i=(y*w+x)*4;return p[i]+p[i+1]+p[i+2]<390;};
 const y0=Math.max(0,Math.round(face.y-face.h*.15)),y1=Math.min(h-1,Math.round(face.y+face.h*1.3));
 const vertical=(x:number)=>{let n=0;for(let y=y0;y<=y1;y++)if(dark(x,y)||dark(x-1,y)||dark(x+1,y))n++;return n/(y1-y0+1)>.8;};
 let left=-1,right=-1;
 for(let x=Math.floor(face.x-4);x>Math.max(0,face.x-face.w*2.2);x--)if(vertical(x)){left=x;break;}
 for(let x=Math.ceil(face.x+face.w+4);x<Math.min(w,face.x+face.w*3.2);x++)if(vertical(x)){right=x;break;}
 if(left<0||right<0)return null;
 const horizontal=(y:number)=>{let n=0;for(let x=left+3;x<right-3;x++)if(dark(x,y)||dark(x,y-1)||dark(x,y+1))n++;return n/Math.max(1,right-left-6)>.8;};
 let top=-1,bottom=-1;
 for(let y=Math.floor(face.y-4);y>Math.max(0,face.y-face.h*1.5);y--)if(horizontal(y)){top=y;break;}
 for(let y=Math.ceil(face.y+face.h*1.15);y<Math.min(h,face.y+face.h*3);y++)if(horizontal(y)){bottom=y;break;}
 if(top<0||bottom<0||(right-left)/(bottom-top)<.3||(right-left)/(bottom-top)>1.6||(right-left)*(bottom-top)>w*h*.35)return null;
 return {x:left+2,y:top+2,w:right-left-4,h:bottom-top-4};
}
function cropFace(canvas:HTMLCanvasElement,face:Face,label:string):PhotoCandidate{
 const r=framedPhotoRect(canvas,face)||portraitRect(face,canvas.width,canvas.height),out=document.createElement('canvas');out.width=Math.max(1,Math.round(r.w));out.height=Math.max(1,Math.round(r.h));out.getContext('2d')!.drawImage(canvas,r.x,r.y,r.w,r.h,0,0,out.width,out.height);
 return {src:encodePhoto(out),label,faceRatio:face.w/canvas.width};
}
export async function portraits(canvas:HTMLCanvasElement,label:string):Promise<PhotoCandidate[]>{return (await faceBoxes(canvas)).sort((a,b)=>b.w*b.h-a.w*a.h).slice(0,6).map((f,i)=>cropFace(canvas,f,label+' • '+(i+1)));}
type EmbeddedPhoto={x:number;y:number;w:number;h:number;image:any};
async function embeddedPhotos(page:any,pdfjs:any,canvas:HTMLCanvasElement):Promise<EmbeddedPhoto[]>{
 const ops=await page.getOperatorList(),vp=page.getViewport({scale:canvas.width/page.getViewport({scale:1}).width});
 const mul=(a:number[],b:number[])=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 let matrix=[1,0,0,1,0,0];const stack:number[][]=[],result:EmbeddedPhoto[]=[];
 for(let i=0;i<ops.fnArray.length;i++){
  const op=ops.fnArray[i],args=ops.argsArray[i];
  if(op===pdfjs.OPS.save){stack.push([...matrix]);continue;}
  if(op===pdfjs.OPS.restore){matrix=stack.pop()||[1,0,0,1,0,0];continue;}
  if(op===pdfjs.OPS.transform){matrix=mul(matrix,args);continue;}
  if(op!==pdfjs.OPS.paintImageXObject&&op!==pdfjs.OPS.paintInlineImageXObject)continue;
  const m=mul(vp.transform,matrix),points=[[0,0],[1,0],[0,1],[1,1]].map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);let image:any=null;
  try{if(op===pdfjs.OPS.paintInlineImageXObject)image=args[0];else{const objects=String(args[0]).startsWith('g_')?page.commonObjs:page.objs;image=objects.has(args[0])?objects.get(args[0]):await new Promise(resolve=>{const timer=setTimeout(()=>resolve(null),2000);objects.get(args[0],(value:any)=>{clearTimeout(timer);resolve(value);});});}}catch{}
  result.push({x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),image});
 }
 return result;
}
function fullPhoto(canvas:HTMLCanvasElement,face:Face,images:EmbeddedPhoto[],label:string):PhotoCandidate{
 const image=images.filter(r=>r.w>30&&r.h>40&&r.w/r.h>.16&&r.w/r.h<1.7&&r.w*r.h<canvas.width*canvas.height*.65&&face.x+face.w*.5>r.x&&face.x+face.w*.5<r.x+r.w&&face.y+face.h*.5>r.y&&face.y+face.h*.5<r.y+r.h&&face.h/r.h>.025&&face.h/r.h<.9).sort((a,b)=>a.w*a.h-b.w*b.h)[0];
 if(!image)return cropFace(canvas,face,label);
 const native=image.image,out=document.createElement('canvas');
 // Preserve the embedded photo's original pixels, rather than magnifying a tiny face crop.
 if(native?.bitmap){out.width=native.width;out.height=native.height;out.getContext('2d')!.drawImage(native.bitmap,0,0);}
 else if(native?.data&&native.width&&native.height&&native.data.length>=native.width*native.height*3){
  out.width=native.width;out.height=native.height;const pixels=out.getContext('2d')!.createImageData(out.width,out.height),channels=native.data.length/(out.width*out.height);
  for(let i=0;i<out.width*out.height;i++){for(let c=0;c<3;c++)pixels.data[i*4+c]=native.data[i*channels+c];pixels.data[i*4+3]=channels===4?native.data[i*4+3]:255;}out.getContext('2d')!.putImageData(pixels,0,0);
 }else{out.width=Math.round(image.w);out.height=Math.round(image.h);out.getContext('2d')!.drawImage(canvas,image.x,image.y,image.w,image.h,0,0,out.width,out.height);}
 return {src:encodePhoto(out),label:label+' • الصورة كاملة',faceRatio:face.w/canvas.width,fullBody:image.h/image.w>1.5&&face.h/image.h<.3};
}
export async function pdfPortraits(_page:any,_pdfjs:any,canvas:HTMLCanvasElement,pageNumber:number,text:string):Promise<PhotoCandidate[]>{
 let images:EmbeddedPhoto[]=[];try{images=await embeddedPhotos(_page,_pdfjs,canvas);}catch{}
 const kind=photoPageKind(text),cvPage=kind==='profile',passportPage=kind==='passport';
 let detected=await faceBoxes(canvas);
 // Full-body CV photos have tiny faces; scan magnified local regions before falling back to a passport.
 if(cvPage)detected.push(...await faceBoxes(canvas,true));
 const faces=detected.filter(f=>f.w/canvas.width<.4&&f.h/canvas.height<.35);
 faces.sort((a,b)=>cvPage?(a.y-b.y)||b.w*b.h-a.w*a.h:b.w*b.h-a.w*a.h);
 return orderPhotos(faces.slice(0,12).map((face,i)=>({...fullPhoto(canvas,face,cvPage?images:[],(cvPage?'الصورة الشخصية':passportPage?'صورة الجواز':'صورة للمراجعة')+' • صفحة '+pageNumber+' • '+(i+1)),kind})));
}
export async function documentPortrait(canvas:HTMLCanvasElement,label:string):Promise<PhotoCandidate[]>{return (await portraits(canvas,label)).map(c=>({...c,kind:'uncertain' as const}));}
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

export async function pdfDocumentImages(page:any,pdfjs:any,canvas:HTMLCanvasElement):Promise<HTMLCanvasElement[]>{
 const images=(await embeddedPhotos(page,pdfjs,canvas)).filter(r=>r.w*r.h<canvas.width*canvas.height*.85&&r.w*r.h>canvas.width*canvas.height*.025).sort((a,b)=>b.w*b.h-a.w*a.h).slice(0,3),result:HTMLCanvasElement[]=[];
 for(const r of images){const im=r.image;if(!im||!im.width||!im.height){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(r.w));c.height=Math.max(1,Math.round(r.h));c.getContext('2d')!.drawImage(canvas,r.x,r.y,r.w,r.h,0,0,c.width,c.height);result.push(c);continue;}if(im.width*im.height>20000000)continue;const out=document.createElement('canvas');out.width=im.width;out.height=im.height;const ctx=out.getContext('2d')!;
 if(im.bitmap)ctx.drawImage(im.bitmap,0,0);else if(im.data&&[3,4].includes(im.data.length/(im.width*im.height))){const data=ctx.createImageData(out.width,out.height),channels=im.data.length/(out.width*out.height);for(let i=0;i<out.width*out.height;i++){for(let c=0;c<3;c++)data.data[i*4+c]=im.data[i*channels+c];data.data[i*4+3]=channels===4?im.data[i*4+3]:255;}ctx.putImageData(data,0,0);}else continue;result.push(out);
 }return result;
}
