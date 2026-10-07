import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const tabs = read("apps/mobile/app/(app)/(tabs)/_layout.tsx");
const localization = read("packages/localization/src/index.ts");

const checks = [
  [tabs.includes('direction:isRTL?"rtl":"ltr"'), "semantic RTL tab-bar direction"],
  [!tabs.includes("scaleX"), "tab labels and icons are not mirrored"],
  [tabs.includes("tabBarItemStyle:{") && tabs.includes("paddingVertical:4"), "tab item styling retained"],
  [localization.includes('{ code: "fa-AF", nativeName: "دری", rtl: true }'), "Dari marked RTL"],
  [localization.includes('{ code: "ps-AF", nativeName: "پښتو", rtl: true }'), "Pashto marked RTL"],
  [localization.includes('{ code: "en", nativeName: "English", rtl: false }'), "English marked LTR"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  throw new Error(`RTL navigation invariant(s) missing: ${failed.map(([, name]) => name).join(", ")}`);
}

console.log("Mobile RTL navigation verified: Dari/Pashto reverse tab item order without mirroring labels/icons; English remains LTR.");
