import { existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

function assert(value,message){if(!value)throw new Error(message);}
const root=new URL("../",import.meta.url);
const read=(path)=>readFileSync(new URL(path,root),"utf8");
const config=JSON.parse(read("apps/mobile/app.json"));
const header=read("apps/mobile/src/components/ui/AppHeader.tsx");
const authHero=read("apps/mobile/src/components/auth/AuthHero.tsx");
const generator=read("scripts/generate-futsal-logo.py");
const source=new URL("apps/mobile/assets/branding/futsal-player-logo.webp",root);
assert(existsSync(source),"Approved text-free Futsal player artwork must be checked into the repository.");
const approved=readFileSync(source);
assert(approved.byteLength>=5000,"Source illustration unexpectedly empty.");
assert(createHash("sha256").update(approved).digest("hex")==="b1ed3e4d91ce84d3ff9836123844072d02c4663e5a08c6679d03d41f37f8608d",
  "Futsal icon must match the exact approved text-free player artwork.");
assert(approved.toString("ascii",0,4)==="RIFF"&&approved.toString("ascii",8,12)==="WEBP",
  "Approved FUTSAL logo source must be a valid WebP.");
assert(config.expo.icon==="./assets/icon.png","Launcher icon must use branded PNG.");
assert(config.expo.android.adaptiveIcon.foregroundImage==="./assets/adaptive-icon.png","Android adaptive icon must use branded foreground.");
assert(config.expo.android.adaptiveIcon.backgroundColor==="#FFFFFF","Adaptive icon background must match the approved white FUTSAL artwork.");
const splash=config.expo.plugins.find((item)=>Array.isArray(item)&&item[0]==="expo-splash-screen");
assert(splash,"Splash screen must be configured.");
assert(splash[1].imageWidth===128,"Startup splash logo must be 80% of its previous 160px width.");
assert(splash[1].resizeMode==="contain","Startup logo must keep its proportions.");
assert(header.includes('source={require("../../../assets/icon.png")}'),"AppHeader must display the branded Futsal emblem.");
assert(header.includes('t("common.appName")'),"AppHeader must retain the Futsal title.");
assert(!header.includes('t("profile.headerSubtitle")'),"AppHeader must not display the 'Futsal society reserve' subtitle.");
assert(authHero.includes('source={require("../../../assets/icon.png")}'),"Login/register hero must display the same Futsal emblem.");
assert(!authHero.includes('backgroundColor:"#16A34A"'),"Auth hero must not retain the previous green logo style.");
assert(!authHero.includes("styles.mark}")&&!authHero.includes("  mark:{"),
  "Auth entry logo must not have a rounded frame, border or box shadow.");
assert(authHero.includes('markImage:{width:41.6,height:41.6,resizeMode:"contain"}'),
  "Auth entry logo must render at 80% of its original 52px width without distortion.");
assert(!header.includes("styles.drawerBrandIcon")&&!header.includes("  drawerBrandIcon:{"),
  "Drawer branding must not add a colored box or frame around the logo.");
for(const [source,start,end] of [
  [header,"  brandLogo:{","  brandTitle:{"],
  [header,"  drawerBrandLogo:{","  closeButton:{"],
  [authHero,"  markImage:{","  eyebrow:{"],
]){
  const style=source.slice(source.indexOf(start),source.indexOf(end));
  assert(style.startsWith(start)&&!/(borderWidth|borderColor|borderRadius|shadowColor|shadowOpacity|shadowRadius|shadowOffset|elevation|backgroundColor)/.test(style),
    "Logo images must be free of borders, backgrounds and shadows.");
}
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
console.log("Text-free Futsal branding verified: logo without frames/shadows in header, drawer and auth; 80% entry and splash scale.");
