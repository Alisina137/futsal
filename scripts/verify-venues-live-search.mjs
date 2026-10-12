import {readFileSync} from "node:fs";
import assert from "node:assert/strict";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const page=read("apps/mobile/app/(app)/(tabs)/venues.tsx");
const filters=read("apps/mobile/src/components/venues/VenueAdvancedFilters.tsx");

const section=(source,first,last)=>{
  const start=source.indexOf(first);
  const end=source.indexOf(last,start+first.length);
  assert.ok(start>=0&&end>start,"Expected function boundary: "+first);
  return source.slice(start,end);
};

const typing=section(page,"  function changeVenueQuery(","  function selectSuggestion(");
assert.ok(typing.includes("setQuery(nextQuery)")&&
  typing.includes("setSuggestionsVisible(true)")&&
  typing.includes("nameSearchTimer.current=setTimeout(()=>")&&
  typing.includes("},2000);"),
  "Venue name/location typing must trigger search exactly 2s after the last edit.");
assert.ok(typing.includes("cancelScheduledSearch();")&&
  typing.includes("++latestRequest.current")&&
  typing.includes("applySearch(nextQuery,province,filtersRef.current)"),
  "New text must replace the previous pending timer and prevent outdated results.");

const selection=section(page,"  function editFilters(","  return <Screen");
assert.ok(selection.includes("filtersRef.current=next")&&selection.includes("setFilters(next)")&&
  selection.includes("const priceChanged=")&&
  selection.includes("},500);")&&selection.includes("}else{\n      applySearch(query,province,next);"),
  "Date/time/sort/availability chips must refilter immediately; numeric price typing may coalesce.");
const apply=section(page,"  function applySearch(","  function changeVenueQuery(");
assert.ok(apply.includes("cancelScheduledSearch();")&&
  apply.includes("void load(nextQuery,nextProvince,nextFilters);"),
  "Immediate actions and Search button must cancel pending auto searches, not repeat requests.");
assert.ok(page.includes("onChangeText={changeVenueQuery}")&&
  page.includes('onSubmitEditing={()=>applySearch()}'),
  "Typing and keyboard Submit must use the shared search workflow.");
assert.ok(page.includes("applySearch(suggestion.query,province)")&&
  page.includes("applySearch(query,nextProvince)"),
  "Suggested place and province selection must continue searching immediately.");
assert.ok(page.includes("useEffect(()=>()=>cancelScheduledSearch(),[cancelScheduledSearch])"),
  "Timers must be cleaned up on component unmount.");
assert.ok(page.includes('latestRequest.current===request'),
  "Concurrent availability responses must remain ordered, retaining latest-search protection.");
assert.ok(filters.includes('onPress={()=>chooseDate(today)}')&&
  filters.includes('onPress={()=>chooseDate(venueDateAdd(today,1))}')&&
  filters.includes('onPress={()=>set("period",period)}')&&
  filters.includes('onPress={()=>set("availableOnly",!value.availableOnly)}')&&
  filters.includes('onPress={()=>set("sort",sort)}')&&
  filters.includes('onPress={()=>full&&chooseDate(full)}'),
  "Today/Tomorrow/custom date, Any/period, Available Only, sort selectors must call parent immediately.");
console.log("Venues auto-filter verified: 2000ms name/location pause, one-tap date/time filters, 500ms price debounce, cancellation and stale-response safety.");
