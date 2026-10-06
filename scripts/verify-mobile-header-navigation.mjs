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
assert(header.includes('width:272') && header.includes('maxWidth:"82%"'), "Hamburger navigation must use a compact bounded width.");
assert(header.includes('const APP_HEADER_HEIGHT=68;'), "Hamburger navigation must share the app header height anchor.");
assert(header.includes('marginTop:insets.top+APP_HEADER_HEIGHT+spacing.xs'), "Hamburger navigation must begin below the safe-area app header.");
assert(header.includes('maxHeight:Math.max(240,windowHeight-(insets.top+APP_HEADER_HEIGHT+spacing.lg))'), "Hamburger navigation must remain within the visible app area.");
const drawerBlock = header.slice(header.indexOf("drawer:{"), header.indexOf("drawerHeader:{"));
assert(!drawerBlock.includes('height:"100%"'), "Hamburger navigation must not force full-screen height.");
assert(header.includes('style={styles.modalRoot}') && header.includes('onPress={()=>setMenuOpen(false)}'), "Any touch outside the drawer must close the menu.");
assert(header.includes('onPress={(event)=>event.stopPropagation()}'), "Touches inside the drawer must not dismiss it.");
assert(tabs.includes('tabBarStyle:{display:"none"}'), "Bottom tab bar must remain hidden.");
assert((localization.match(/"navigation\.openMenu"/g) ?? []).length === 3, "Open-menu label must exist in all three languages.");
assert((localization.match(/"navigation\.closeMenu"/g) ?? []).length === 3, "Close-menu label must exist in all three languages.");

console.log("Mobile header navigation verified: hamburger left, profile right, compact below-header drawer, outside-touch dismissal, destinations present, and bottom tabs hidden.");
