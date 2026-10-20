'use client';
import {useEffect,useRef} from 'react';
import {Archive} from 'lucide-react';
export default function ConfirmDialog({title,message,onConfirm,onCancel}:{title:string,message:string,onConfirm:()=>void,onCancel:()=>void}){
 const box=useRef<HTMLDivElement>(null),cancel=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const old=document.activeElement as HTMLElement;cancel.current?.focus();const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onCancel();}if(e.key==='Tab'){const buttons=box.current?.querySelectorAll<HTMLButtonElement>('button');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);old?.focus();};},[onCancel]);
 return <div className="modal-backdrop confirm-backdrop"><div className="modal confirm-dialog" ref={box} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><div className="confirm-symbol"><Archive size={32}/></div><h2 id="confirm-title">{title}</h2><p id="confirm-description">{message}</p><div className="confirm-buttons"><button className="primary" onClick={onConfirm}>نعم، أكمل</button><button className="secondary" ref={cancel} onClick={onCancel}>لا، إلغاء</button></div></div></div>;
}
