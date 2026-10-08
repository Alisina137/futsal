import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

function assert(value,message){if(!value)throw new Error(message);}
const root=new URL("../",import.meta.url);
const read=(path)=>readFileSync(new URL(path,root),"utf8");
const config=JSON.parse(read("apps/mobile/app.json"));
const header=read("apps/mobile/src/components/ui/AppHeader.tsx");
const authHero=read("apps/mobile/src/components/auth/AuthHero.tsx");
const generator=read("scripts/generate-futsal-logo.py");
const source=new URL("apps/mobile/assets/branding/futsal-player-logo.webp",root);
assert(existsSync(source),"Approved FUTSAL player-and-wordmark artwork must be checked into the repository.");
const approved=readFileSync(source);
assert(approved.byteLength>=5000,"Source illustration unexpectedly empty.");
assert(approved.toString("ascii",0,4)==="RIFF"&&approved.toString("ascii",8,12)==="WEBP",
  "Approved FUTSAL logo source must be a valid WebP.");
assert(config.expo.icon==="./assets/icon.png","Launcher icon must use branded PNG.");
assert(config.expo.android.adaptiveIcon.foregroundImage==="./assets/adaptive-icon.png","Android adaptive icon must use branded foreground.");
assert(config.expo.android.adaptiveIcon.backgroundColor==="#FFFFFF","Adaptive icon background must match the approved white FUTSAL artwork.");
assert(config.expo.plugins.some((item)=>Array.isArray(item)&&item[0]==="expo-splash-screen"),"Splash screen must be configured.");
assert(header.includes('source={require("../../../assets/icon.png")}'),"AppHeader must display the branded Futsal emblem.");
assert(authHero.includes('source={require("../../../assets/icon.png")}'),"Login/register hero must display the same Futsal emblem.");
assert(!authHero.includes('backgroundColor:"#16A34A"'),"Auth hero must not retain the previous green logo style.");
assert(generator.includes("futsal-player-logo.webp")&&generator.includes("ImageOps.fit"),
  "Launcher and adaptive icon must derive from approved FUTSAL art.");
assert(generator.includes("foreground.putalpha(whole_alpha)")&&generator.includes('(740,740)'),
  "Android adaptive icon must use a transparent foreground inside safe-area bounds.");
for(const path of ["apps/mobile/assets/icon.png","apps/mobile/assets/adaptive-icon.png"]){
 const file=new URL(path,root);
 assert(existsSync(file),`Brand asset missing: ${path}`);
 assert(statSync(file).size>2500,`Brand asset empty: ${path}`);
 const bytes=readFileSync(file);
 assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),`Invalid PNG: ${path}`);
 assert(bytes.readUInt32BE(16)===1024&&bytes.readUInt32BE(20)===1024,`Logo must be 1024x1024: ${path}`);
}
console.log("Approved FUTSAL player brand verified: source image, launcher, adaptive icon, splash, header, drawer, and auth.");
