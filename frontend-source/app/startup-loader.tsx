'use client';
import {useEffect,useState} from 'react';
export default function StartupLoader(){
 const[loading,setLoading]=useState(true);
 useEffect(()=>{const done=()=>setLoading(false);if(document.readyState==='complete')done();else window.addEventListener('load',done,{once:true});return()=>window.removeEventListener('load',done);},[]);
 if(!loading)return null;
 return <div className="startup-loader" role="status" aria-live="polite"><div className="loader-brand">إيجاز<span>مركز السير الذاتية</span></div><div className="loader-orbit"/><strong>بنجهّز مساحة عملك</strong><p>جارٍ تحميل الموقع والأدوات…</p><div className="loader-track"><i/></div><noscript>يرجى تفعيل JavaScript لاستخدام الموقع.</noscript></div>;
}
