import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const media=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const detail=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const tabs=read("apps/mobile/src/hooks/useVisibleTab.ts");
const l10n=read("packages/localization/src/index.ts");
const pkg=JSON.parse(read("package.json"));

function includesAll(source,checks,label){
  for(const check of checks)assert.ok(source.includes(check),label+" missing "+check);
}
includesAll(media,[
  'const venuePostFilters:readonly VenuePostFilter[]=[',
  '"all","general","announcement","promotion","competition","result"',
  'useState<VenuePostFilter>("all")',
  'if(sub==="posts")setFilter("all");',
  'const postFilterNav=useVisibleTab<VenuePostFilter>(filter)',
  'testID="venue-posts-filter-nav"',
  'ref={postFilterNav.scrollRef}',
  'onLayout={postFilterNav.onViewport}',
  'onContentSizeChange={postFilterNav.onContentSize}',
  'onLayout={event=>postFilterNav.cellLayout(key,event)}',
  'postFilterNav.focus(key,true)',
  'accessibilityRole="tab"',
  'accessibilityState={{selected:filter===key}}',
  'style={[styles.pill,styles.postFilterItem,filter===key&&styles.pillActive]}',
  'postFilterRow:{gap:spacing.sm',
  'postFilterItem:{minHeight:48',
  'sub==="posts"?<ScrollView',
  '{loading?<DataLoadingState variant="list" minHeight={240}/>:',
  'error?<Empty icon="cloud-offline-outline"',
  'kind,postType,sort:"newest",page:1,limit:12',
  'kind,postType,sort:"newest",page:page+1,limit:12',
], "Venue Posts navigation");
assert.equal(media.match(/sort:"newest"/g)?.length,2,
  "First page and Load More must always use newest-first ordering.");
assert.ok(!media.includes("setSort(")&&!media.includes('label={tr5("sort.newest")}')
  &&!media.includes('label={tr5("sort.oldest")}'),
  "Remove oldest/newest visible sorting controls from public venue posts.");
const nav=media.indexOf('testID="venue-posts-filter-nav"');
const wait=media.indexOf('{loading?<DataLoadingState variant="list" minHeight={240}/>:');
const posts=media.indexOf('{filtered.map(post=>');
assert.ok(nav>0&&wait>nav&&posts>wait,
  "The category navigation must mount BEFORE loading/error/empty content.");
assert.ok(media.includes('if(loading&&sub!=="posts")')&&media.includes('if(error&&sub!=="posts")'),
  "Loading and errors must not short-circuit the Posts category bar.");
includesAll(detail,[
  'testID={"venue-subtab-"+main+"-"+item}',
  'accessibilityState={{selected:sub[main]===item}}',
  'setNavigation(current=>switchVenueSub(current,main,item as VenueDetailSubtabState[typeof main]))',
  'subNav.focus(item,true)',
  'minHeight:viewportHeight',
],"Parent venue Media / Posts-Photos-Videos navigation");
includesAll(tabs,['scrollRef.current?.scrollTo','cell.x+cell.width/2','[active,focus]'],
  "Selected tab centering");
for(const key of ["all","general","announcement","promotion","competition","result"]){
  assert.equal(l10n.split('"vd5.filter.'+key+'"').length-1,3,
    "Category label missing in English/Dari/Pashto: "+key);
}
assert.ok(pkg.scripts["verify:venue-post-navigation"]?.includes("verify-venue-post-navigation.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:venue-post-navigation"));
console.log("Public venue Posts navigation verified: All posts default, selected/centered category tabs, persistent loading/error navigation, always newest-first pages and no redundant sort controls.");
