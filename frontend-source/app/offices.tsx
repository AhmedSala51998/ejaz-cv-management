import {useEffect,useState} from 'react';
import {Building2,ArrowUpLeft} from 'lucide-react';
import {Header,Footer} from './hostinger-components';
import {OfficesManager} from './ticket-offices';
import {basePath} from '@/lib/base';
export default function OfficesPage(){
 const [permissions,setPermissions]=useState<string[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;fetch(basePath+'/api/workspace/me').then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'تعذر تحميل الصلاحيات.');if(active)setPermissions(j.permissions||[]);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 useEffect(()=>{document.title='مكاتب الاستقدام | إيجاز';},[]);
 return <><Header active="offices"/><main className="tickets-page offices-page"><section className="tickets-heading"><div><span className="eyebrow">EJAZ · RECRUITMENT OFFICES</span><h1>مكاتب الاستقدام</h1><p>إدارة المكاتب وبلدانها، إضافة مكتب أو مجموعة مكاتب، وتنظيم السير الذاتية التابعة لها.</p></div><Building2 size={48}/></section><div className="offices-page-links"><a className="secondary" href={basePath+'/records'}>تعيين المكتب لعدة سير ذاتية <ArrowUpLeft size={16}/></a><a className="secondary" href={basePath+'/tickets'}>تذاكر السفر <ArrowUpLeft size={16}/></a></div>{error?<p className="notice ticket-error" role="alert">{error}</p>:permissions===null?<p className="notice" role="status">جارٍ تحميل المكاتب…</p>:<OfficesManager embedded permissions={permissions} onClose={()=>{}} onUpdated={()=>{}}/>}</main><Footer/></>;
}
