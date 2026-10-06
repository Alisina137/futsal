import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const header = read("apps/mobile/src/components/ui/AppHeader.tsx");
const tabs = read("apps/mobile/app/(app)/(tabs)/_layout.tsx");
const localization = read("packages/localization/src/index.ts");

assert(header.includes('name="menu-outline"'), "Header must expose a hamburger menu button.");
assert(header.includes('style={styles.header}'), "Header must use the fixed physical left/right layout.");
assert(header.includes('router.navigate("/settings")'), "Top-right profile control must open Profile.");
assert(header.includes('user?.profileImageUrl'), "Header profile control must render the profile image when available.");
assert(header.includes('href:"/home"'), "Hamburger menu must include Home.");
assert(header.includes('href:"/venues"'), "Hamburger menu must include Venues.");
assert(header.includes('href:"/bookings"'), "Hamburger menu must include My Bookings.");
assert(header.includes('href:"/feed"'), "Hamburger menu must include Feed.");
assert(header.includes('href:"/schedule"'), "Hamburger menu must include owner Schedule.");
assert(header.includes('href:"/settings"'), "Hamburger menu must include Profile.");
assert(header.includes('width:286') && header.includes('maxWidth:"82%"'), "Hamburger navigation must use a compact bounded width.");
assert(header.includes('maxHeight:"86%"'), "Hamburger navigation must cap height without filling the screen.");
const drawerBlock = header.slice(header.indexOf("drawer:{"), header.indexOf("drawerHeader:{"));
assert(!drawerBlock.includes('height:"100%"'), "Hamburger navigation must not force full-screen height.");
assert(header.includes('onPressIn={()=>setMenuOpen(false)}'), "Touching outside the drawer must close the menu immediately.");
assert(tabs.includes('tabBarStyle:{display:"none"}'), "Bottom tab bar must remain hidden.");
assert((localization.match(/"navigation\.openMenu"/g) ?? []).length === 3, "Open-menu label must exist in all three languages.");
assert((localization.match(/"navigation\.closeMenu"/g) ?? []).length === 3, "Close-menu label must exist in all three languages.");

console.log("Mobile header navigation verified: hamburger left, profile right, compact dismissible drawer, destinations present, and bottom tabs hidden.");
