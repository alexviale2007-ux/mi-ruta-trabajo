"use client";
import {useEffect,useMemo,useState} from "react";
import {Camera,Coffee,MapPin,Navigation,CheckCircle2,Sparkles,Clock3,BarChart3} from "lucide-react";
import {supabase} from "../lib/supabase";
type Machine={id:string;type:string;clean:boolean};
type Stop={id:string;client:string;address:string;machines:Machine[];minutes:number;done?:boolean};
const initial:Stop[]=[
{id:"1",client:"Cliente Vallès",address:"Barberà del Vallès",minutes:24,machines:[{id:"CAF-1042",type:"Café",clean:true},{id:"SNK-2018",type:"Snack",clean:false}]},
{id:"2",client:"Centre Logístic",address:"Ripollet",minutes:31,machines:[{id:"CAF-1091",type:"Café",clean:false},{id:"AG-441",type:"Agua",clean:false},{id:"SNK-2190",type:"Snack",clean:false}]}
];
export default function Home(){
 const [stops,setStops]=useState<Stop[]>(initial),[tab,setTab]=useState("hoy"),[cloud,setCloud]=useState("Conectando…");
 useEffect(()=>{(async()=>{try{
   let {data:{session}}=await supabase.auth.getSession();
   if(!session){const r=await supabase.auth.signInAnonymously();if(r.error)throw r.error;}
   setCloud("Sesión conectada · datos de demostración");
 }catch{setCloud("Modo demostración · sin sesión");}})()},[]);
 const machines=useMemo(()=>stops.reduce((n,s)=>n+s.machines.length,0),[stops]);
 const cleans=useMemo(()=>stops.flatMap(s=>s.machines).filter(m=>m.clean).length,[stops]);
 const done=stops.filter(s=>s.done).length;
 const toggle=(id:string)=>setStops(x=>x.map(s=>s.id===id?{...s,done:!s.done}:s));
 const waze=(a:string)=>"https://www.waze.com/ul?q="+encodeURIComponent(a)+"&navigate=yes";
 return <main>
 <header><div className="eyebrow"><Sparkles size={15}/> RUTA DE HOY · DEMO</div><h1>Buenos días</h1><p className="sub">Tu jornada, organizada para terminar antes.</p>
 <div className="finish"><span><Clock3 size={18}/> Fin estimado (demo)</span><strong>14:18</strong><em>Ejemplo</em></div>
 <div className="stats"><div><b>{stops.length}</b><span>Paradas</span></div><div><b>{machines}</b><span>Máquinas</span></div><div><b>{cleans}</b><span>Limpiar</span></div></div></header>
 <section className="content"><div className="status"><span className="dot"/>{cloud}</div>
 <nav>{[["hoy","Hoy"],["limpieza","Limpieza"],["progreso","Progreso"]].map(([k,l])=><button className={tab===k?"active":""} onClick={()=>setTab(k)} key={k}>{l}</button>)}</nav>
 {tab==="hoy"&&<><label className="scan"><Camera/><div><strong>Seleccionar foto de ruta</strong><small>La lectura automática aún está pendiente</small></div><input type="file" accept="image/*" capture="environment"/></label>
 <div className="sectionTitle"><div><span>RECORRIDO DE EJEMPLO</span><h2>Tu ruta</h2></div><b>{done}/{stops.length}</b></div>
 {stops.map((s,i)=><article className={"stop "+(s.done?"completed":"")} key={s.id}>
 <div className="stopTop"><span className="number">{i+1}</span><div className="grow"><h3>{s.client}</h3><p><MapPin size={14}/>{s.address}</p></div><span className="time">{s.minutes} min</span></div>
 <div className="machines">{s.machines.map(m=><span key={m.id} className={m.clean?"due":""}>{m.type} · {m.id}{m.clean?" · limpiar":""}</span>)}</div>
 <div className="actions"><a href={waze(s.address)} target="_blank" rel="noreferrer"><Navigation size={17}/> Abrir Waze</a><button onClick={()=>toggle(s.id)}><CheckCircle2 size={17}/>{s.done?"Hecha":"Terminar"}</button></div></article>)}</>}
 {tab==="limpieza"&&<div className="panel"><Coffee size={28}/><h2>Limpiezas</h2><p>Ejemplo de control de cafeteras. Pendiente de guardar fechas reales.</p>{stops.flatMap(s=>s.machines.map(m=>({...m,client:s.client}))).filter(m=>m.type==="Café").map(m=><div className="cleanRow" key={m.id}><div><b>{m.id}</b><small>{m.client}</small></div><span>{m.clean?"Toca limpiar":"Al día"}</span></div>)}</div>}
 {tab==="progreso"&&<div className="panel"><BarChart3 size={28}/><h2>Mi rendimiento</h2><div className="progress"><div><b>Demo</b><span>ahorro estimado</span></div><div><b>14:18</b><span>fin de ejemplo</span></div><div><b>{done}</b><span>paradas marcadas</span></div></div><p>Las estadísticas reales se activarán al guardar rutas y tiempos en la base de datos.</p></div>}
 </section></main>
}