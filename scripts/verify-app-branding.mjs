import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

function assert(value,message){if(!value)throw new Error(message);}
const root=new URL("../",import.meta.url);
const read=(path)=>readFileSync(new URL(path,root),"utf8");
const config=JSON.parse(read("apps/mobile/app.json"));
const header=read("apps/mobile/src/components/ui/AppHeader.tsx");
const authHero=read("apps/mobile/src/components/auth/AuthHero.tsx");
const svg=read("apps/mobile/assets/branding/premium-futsal-logo.svg");
const generator=read("scripts/generate-futsal-logo.py");
assert(config.expo.icon==="./assets/icon.png","Launcher icon must use branded PNG.");
assert(config.expo.android.adaptiveIcon.foregroundImage==="./assets/adaptive-icon.png","Android adaptive icon must use branded foreground.");
assert(config.expo.android.adaptiveIcon.backgroundColor==="#0B1D45","Branded adaptive icon background must be navy.");
assert(config.expo.plugins.some((item)=>Array.isArray(item)&&item[0]==="expo-splash-screen"),"Splash screen must be configured.");
assert(header.includes('source={require("../../../assets/icon.png")}'),"AppHeader must display the branded Futsal emblem.");
assert(authHero.includes('source={require("../../../assets/icon.png")}'),"Login/register hero must display the same Futsal emblem.");
assert(!authHero.includes('backgroundColor:"#16A34A"'),"Auth hero must not retain the previous green logo style.");
assert(svg.includes('clipPath id="ballCircle"')&&svg.includes('url(#court)')&&svg.includes('url(#frame)'),"Logo must visibly combine a futsal ball, court, and venue.");
assert(generator.includes('output_width=1024')&&generator.includes('output_height=1024'),"Both icons must render at 1024px.");
for(const path of ["apps/mobile/assets/icon.png","apps/mobile/assets/adaptive-icon.png"]){
 const file=new URL(path,root);
 assert(existsSync(file),`Brand asset missing: ${path}`);
 assert(statSync(file).size>5000,`Brand asset empty: ${path}`);
 const bytes=readFileSync(file);
 assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),`Invalid PNG: ${path}`);
 assert(bytes.readUInt32BE(16)===1024&&bytes.readUInt32BE(20)===1024,`Logo must be 1024x1024: ${path}`);
}
console.log("Premium Futsal branding verified: launcher, Android adaptive, splash, header, drawer, 1024px icons.");
