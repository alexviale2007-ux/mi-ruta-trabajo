import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  const authorization=req.headers.get("authorization")||"";
  if(!authorization.startsWith("Bearer "))return NextResponse.json({error:"Se requiere autorización."},{status:401});
  const {createClient}=await import("@supabase/supabase-js");
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const identity=await db.auth.getUser(authorization.slice(7));
  if(identity.error||!identity.data.user)return NextResponse.json({error:"Sesión inválida."},{status:401});
  const key=process.env.OPENAI_API_KEY;
  if(!key)return NextResponse.json({error:"Falta configurar OPENAI_API_KEY en Vercel."},{status:503});
  const body=await req.json();
  const image=body?.image;
  if(typeof image!=="string"||!/^data:image\/(jpeg|png|webp);base64,/.test(image)||image.length>9_000_000)return NextResponse.json({error:"Imagen no válida o demasiado grande. Usa JPG, PNG o WEBP (máx. ~6 MB)."},{status:400});
  const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini",temperature:0,response_format:{type:"json_object"},messages:[{role:"system",content:'Extrae de una hoja de ruta vending únicamente datos legibles. Devuelve JSON {"stops":[{"name":"empresa","address":"dirección o cadena vacía","machines":[{"code":"código","type":"coffee|snack|cold|water|other"}]}]}. No inventes nombres ni direcciones. Agrupa máquinas por empresa. Si no se lee, deja campo vacío. Máximo 60 empresas.'},{role:"user",content:[{type:"text",text:"Lee esta hoja de ruta y devuelve empresas y máquinas para que el usuario pueda revisar antes de guardar."},{type:"image_url",image_url:{url:image,detail:"high"}}]}]})});
  const json=await response.json();
  if(!response.ok)return NextResponse.json({error:"No se ha podido analizar la foto. Comprueba la clave y los límites del servicio."},{status:502});
  const parsed=JSON.parse(json.choices?.[0]?.message?.content||"{}");
  const stops=Array.isArray(parsed.stops)?parsed.stops.slice(0,60).map((s:unknown)=>{const x=s as Record<string,unknown>;return {name:String(x.name||"").slice(0,160),address:String(x.address||"").slice(0,250),machines:Array.isArray(x.machines)?x.machines.slice(0,30).map((m:unknown)=>{const y=m as Record<string,unknown>;return {code:String(y.code||"").slice(0,80),type:["coffee","snack","cold","water","other"].includes(String(y.type))?String(y.type):"other"};}):[]};}).filter((s:{name:string})=>s.name):[];
  return NextResponse.json({stops});
 }catch{return NextResponse.json({error:"No se ha podido leer la fotografía."},{status:500});}
}
