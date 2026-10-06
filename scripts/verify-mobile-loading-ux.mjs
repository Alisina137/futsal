import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root=process.cwd();
const mobileRoot=path.join(root,"apps","mobile");
const appRoot=path.join(mobileRoot,"app");
const loaderPath=path.join(mobileRoot,"src","components","ui","DataLoadingState.tsx");

async function filesUnder(dir){
  const entries=await readdir(dir,{withFileTypes:true});
  const files=[];
  for(const entry of entries){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())files.push(...await filesUnder(full));
    else if(/\.(ts|tsx)$/.test(entry.name))files.push(full);
  }
  return files;
}

const issues=[];
const appFiles=await filesUnder(appRoot);

for(const file of appFiles){
  const source=await readFile(file,"utf8");
  const rel=path.relative(root,file).replaceAll("\\","/");
  if(/t\(\s*["']common\.loading["']\s*\)/.test(source)){
    issues.push(`${rel}: visible common.loading text is not allowed; use DataLoadingState.`);
  }
  if(/const\s*\[\s*loading\s*,\s*setLoading\s*\]\s*=\s*useState\(true\)/.test(source)
    && !source.includes("DataLoadingState")){
    issues.push(`${rel}: initial page loading state must render DataLoadingState.`);
  }
}

const loader=await readFile(loaderPath,"utf8");
for(const marker of [
  "ActivityIndicator",
  "Animated.loop",
  "styles.loaderLayer",
  'variant="list"',
]){
  if(!loader.includes(marker)){
    issues.push(`apps/mobile/src/components/ui/DataLoadingState.tsx: missing loader UX marker ${marker}`);
  }
}
if(!loader.includes('alignItems:"center"')||!loader.includes('justifyContent:"center"')){
  issues.push("DataLoadingState must keep its loader centered.");
}
if(!loader.includes("surfaceMuted")){
  issues.push("DataLoadingState must render skeleton placeholders.");
}

if(issues.length){
  console.error("Mobile loading UX verification failed:");
  for(const issue of issues)console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Mobile loading UX verified across ${appFiles.length} app source files: no visible loading text, centered shared loader, and skeleton coverage for initial page fetches.`);
