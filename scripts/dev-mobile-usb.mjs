import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

function fail(message){
  console.error("\n[dev:mobile] "+message+"\n");
  process.exit(1);
}

function run(command,args){
  const result=spawnSync(command,args,{encoding:"utf8",shell:process.platform==="win32"});
  return {
    ok:result.status===0,
    stdout:(result.stdout??"").trim(),
    stderr:(result.stderr??"").trim(),
  };
}

const adbVersion=run("adb",["version"]);
if(!adbVersion.ok){
  fail([
    "ADB was not found.",
    "Install Android Platform Tools, add adb to PATH, then reconnect your Android phone.",
    "Enable Developer options > USB debugging on the phone and accept the authorization prompt.",
  ].join("\n"));
}

const devices=run("adb",["devices"]);
if(!devices.ok) fail("Could not query Android devices with adb.");

const connected=devices.stdout
  .split(/\r?\n/)
  .slice(1)
  .map((line)=>line.trim())
  .filter(Boolean)
  .filter((line)=>/\tdevice$/.test(line));

const unauthorized=devices.stdout
  .split(/\r?\n/)
  .filter((line)=>/\tunauthorized$/.test(line));

if(unauthorized.length){
  fail("Your Android phone is connected but not authorized. Unlock it, accept the USB debugging prompt, then run pnpm dev:mobile again.");
}
if(!connected.length){
  fail([
    "No authorized Android phone was found.",
    "Connect the phone by USB, enable USB debugging, and accept the authorization prompt.",
    "Then confirm with: adb devices",
  ].join("\n"));
}

for(const port of [8081,4000]){
  const reversed=run("adb",["reverse",`tcp:${port}`,`tcp:${port}`]);
  if(!reversed.ok){
    fail(`Could not reverse Android port ${port}. ${reversed.stderr||reversed.stdout}`);
  }
}

console.log("[dev:mobile] Android USB device detected.");
console.log("[dev:mobile] Metro: phone 127.0.0.1:8081 -> laptop 127.0.0.1:8081");
console.log("[dev:mobile] API:   phone 127.0.0.1:4000 -> laptop 127.0.0.1:4000");
console.log("[dev:mobile] Starting Expo Go with localhost + clean cache...\n");

const child=spawn(
  process.platform==="win32"?"pnpm.cmd":"pnpm",
  ["--filter","@leaguekick/mobile","exec","expo","start","--localhost","--clear","--go"],
  {
    stdio:"inherit",
    env:{
      ...process.env,
      EXPO_PUBLIC_API_URL:"http://127.0.0.1:4000",
    },
    shell:false,
  },
);

child.on("error",(error)=>fail(`Could not start Expo: ${error.message}`));
child.on("exit",(code,signal)=>{
  if(signal){
    process.kill(process.pid,signal);
    return;
  }
  process.exit(code??0);
});
