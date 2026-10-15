import assert from "node:assert/strict";
import {test} from "node:test";
import {validateOwnerAnalyticsRange} from "../../apps/mobile/src/lib/owner-analytics-filters.ts";
import {ownerVenueSettingsDirty} from "../../apps/mobile/src/lib/owner-venue-settings-draft.ts";

test("analytics strict Gregorian day boundaries and order",()=>{
  assert.equal(validateOwnerAnalyticsRange("2026-02-29","2026-03-01","2026-10-15"),"INVALID");
  assert.equal(validateOwnerAnalyticsRange("2028-02-29","2028-03-01","2028-03-01"),null);
  assert.equal(validateOwnerAnalyticsRange("2026-02-30","2026-03-01","2026-10-15"),"INVALID");
  assert.equal(validateOwnerAnalyticsRange("2026-13-01","2026-10-15","2026-10-15"),"INVALID");
  assert.equal(validateOwnerAnalyticsRange("2026-1-01","2026-10-15","2026-10-15"),"INVALID");
  assert.equal(validateOwnerAnalyticsRange("2026-10-16","2026-10-15","2026-10-15"),"INVERTED");
  assert.equal(validateOwnerAnalyticsRange("2026-10-15","2026-10-16","2026-10-15"),"FUTURE");
  assert.equal(validateOwnerAnalyticsRange("2026-10-15","2026-10-15","2026-10-15"),null);
  assert.equal(validateOwnerAnalyticsRange("2025-10-16","2026-10-15","2026-10-15"),null);
  assert.equal(validateOwnerAnalyticsRange("2025-10-15","2026-10-15","2026-10-15"),"TOO_LONG");
});

const saved={
  venueId:"venue-1",name:"A",province:"Kabul",city:"Kabul",address:"Kabul",
  publicPhone:"0700123456",whatsappPhone:null,latitude:34.523,longitude:69.18,
  bookingMode:"INSTANT",onlineBookingEnabled:true,
  minimumBookingNoticeMinutes:30,maximumAdvanceBookingDays:30,
  cancellationPolicy:"No cancellations within 12 hours.",
  amenities:["PARKING","LIGHTING"],houseRules:null,
  court:{id:"court-1",name:"Main Court",defaultSessionDurationMinutes:90,basePriceAfn:1500},
};
const draft={
  publicPhone:saved.publicPhone,whatsappPhone:"",latitude:String(saved.latitude),
  longitude:String(saved.longitude),courtName:saved.court.name,
  duration:"90",basePrice:"1500",bookingMode:"INSTANT",onlineBookingEnabled:true,
  noticeMinutes:"30",advanceDays:"30",
  cancellationPolicy:saved.cancellationPolicy,
  amenities:["LIGHTING","PARKING"],houseRules:"",
};
test("settings uses semantic persisted values, not amenity ordering",()=>{
  assert.equal(ownerVenueSettingsDirty(saved,draft),false);
  assert.deepEqual(saved.amenities,["PARKING","LIGHTING"]);
  assert.equal(ownerVenueSettingsDirty(saved,{...draft,publicPhone:" "+draft.publicPhone+" "}),false);
});
test("editing any persisted settings field raises unsaved draft state",()=>{
  const updates={
    publicPhone:"0700999888",whatsappPhone:"0700999777",
    latitude:"34.1",longitude:"69.2",courtName:"Side Court",duration:"120",
    basePrice:"1600",bookingMode:"APPROVAL",onlineBookingEnabled:false,
    noticeMinutes:"90",advanceDays:"45",cancellationPolicy:"Cancellation 48 hours before.",
    houseRules:"Indoor shoes only",amenities:["PARKING"],
  };
  for(const [key,value] of Object.entries(updates)){
    assert.equal(ownerVenueSettingsDirty(saved,{...draft,[key]:value}),true,key);
  }
});
