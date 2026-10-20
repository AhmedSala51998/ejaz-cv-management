'use client';
import {useRef,useState} from 'react';
import {ImagePlus,LoaderCircle,UploadCloud} from 'lucide-react';
import {normalizePhoto,PhotoCandidate} from '@/lib/photos';
export default function PhotoBox({src,onChange,disabled=false,candidates=[],compact=false}:{src?:string,onChange:(src:string)=>void|Promise<void>,disabled?:boolean,candidates?:PhotoCandidate[],compact?:boolean}){
 const input=useRef<HTMLInputElement>(null);const[loading,setLoading]=useState(false),[error,setError]=useState(''),[drag,setDrag]=useState(false);
 async function pick(file?:File){if(!file||disabled||loading)return;setLoading(true);setError('');try{await onChange(await normalizePhoto(file));}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 return <div className={'photo-box '+(compact?'compact ':'')+(drag?'drag':'')} onDragOver={e=>{e.preventDefault();if(!disabled)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();e.stopPropagation();setDrag(false);pick(e.dataTransfer.files[0]);}}>
  <div className="photo-frame">{src?<img src={src} alt="صورة العاملة"/>:<div className="photo-placeholder"><ImagePlus size={30}/><span>صورة العاملة</span><small>ارفع صورة أو اسحبها هنا</small></div>}
   {loading&&<div className="photo-loading"><LoaderCircle className="spin"/><span>جارٍ حفظ الصورة…</span></div>}
   <button type="button" className="photo-upload" onClick={()=>input.current?.click()} disabled={disabled||loading}><UploadCloud size={14}/>{src?'استبدال الصورة':'رفع صورة'}</button>
  </div>
  <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{pick(e.target.files?.[0]);e.target.value='';}}/>
  {error&&<p className="photo-error" role="alert">{error}</p>}
  {!compact&&<><small className="photo-help">JPG / PNG / WebP · يمكنك استبدال الصورة المستخرجة أو سحب صورة هنا</small>{candidates.length>0&&<div className="photo-candidates">{candidates.map((candidate,i)=><button type="button" key={i} title={candidate.label} disabled={disabled||loading} className={src===candidate.src?'selected':''} onClick={async()=>{setLoading(true);setError('');try{await onChange(candidate.src);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}}><img src={candidate.src} alt={candidate.label}/><span>{i+1}</span></button>)}</div>}</>}
 </div>;
}
