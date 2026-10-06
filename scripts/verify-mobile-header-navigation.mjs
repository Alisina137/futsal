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
assert(header.includes('label:t("home.title")') && header.includes('icon:"home-outline"'), "Home menu item must use the Home label and home icon for every account type.");
assert(!header.includes('owner?t("owner.dashboardTitle"):t("home.title")'), "Venue Owner menu must not rename Home to Venue Dashboard.");
assert(header.includes('href:"/venues"'), "Hamburger menu must include Venues.");
assert(header.includes('label:t("booking.venuesTitle"),icon:"football-outline",href:"/venues"'), "Venues menu item must use a futsal/playground-related icon instead of a building icon.");
assert(header.includes('href:"/teams"'), "Hamburger menu must include Teams.");
assert(header.includes('href:"/competitions"'), "Hamburger menu must include Competitions.");
assert(header.includes('href:"/bookings"'), "Hamburger menu must include My Bookings.");
assert(!header.includes('href:"/feed"'), "Feed must not remain a separate hamburger option after Home becomes the social feed.");
assert(header.includes('href:"/schedule"'), "Hamburger menu must include owner Schedule.");
const venuesIndex = header.indexOf('href:"/venues"');
const teamsIndex = header.indexOf('href:"/teams"');
const competitionsIndex = header.indexOf('href:"/competitions"');
const bookingsIndex = header.indexOf('href:"/bookings"');
assert(venuesIndex < teamsIndex && teamsIndex < competitionsIndex && competitionsIndex < bookingsIndex, "Hamburger order must be Venues, Teams, Competitions, then My Bookings.");
assert(header.includes('href:"/settings"'), "Hamburger menu must include Profile.");
assert(header.includes('width:272') && header.includes('maxWidth:"82%"'), "Hamburger navigation must use a compact bounded width.");
assert(header.includes('marginTop:insets.top+spacing.sm+20'), "Hamburger navigation must sit exactly 20px lower than the adjusted safe-area position.");
assert(header.includes('maxHeight:Math.max(240,windowHeight-(insets.top+spacing.lg))'), "Hamburger navigation must remain within the visible app area.");
assert(header.includes('paddingHorizontal:spacing.sm') && header.includes('marginLeft:spacing.sm'), "Drawer spacing must align the close button with the hamburger button.");
assert(header.includes('style={styles.drawerHeader}') && header.includes('flexDirection:"row"'), "Drawer header must keep the close button on the physical left in every language.");
const drawerBlock = header.slice(header.indexOf("drawer:{"), header.indexOf("drawerHeader:{"));
assert(!drawerBlock.includes('height:"100%"'), "Hamburger navigation must not force full-screen height.");
assert(header.includes('style={styles.modalRoot}') && header.includes('onPress={()=>setMenuOpen(false)}'), "Any touch outside the drawer must close the menu.");
assert(header.includes('onPress={(event)=>event.stopPropagation()}'), "Touches inside the drawer must not dismiss it.");
assert(tabs.includes('tabBarStyle:{display:"none"}'), "Bottom tab bar must remain hidden.");
assert((localization.match(/"navigation\.openMenu"/g) ?? []).length === 3, "Open-menu label must exist in all three languages.");
assert((localization.match(/"navigation\.closeMenu"/g) ?? []).length === 3, "Close-menu label must exist in all three languages.");

console.log("Mobile header navigation verified: Home feed navigation uses Venues, Teams, Competitions, My Bookings, and no separate Feed item.");
