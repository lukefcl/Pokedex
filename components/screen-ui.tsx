'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Camera } from 'lucide-react';

export const today = () => new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
export const formatDate = (date:string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'});

/** Modal views stay inside the handheld screen, including their focus and scrolling. */
export function Dialog({title,children,close}:{title:string;children:ReactNode;close:()=>void}) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(close);closeRef.current=close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement|null;
    const element=ref.current;
    element?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey=(event:KeyboardEvent) => {
      if(event.key==='Escape'){event.preventDefault();closeRef.current();}
      if(event.key==='Tab' && element){
        const controls=Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled)')).filter(el=>el.getClientRects().length>0);
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    element?.addEventListener('keydown',onKey);
    return()=>{element?.removeEventListener('keydown',onKey);previous?.focus();};
  },[]);
  return <section ref={ref} className="screen-overlay" role="dialog" aria-modal="true" aria-label={title}><div className="dialog-header"><button className="icon-button" aria-label="Close dialog" onClick={close}><ArrowLeft size={19}/></button><span className="eyebrow">{title}</span><span className="overlay-code">FX–01</span></div><div className="overlay-scroll">{children}</div></section>;
}
export function CatchPhoto({photo,alt,className=''}:{photo:Blob;alt:string;className?:string}){
  const [url,setUrl]=useState('');
  useEffect(()=>{const objectURL=URL.createObjectURL(photo);setUrl(objectURL);return()=>URL.revokeObjectURL(objectURL);},[photo]);
  // Local blob URLs never go through a server or image service.
  // eslint-disable-next-line @next/next/no-img-element
  return url?<img src={url} alt={alt} className={className}/>:<div className={`photo-placeholder ${className}`}><Camera/></div>;
}
