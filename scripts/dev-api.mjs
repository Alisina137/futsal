import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const apiPort="4000";
let shuttingDown=false;
const children=[];

function commandAvailable(name){
  const lookup=spawnSync(
    process.platform==="win32"?"where":"which",
    [name],
    {encoding:"utf8",shell:false},
  );
  return lookup.status===0;
}

function start(label,command,args,env=process.env){
  let child;
  try{
    child=spawn(command,args,{
      cwd:process.cwd(),
      stdio:"inherit",
      shell:process.platform==="win32",
      env,
    });
  }catch(error){
    console.error(`[dev:api] Failed to start ${label}: ${error instanceof Error?error.message:String(error)}`);
    void shutdown(1);
    return null;
  }
  children.push({label,child});

  child.on("error",(error)=>{
    console.error(`[dev:api] Failed to start ${label}: ${error.message}`);
    void shutdown(1);
  });

  child.on("exit",(code,signal)=>{
    if(shuttingDown)return;
    if(code===0||signal){
      console.log(`[dev:api] ${label} stopped.`);
    }else{
      console.error(`[dev:api] ${label} exited with code ${code}.`);
    }
    void shutdown(code??1);
  });

  return child;
}

async function stopChild(child){
  if(child.exitCode!==null||child.signalCode!==null)return;

  if(process.platform==="win32"&&child.pid){
    spawnSync("taskkill",["/PID",String(child.pid),"/T","/F"],{
      stdio:"ignore",
      shell:false,
    });
    return;
  }

  child.kill("SIGTERM");
}

async function shutdown(code=0){
  if(shuttingDown)return;
  shuttingDown=true;
  await Promise.all(children.map(({child})=>stopChild(child)));
  process.exit(code);
}

async function printNgrokUrl(){
  for(let attempt=0;attempt<40&&!shuttingDown;attempt+=1){
    try{
      const response=await fetch("http://127.0.0.1:4040/api/tunnels");
      if(response.ok){
        const payload=await response.json();
        const tunnel=Array.isArray(payload?.tunnels)
          ?payload.tunnels.find((item)=>item?.proto==="https")??payload.tunnels[0]
          :null;
        if(tunnel?.public_url){
          console.log(`\n[dev:api] ngrok public API URL: ${tunnel.public_url}`);
          console.log("[dev:api] Use this URL as EXPO_PUBLIC_API_URL for the mobile app.\n");
          return;
        }
      }
    }catch{}
    await new Promise((resolve)=>setTimeout(resolve,500));
  }
}

if(!commandAvailable("pnpm")){
  console.error("[dev:api] pnpm was not found in PATH.");
  process.exit(1);
}

if(!commandAvailable("ngrok")){
  console.error("[dev:api] ngrok was not found in PATH.");
  console.error("[dev:api] Confirm that 'ngrok http 4000' works directly in PowerShell.");
  process.exit(1);
}

console.log("[dev:api] Starting API and ngrok in this terminal.");
console.log(`[dev:api] API:   http://localhost:${apiPort}`);
console.log(`[dev:api] ngrok: http ${apiPort}`);
console.log("[dev:api] Press Ctrl+C once to stop both.\n");

start(
  "API",
  "pnpm",
  ["--filter","@leaguekick/api","dev"],
  {
    ...process.env,
    // ngrok is the one trusted reverse proxy in local development.
    TRUST_PROXY_HOPS:process.env.TRUST_PROXY_HOPS?.trim()||"1",
  },
);

start("ngrok","ngrok",["http",apiPort]);
void printNgrokUrl();

process.on("SIGINT",()=>void shutdown(0));
process.on("SIGTERM",()=>void shutdown(0));
