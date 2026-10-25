import {inspectField} from './source-inspector';
import {basePath} from '@/lib/base';
'use client';
import {getReview,acknowledge} from '@/lib/field-review';
import {useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {UploadCloud,Files,ShieldCheck,ArrowUpLeft,Globe2,X,Plus,Download,CheckCircle2} from 'lucide-react';
import PhotoBox from './photo-box';
import {arabicName} from '@/lib/arabic';
import {countries,normalizeNationality} from '@/lib/countries';
import {CV,fields,val} from '@/lib/fields';
export function Header({active}:{active:string}){return <><header className="header"><a className="brand" href={basePath+"/"}><img src={basePath+"/logo.png"} alt="شركة إيجاز للاستقدام"/><span className="brand-divider"/><span>مركز السير الذاتية<small>إدارة ملفات العمالة</small></span></a><nav><a href={basePath+"/"} className={active==='upload'?'active':''}><UploadCloud size={18}/>رفع واستيراد</a><a href={basePath+"/records"} className={active==='records'?'active':''}><Files size={18}/>السير الذاتية</a></nav><div className="private"><ShieldCheck size={17}/><span>مساحة عمل خاصة</span><button className="text-button" onClick={async()=>{const r=await fetch((basePath+"/api/auth/logout"),{method:'POST'});if(r.ok)location.assign(basePath+'/login');}}>خروج</button></div></header><div className="breadcrumb">إيجاز للاستقدام <span>/</span> مركز السير الذاتية <span>/</span> <strong>{active==='upload'?'رفع واستيراد':'السير الذاتية'}</strong></div></>}
export function Footer(){return <footer><span>شركة إيجاز للاستقدام © {new Date().getFullYear()}</span><span>بيانات منظمة. إدارة أوضح.</span></footer>}
export function Badge({listed}:{listed:boolean}){return <span className={'badge '+(listed?'green':'amber')}>{listed?<CheckCircle2 size={13}/>:<span className="dot"/>}{listed?'مطابقة لقائمة مساند':'أرشيف • غير مدرجة في مساند'}</span>}
export function FieldEditor({data,onChange}:{data:CV,onChange:(d:CV)=>void}){
 function change(key:string,value:string){const next=acknowledge({...data,[key]:value},key);if(key==='name'&&(!data.nameAr||data.nameAr===arabicName(data.name||'')))next.nameAr=arabicName(value);onChange(next);}
 const review=getReview(data);return <div className="field-grid">{fields.map(([key,ar])=><label key={key} className={(['notes','skills','experience'].includes(key)?'wide ':'')+(review[key]&&!review[key].resolved?'field-needs-review':'')}>{ar}<button type="button" className="field-source-link" onClick={e=>{e.preventDefault();inspectField(key);}}>مراجعة الأصل</button>{['name','passport'].includes(key)&&<i> *</i>}{key==='nationality'?<select value={normalizeNationality(data[key]||'')||data[key]||''} onChange={e=>change(key,e.target.value)}><option value="">اختر الجنسية</option>{data[key]&&!normalizeNationality(data[key])&&<option value={data[key]}>{data[key]} — راجع الجنسية</option>}{countries.map(country=><option key={country.value} value={country.value}>{country.label}{country.active?'':' — غير متاحة حاليًا'}</option>)}</select>:['notes','skills','experience'].includes(key)?<textarea value={data[key]||''} onChange={e=>change(key,e.target.value)}/>:<input dir={key==='nameAr'?'rtl':'auto'} value={data[key]||''} onChange={e=>change(key,e.target.value)}/>}{review[key]&&!review[key].resolved&&<span className="field-review-alert" role="status"><b>⚠ يحتاج مراجعة</b><span>{review[key].reason}</span>{review[key].candidates?.map((c,i)=><span key={i} dir="auto">{c.value} — صفحة {c.page} · {c.method}</span>)}<button type="button" className="text-button" onClick={()=>onChange(acknowledge(data,key))}>راجعت الحقل مقابل الأصل{!data[key]?' — غير مذكور / غير مقروء':''}</button></span>}{review[key]?.resolved&&<small className="field-reviewed">✓ تمت المراجعة يدويًا</small>}{key==='nameAr'&&<small className="name-hint">كتابة صوتية قابلة للمراجعة <button type="button" className="text-button" onClick={()=>onChange({...data,nameAr:arabicName(data.name||'')})}>توليد من الاسم الإنجليزي</button></small>}</label>)}</div>}
function CVPhoto({src,name,label}:{src:string,name:string,label:string}) {
    const [open,setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const close = useRef<HTMLButtonElement>(null);
    useEffect(()=>{
        if(!open)return;
        const overflow=document.body.style.overflow;
        document.body.style.overflow='hidden';
        close.current?.focus();
        const keyboard=(event:KeyboardEvent)=>{
            if(event.key==='Escape')setOpen(false);
            if(event.key==='Tab'){event.preventDefault();close.current?.focus();}
        };
        document.addEventListener('keydown',keyboard);
        return ()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keyboard);trigger.current?.focus();};
    },[open]);
    return <>
        <button ref={trigger} type="button" className="cvd-photo-trigger" onClick={()=>setOpen(true)} aria-label={label} title={label}>
            <img src={src} alt={name}/>
        </button>
        {open&&createPortal(<div className="cvd-lightbox" role="dialog" aria-modal="true" aria-label={label} onClick={()=>setOpen(false)}>
            <button ref={close} type="button" className="cvd-lightbox-close" onClick={()=>setOpen(false)} aria-label="إغلاق الصورة"><X size={25}/></button>
            <img src={src} alt={name} onClick={event=>event.stopPropagation()}/>
        </div>,document.body)}
    </>;
}
export function CVForm({data,photo,lang='ar',onPhotoChange,blank=false}:{data:CV,photo?:string,lang?:string,blank?:boolean,onPhotoChange?:(src:string)=>void|Promise<void>}) {
    const ar = lang === 'ar';
    const display = (key:string) => blank?'\u00a0':val(data[key],lang);
    const section = (number:string,title:string,keys:string[],wide=false) => (
        <section className={'cvd-section cvd-section-'+number+(wide?' cvd-section-wide':'')}>
            <div className="cvd-section-title"><span>{number}</span><h4>{title}</h4></div>
            <dl className="cvd-fields">
                {keys.map(key => {
                    const field = fields.find(f=>f[0]===key)!;
                    return <div className={['skills','experience','address'].includes(key)?'cvd-field cvd-field-wide':'cvd-field'} key={key}>
                        <dt>{ar?field[1]:field[2]}</dt>
                        <dd dir="auto" data-blank-field={blank?key:undefined}>{display(key)}</dd>
                    </div>;
                })}
            </dl>
        </section>
    );
    return <div className="cv-paper cv-document" dir={ar?'rtl':'ltr'}>
        <div className="cvd-brandbar">
            <img src={basePath+'/logo.png'} alt="Ejaz Recruitment"/>
            <div><strong>{ar?'شركة إيجاز للاستقدام':'Ejaz Recruitment Company'}</strong><span>{ar?'السيرة الذاتية · طلب توظيف':'CURRICULUM VITAE · EMPLOYMENT APPLICATION'}</span></div>
            <span className="cvd-brand-mark">EJAZ</span>
        </div>
        <header className="cvd-hero">
            <div className="cvd-portrait">
                {onPhotoChange?<PhotoBox compact src={photo} onChange={onPhotoChange}/>:photo?<CVPhoto src={photo} name={data.name||'صورة العاملة'} label={ar?'تكبير الصورة':'Enlarge photo'}/>:<div className="cvd-photo-empty" data-blank-field={blank?"photo":undefined}>{ar?'الصورة الشخصية':'Profile photo'}</div>}
            </div>
            <div className="cvd-identity">
                <span className="cvd-kicker">{blank?(ar?'الاسم الكامل':'FULL NAME'):(ar?'ملف المرشحة':'CANDIDATE PROFILE')}</span>
                <h3 dir="auto" data-blank-field={blank?"name":undefined}>{blank?"\u00a0":ar?(data.nameAr||data.name||'الاسم الكامل'):(data.name||'Full name')}</h3>
                {ar&&((data.nameAr&&data.name)||blank)&&<p className="cvd-latin-name" dir="ltr" data-blank-field={blank?"nameEnglish":undefined}>{blank?"\u00a0":data.name}</p>}
                <p className="cvd-job" data-blank-field={blank?"jobHero":undefined}>{blank?"\u00a0":display('job')}</p>
                <div className="cvd-highlights">
                    <div><span>{ar?'الجنسية':'Nationality'}</span><b dir="auto" data-blank-field={blank?"nationality":undefined}>{display('nationality')}</b></div>
                    <div><span>{ar?'رقم الجواز':'Passport no.'}</span><b dir="ltr" data-blank-field={blank?"passportHero":undefined}>{display('passport')}</b></div>
                </div>
            </div>
        </header>
        <div className="cvd-body">
            {section('01',ar?'البيانات الشخصية':'PERSONAL INFORMATION',['birthDate','age','birthPlace','religion','marital','children','height','weight'])}
            {section('02',ar?'بيانات الجواز':'PASSPORT DETAILS',['passport','issueDate','expiryDate','issuePlace'])}
            {section('03',ar?'العمل والعقد':'EMPLOYMENT & CONTRACT',['job','salary','currency','contract'])}
            {section('04',ar?'التعليم واللغات':'EDUCATION & LANGUAGES',['education','english','arabic'])}
            {section('05',ar?'الخبرات والمهارات':'EXPERIENCE & SKILLS',['experience','experienceCountry','skills'],true)}
            {section('06',ar?'بيانات التواصل':'CONTACT INFORMATION',['phone','address','relative','relativePhone'],true)}
            {(data.notes||blank)&&<section className="cvd-notes"><h4>{ar?'ملاحظات':'REMARKS'}</h4><p dir="auto" data-blank-field={blank?"notes":undefined}>{blank?"\u00a0":data.notes}</p></section>}
        </div>
        <footer className="cvd-footer"><strong>EJAZ RECRUITMENT</strong><span>{blank?(ar?'نموذج سيرة ذاتية فارغ':'Blank curriculum vitae form'):(ar?'نموذج إلكتروني من البيانات المحفوظة':'Generated from saved records')}</span></footer>
    </div>;
}
export function RegistryModal({close,onDone}:{close:()=>void,onDone:()=>void}){const[text,setText]=useState('');const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');const rows=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).filter(s=>!/^passport[,;\t]/i.test(s)).map(s=>{const[p,...n]=s.split(/[,;\t]/);return {passport:p.replace(/^"|"$/g,'').trim(),name:n.join(' ').replace(/^"|"$/g,'').trim()};});
async function save(){setBusy(true);setMessage('');try{const r=await fetch((basePath+"/api/registry"),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows})});const j:any=await r.json();if(!r.ok)throw Error(j.error);setMessage(`تم استيراد ${j.count} جواز. ستتحدث حالة السجلات المطابقة تلقائيًا.`);onDone();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
return <div className="modal-backdrop"><section className="modal"><div className="section-head"><div><span className="eyebrow">مرجع المطابقة</span><h2>قائمة جوازات مساند</h2></div><button className="icon" onClick={close} aria-label="إغلاق"><X/></button></div><p className="muted">استورد أرقام الجوازات الموجودة بالفعل في قاعدة بياناتك أو ملفك المصدّر من مساند. لا يوجد اتصال مباشر بمنصة مساند.</p><div className="notice">إضافة السيرة الذاتية وحدها لا تجعلها مدرجة في مساند؛ المطابقة تتم مع هذه القائمة فقط.</div><label className="file-label"><UploadCloud size={20}/>استيراد CSV أو TXT<input type="file" accept=".csv,.txt" onChange={async e=>{const f=e.target.files?.[0];if(f)setText(await f.text());}}/></label><label className="block-label">أو الصق القائمة: رقم الجواز، الاسم (اختياري)<textarea dir="ltr" rows={8} placeholder={'P1234567,Worker name\nE12345678,Worker name'} value={text} onChange={e=>setText(e.target.value)}/></label><div className="section-head"><small>{rows.length} رقم جاهز للمراجعة</small><button className="primary" disabled={busy||!rows.length} onClick={save}>{busy?'جارٍ الحفظ…':'تأكيد استيراد القائمة'}<Plus size={17}/></button></div>{message&&<p role="status" className="notice">{message}</p>}</section></div>}
