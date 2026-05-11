import React from "react";
export const M={pri:"#9B1B30",priLight:"rgba(155,27,48,0.08)",bg:"#f5f5f7",card:"#fff",tx:"#1a1a1a",txM:"#6b6560",brdN:"#e5e0db",sent:"#9B1B30",recv:"#f0eeec"};
export const ROLES={admin:"Administrador",pos_vendas:"Pós-Vendas",vendedor:"Vendedor",operacional:"Operacional"};
export const API="/api/chat";
export const tok=()=>localStorage.getItem("token");
export const me=()=>{try{return JSON.parse(localStorage.getItem("user")||"{}")}catch{return{}}};
export const hdrs=(json=true)=>{const h={Authorization:`Bearer ${tok()}`};if(json)h["Content-Type"]="application/json";return h;};
export const fmtTime=d=>{if(!d)return"";const dt=new Date(d),now=new Date();if(dt.toDateString()===now.toDateString())return dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});const y=new Date(now);y.setDate(y.getDate()-1);if(dt.toDateString()===y.toDateString())return"Ontem";return dt.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});};
export const fmtHora=d=>d?new Date(d).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"";
export function Avatar({name,size=38}){const ini=(name||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();const hue=Array.from(name||"").reduce((a,c)=>a+c.charCodeAt(0),0)%360;return <div style={{width:size,height:size,borderRadius:"50%",background:`hsl(${hue},55%,45%)`,color:"#fff",fontWeight:800,fontSize:size*0.36,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,userSelect:"none"}}>{ini}</div>;}
export function Badge({count}){if(!count)return null;return <span style={{background:"#dc2626",color:"#fff",fontSize:10,fontWeight:800,borderRadius:10,padding:"2px 6px",minWidth:18,textAlign:"center",lineHeight:"14px",display:"inline-block"}}>{count>99?"99+":count}</span>;}
export function FilePreview({url,nome,tipo}){if(!url)return null;const isImg=tipo?.startsWith("image/");return isImg?<a href={url} target="_blank" rel="noreferrer" style={{display:"block",marginTop:6}}><img src={url} alt={nome} style={{maxWidth:220,maxHeight:180,borderRadius:8,cursor:"pointer",display:"block"}}/></a>:<a href={url} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:"rgba(0,0,0,0.08)",borderRadius:8,textDecoration:"none",color:"inherit",marginTop:6,fontSize:12,fontWeight:600}}>📎 {nome||"Arquivo"}</a>;}
