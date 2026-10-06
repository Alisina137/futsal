import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const header = read("apps/mobile/src/components/ui/AppHeader.tsx");
const tabs = read("apps/mobile/app/(app)/(tabs)/_layout.tsx");
const localization = read("packages/localization/src/index.ts");

const checks = [
  [header.includes('{flexDirection:isRTL?"row-reverse":"row"}'), "hamburger menu rows honor RTL reading order"],
  [header.includes('name={isRTL?"chevron-back":"chevron-forward"}'), "menu navigation chevrons honor RTL direction"],
  [header.includes('style={styles.header}') && header.includes('flexDirection:"row"'), "hamburger remains physical-left and profile remains physical-right"],
  [!header.includes("scaleX") && !tabs.includes("scaleX"), "labels and icons are not visually mirrored"],
  [tabs.includes('tabBarStyle:{display:"none"}'), "legacy bottom tab bar remains hidden"],
  [localization.includes('{ code: "fa-AF", nativeName: "دری", rtl: true }'), "Dari marked RTL"],
  [localization.includes('{ code: "ps-AF", nativeName: "پښتو", rtl: true }'), "Pashto marked RTL"],
  [localization.includes('{ code: "en", nativeName: "English", rtl: false }'), "English marked LTR"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  throw new Error(`RTL navigation invariant(s) missing: ${failed.map(([, name]) => name).join(", ")}`);
}

console.log("Mobile RTL navigation verified: fixed physical header controls, RTL-aware drawer rows/chevrons, and hidden legacy tabs.");
