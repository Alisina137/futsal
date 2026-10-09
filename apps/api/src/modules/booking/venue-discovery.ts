import type {VenueSearchSuggestion} from "@leaguekick/contracts";
import {hasPremiumWriteAccess} from "../billing/entitlement.js";
import type {VenueDiscoveryRecord} from "./booking.types.js";

function normalize(value:string){return value.trim().toLocaleLowerCase("en-US");}

/** Only publicly active venues with a currently valid paid plan or trial are discoverable. */
export function buildVenueDiscovery(
  records:ReadonlyArray<VenueDiscoveryRecord>,
  now:Date,
  filters:{q?:string;province?:string}={},
):{provinces:string[];suggestions:VenueSearchSuggestion[]}{
  const eligible=records.filter(row=>row.status==="ACTIVE" && hasPremiumWriteAccess(row.subscription,now));
  const provinces=[...new Set(eligible.map(row=>row.province.trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,"en",{sensitivity:"base"}));
  const q=normalize(filters.q??"");
  if(!q)return {provinces,suggestions:[]};
  const scoped=eligible.filter(row=>!filters.province||row.province===filters.province);
  const sorted=[...scoped].sort((a,b)=>
    Number(!normalize(a.name).startsWith(q))-Number(!normalize(b.name).startsWith(q))
    ||a.name.localeCompare(b.name,"en",{sensitivity:"base"}));
  const matches=(value:string)=>normalize(value).includes(q);
  const items:VenueSearchSuggestion[]=[];
  const unique=new Set<string>();
  function add(kind:VenueSearchSuggestion["kind"],label:string,detail:string,query:string){
    const key=`${kind}:${normalize(query)}`;
    if(!query.trim()||unique.has(key)||items.length>=8)return;
    unique.add(key);items.push({kind,label,detail,query});
  }
  // Venue names have priority; users can also pick a specific city/province/address.
  for(const row of sorted){
    if(matches(row.name))add("VENUE",row.name,`${row.city}, ${row.province}`,row.name);
  }
  for(const row of sorted){
    for(const value of [row.city,row.province,row.address]){
      if(matches(value))add("LOCATION",value,row.province,value);
    }
  }
  return {provinces,suggestions:items};
}
