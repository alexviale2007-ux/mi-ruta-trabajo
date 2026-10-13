"use client";
import {useEffect,useState} from "react";
import {Camera,MapPin,Navigation,CheckCircle2,Clock3,Coffee,Plus,BarChart3} from "lucide-react";
import {supabase} from "../lib/supabase";
import {cleaningDue,wazeUrl} from "../lib/route-utils";
type Client={id:string;name:string;address:string|null};
type Machine={id:string;client_id:string;label:string;external_code:string|null;machine_type:string;last_cleaned_at:string|null;cleaning_interval_days:number};
type Stop={id:string;client_id:string;stop_order:number;status:string;started_at:string|null;finished_at:string|null;estimated_minutes:number|null};
type Route={id:string;route_date:string};
export default function Home(){
 const [userId,setUserId]=useState(""); const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 const [clients,setClients]=useState<Client[]>([]),[machines,setMachines]=useState<Machine[]>([]),[stops,setStops]=useState<Stop[]>([]),[route,setRoute]=useState<Route|null>(null);
 const [tab,setTab]=useState("hoy"),[name,setName]=useState(""),[address,setAddress]=useState(""),[code,setCode]=useState(""),[kind,setKind]=useState("coffee"),[selected,setSelected]=useState("");
 const [scanned,setScanned]=useState<{name:string;address:string;machines:{code:string;type:string}[]}[]>([]); const [scanning,setScanning]=useState(false);
 const today=new Date().toLocaleDateString("sv-SE");
 async function load(uid:string){
  const [c,m,r]=await Promise.all([supabase.from("clients").select("*").eq("user_id",uid).order("name"),supabase.from("machines").select("*").eq("user_id",uid),supabase.from("routes").select("*").eq("user_id",uid).eq("route_date",today).order("created_at",{ascending:false}).limit(1)]);
  if(c.error||m.error||r.error)throw new Error(c.error?.message||m.error?.message||r.error?.message);
  setClients(c.data||[]);setMachines(m.data||[]);
  const rt=r.data?.[0]||null;setRoute(rt);
  if(rt){const s=await supabase.from("route_stops").select("*").eq("route_id",rt.id).order("stop_order");if(s.error)throw s.error;setStops(s.data||[]);}else setStops([]);
 }
 useEffect(()=>{(async()=>{try{const session=await supabase.auth.getSession();let uid=session.data.session?.user.id;
 if(!uid){const login=await supabase.auth.signInAnonymously();if(login.error)throw login.error;uid=login.data.user?.id;}
 if(!uid)throw new Error("No se ha podido iniciar sesión");setUserId(uid);await load(uid);
 }catch(e){setError("No se pudo conectar: "+String(e instanceof Error?e.message:e)+". Comprueba que Anonymous Sign-ins esté activado en Supabase Auth.");}})()},[]);
 async function action(fn:()=>Promise<void>){setBusy(true);setError("");try{await fn();await load(userId);}catch(e){setError(String(e instanceof Error?e.message:e));}finally{setBusy(false);}}
 async function scan(file:File|undefined){if(!file)return;setScanning(true);setError("");try{
  if(file.size>6_000_000)throw new Error("La foto supera los 6 MB. Haz otra con menor resolución.");
  const image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("No se pudo abrir la foto"));reader.readAsDataURL(file);});
  const res=await fetch("/api/scan-route",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image})});
  const json=await res.json();if(!res.ok)throw new Error(json.error||"Error al analizar foto");
  setScanned(json.stops||[]);if(!json.stops?.length)setError("No se han identificado empresas. Prueba con una foto más nítida.");
 }catch(e){setError(String(e instanceof Error?e.message:e));}finally{setScanning(false);}}
 async function importScanned(){await action(async()=>{
  let routeId=route?.id;
  if(!routeId){const r=await supabase.from("routes").insert({user_id:userId,route_date:today}).select("id").single();if(r.error)throw r.error;routeId=r.data.id;}
  let order=stops.length;
  for(const item of scanned){if(!item.name.trim())continue;
   let client=clients.find(c=>c.name.toLocaleLowerCase().trim()===item.name.toLocaleLowerCase().trim());
   let clientId=client?.id;
   if(!clientId){const r=await supabase.from("clients").insert({user_id:userId,name:item.name.trim(),address:item.address||null}).select("id").single();if(r.error)throw r.error;clientId=r.data.id;}
   if(!stops.some(s=>s.client_id===clientId)){
    const r=await supabase.from("route_stops").insert({user_id:userId,route_id:routeId,client_id:clientId,stop_order:++order,estimated_minutes:Math.max(10,item.machines.length*8),status:"pending"});if(r.error)throw r.error;
   }
   for(const machine of item.machines){if(!machine.code.trim()||machines.some(m=>m.client_id===clientId&&m.external_code===machine.code))continue;
    const r=await supabase.from("machines").insert({user_id:userId,client_id:clientId,label:machine.type==="coffee"?"Cafetera":machine.type==="snack"?"Snack":"Máquina",external_code:machine.code,machine_type:machine.type});if(r.error)throw r.error;
   }
  }
  setScanned([]);
 });}
 async function addClient(){if(!name.trim())return;await action(async()=>{const r=await supabase.from("clients").insert({user_id:userId,name:name.trim(),address:address.trim()||null});if(r.error)throw r.error;setName("");setAddress("");});}
 async function addMachine(){if(!selected)return;await action(async()=>{const r=await supabase.from("machines").insert({user_id:userId,client_id:selected,label:kind==="coffee"?"Cafetera":kind==="snack"?"Snack":kind==="water"?"Agua":"Máquina",external_code:code.trim()||null,machine_type:kind});if(r.error)throw r.error;setCode("");});}
 async function addStop(clientId:string){await action(async()=>{let id=route?.id;if(!id){const r=await supabase.from("routes").insert({user_id:userId,route_date:today}).select("id").single();if(r.error)throw r.error;id=r.data.id;}
 const s=await supabase.from("route_stops").insert({user_id:userId,route_id:id,client_id:clientId,stop_order:stops.length+1,estimated_minutes:Math.max(10,machines.filter(m=>m.client_id===clientId).length*8),status:"pending"});if(s.error)throw s.error;});}
 async function changeStop(s:Stop){await action(async()=>{const update=s.status==="done"?{status:"pending",started_at:null,finished_at:null}:s.status==="active"?{status:"done",finished_at:new Date().toISOString()}:{status:"active",started_at:new Date().toISOString()};const r=await supabase.from("route_stops").update(update).eq("id",s.id).eq("user_id",userId);if(r.error)throw r.error;});}
 async function clean(m:Machine){await action(async()=>{const at=new Date().toISOString();const a=await supabase.from("cleanings").insert({user_id:userId,machine_id:m.id,cleaned_at:at,route_stop_id:stops.find(s=>s.client_id===m.client_id)?.id||null});if(a.error)throw a.error;const b=await supabase.from("machines").update({last_cleaned_at:at}).eq("id",m.id).eq("user_id",userId);if(b.error)throw b.error;});}
 const due=machines.filter(m=>m.machine_type==="coffee"&&cleaningDue(m.last_cleaned_at,m.cleaning_interval_days));
 const mins=stops.filter(s=>s.started_at&&s.finished_at).reduce((sum,s)=>sum+Math.round((new Date(s.finished_at!).getTime()-new Date(s.started_at!).getTime())/60000),0);
 return <main><header><div className="eyebrow">MI RUTA DE TRABAJO</div><h1>Tu jornada</h1><p className="sub">Empresas y máquinas reales, guardadas en tu cuenta.</p><div className="stats"><div><b>{stops.length}</b><span>Paradas hoy</span></div><div><b>{machines.length}</b><span>Máquinas</span></div><div><b>{due.length}</b><span>Limpiar</span></div></div></header>
 <section className="content">{error&&<div className="panel" role="alert" style={{color:"#b91c1c"}}>{error}</div>}
 <div className="status"><span className="dot"/>{userId?"Conectado a Supabase":"Conectando..."}</div>
 <nav>{[["hoy","Hoy"],["clientes","Empresas"],["limpieza","Limpieza"],["progreso","Progreso"]].map(([k,l])=><button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}>{l}</button>)}</nav>
 {tab==="hoy"&&<><label className="scan"><Camera/><div><strong>Foto de la hoja de ruta</strong><small>{scanning?"Analizando fotografía…":"Reconocer empresas y máquinas. Revisa antes de guardar."}</small></div><input type="file" accept="image/*" capture="environment" onChange={e=>scan(e.target.files?.[0])}/></label>
 {scanned.length>0&&<div className="panel"><h2>Revisa la foto ({scanned.length} empresas)</h2><p>Corrige nombres y direcciones antes de importar. Los datos de la foto pueden contener errores.</p>{scanned.map((s,i)=><div key={i}><input aria-label="Empresa" value={s.name} onChange={e=>setScanned(x=>x.map((v,j)=>i===j?{...v,name:e.target.value}:v))}/><input aria-label="Dirección" placeholder="Dirección (si se conoce)" value={s.address} onChange={e=>setScanned(x=>x.map((v,j)=>i===j?{...v,address:e.target.value}:v))}/><small>{s.machines.length} máquinas reconocidas: {s.machines.map(m=>m.code).join(", ")||"sin códigos"}</small><button onClick={()=>setScanned(x=>x.filter((_,j)=>j!==i))}>Quitar</button></div>)}<button disabled={busy||!userId} onClick={importScanned}>Guardar empresas y ruta</button></div>}
 <div className="sectionTitle"><div><span>RUTA REAL · {today}</span><h2>Mis paradas</h2></div><b>{stops.filter(s=>s.status==="done").length}/{stops.length}</b></div>
 {stops.length===0&&<div className="panel">Todavía no tienes paradas hoy. Añade una empresa desde la pestaña Empresas.</div>}
 {stops.map((s,i)=>{const c=clients.find(c=>c.id===s.client_id);const ms=machines.filter(m=>m.client_id===s.client_id);return <article className={"stop "+(s.status==="done"?"completed":"")} key={s.id}><div className="stopTop"><span className="number">{i+1}</span><div className="grow"><h3>{c?.name||"Empresa"}</h3><p><MapPin size={14}/>{c?.address||"Sin dirección"}</p></div><span className="time">{s.estimated_minutes||0} min</span></div><div className="machines">{ms.map(m=><span key={m.id} className={cleaningDue(m.last_cleaned_at,m.cleaning_interval_days)&&m.machine_type==="coffee"?"due":""}>{m.label} · {m.external_code||"sin código"}</span>)}</div><div className="actions">{c?.address&&<a href={wazeUrl(c.address)} target="_blank" rel="noreferrer"><Navigation size={17}/> Waze</a>}<button disabled={busy} onClick={()=>changeStop(s)}><CheckCircle2 size={17}/>{s.status==="done"?"Reabrir":s.status==="active"?"Terminar":"Iniciar"}</button></div></article>})}</>}
 {tab==="clientes"&&<><div className="panel"><h2><Plus size={20}/> Nueva empresa</h2><input placeholder="Nombre real de la empresa" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="Dirección para Waze" value={address} onChange={e=>setAddress(e.target.value)}/><button disabled={busy||!userId||!name.trim()} onClick={addClient}>Guardar empresa</button></div><div className="panel"><h2>Registrar máquina</h2><select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecciona empresa</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select value={kind} onChange={e=>setKind(e.target.value)}><option value="coffee">Café</option><option value="snack">Snack</option><option value="cold">Frío</option><option value="water">Agua</option><option value="other">Otra</option></select><input placeholder="Código de máquina" value={code} onChange={e=>setCode(e.target.value)}/><button disabled={busy||!selected} onClick={addMachine}>Guardar máquina</button></div>{clients.map(c=><article className="stop" key={c.id}><h3>{c.name}</h3><p>{c.address||"Dirección pendiente"}</p><p>{machines.filter(m=>m.client_id===c.id).length} máquinas</p><div className="actions"><button disabled={busy||stops.some(s=>s.client_id===c.id)} onClick={()=>addStop(c.id)}><Plus size={16}/> {stops.some(s=>s.client_id===c.id)?"Ya añadida":"Añadir a hoy"}</button></div></article>)}</>}
 {tab==="limpieza"&&<div className="panel"><Coffee size={28}/><h2>Control de cafeteras</h2><p>Las máquinas sin limpieza registrada aparecen pendientes. Intervalo predeterminado: 14 días.</p>{machines.filter(m=>m.machine_type==="coffee").map(m=><div className="cleanRow" key={m.id}><div><b>{m.external_code||m.label}</b><small>{clients.find(c=>c.id===m.client_id)?.name} · {m.last_cleaned_at?new Date(m.last_cleaned_at).toLocaleDateString("es-ES"):"Nunca limpiada"}</small></div><button disabled={busy} onClick={()=>clean(m)}>{cleaningDue(m.last_cleaned_at,m.cleaning_interval_days)?"Marcar limpia":"Registrar limpieza"}</button></div>)}{!machines.some(m=>m.machine_type==="coffee")&&<p>Aún no hay cafeteras registradas.</p>}</div>}
 {tab==="progreso"&&<div className="panel"><BarChart3 size={28}/><h2>Rendimiento de hoy</h2><div className="progress"><div><b>{stops.filter(s=>s.status==="done").length}</b><span>paradas terminadas</span></div><div><b>{mins}</b><span>minutos registrados</span></div><div><b>{due.length}</b><span>limpiezas pendientes</span></div></div><p>Los tiempos se calculan con los botones Iniciar y Terminar y se guardan en Supabase.</p></div>}
 </section></main>;
}
