import React from 'react';
import {createRoot} from 'react-dom/client';
import UploadPage from './app/page';
import RecordsPage from './app/records/page';
import Login from './app/login/page';
import {basePath} from './lib/base';
import './app/globals.css';
import './app/enhancements.css';
import './app/hostinger.css';
import './app/login-design.css';
import './app/record-view.css';
import './app/cv-document.css';
import './app/workspace.css';
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(new URL(url,location.href).origin===location.origin&&new URL(url,location.href).pathname.startsWith(basePath+'/api/')){
  const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
  if(!['GET','HEAD','OPTIONS'].includes(method))headers.set('X-CSRF-Token',document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content||'');
  const response=await nativeFetch(input,{...init,headers});
  if(response.status===401&&!url.includes('/api/auth/login'))location.assign(basePath+'/login');
  return response;
 }
 return nativeFetch(input,init);
};
function App(){React.useEffect(()=>{let active=true;const ready=async()=>{await document.fonts.ready;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(active)document.querySelector('#boot-screen')?.remove();}));};if(document.readyState==='complete')void ready();else window.addEventListener('load',ready,{once:true});return()=>{active=false;window.removeEventListener('load',ready);};},[]);const route=(window as any).__EJAZ_VIEW__;const path=route==='login'?'/login':route==='records'?'/records':location.pathname.slice(basePath.length).replace(/\/$/,'');return path==='/login'||path==='/login.php'?<Login/>:path==='/records'?<RecordsPage/>:<UploadPage/>;}
createRoot(document.getElementById('root')!).render(<App/>);
