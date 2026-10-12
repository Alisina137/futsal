import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  API_PROBE_INTERVAL_MS,API_PROBE_TIMEOUT_MS,API_FAILURE_GRACE_MS,
  advanceApiProbe,initialApiProbeState,
} from "../apps/mobile/src/lib/api-reachability.ts";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const provider=read("apps/mobile/src/providers/NetworkProvider.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const banner=read("apps/mobile/src/components/ConnectivityBanner.tsx");
const start=initialApiProbeState();
const step=(s,ok,at)=>advanceApiProbe(s,ok,at);
assert.equal(API_PROBE_INTERVAL_MS,6000);
assert.equal(API_PROBE_TIMEOUT_MS,5000);
assert.equal(API_FAILURE_GRACE_MS,12000);
assert.deepEqual(start,{reachable:null,failures:0,firstFailureAt:null,recoveries:0});

// Rapid navigation / multiple fetches cannot manufacture a confirmed outage.
let state=step(start,true,0).state;
assert.equal(state.reachable,true);
state=step(state,false,1000).state;
state=step(state,false,2000).state;
state=step(state,false,3000).state;
state=step(state,false,3500).state;
assert.equal(state.reachable,true,"Five quick health errors must not show server offline.");
state=step(state,true,4000).state;
assert.equal(state.reachable,true,"Transient failures clear after a good probe.");
assert.equal(state.failures,0);
assert.equal(state.firstFailureAt,null);
state=step(state,false,6000).state;
state=step(state,false,12000).state;
assert.equal(state.reachable,true,"Outage must not be declared during grace window.");
let transition=step(state,false,18000);
assert.equal(transition.state.reachable,false,"Sustained API outage must still be reported.");
assert.equal(transition.recovered,false);
transition=step(transition.state,true,24000);
assert.equal(transition.state.reachable,false,"Recovery needs multiple confirmed probes.");
transition=step(transition.state,true,30000);
assert.equal(transition.state.reachable,true);
assert.equal(transition.recovered,true,"Show recovered banner only after a real outage.");
assert.equal(step(transition.state,true,36000).recovered,false,
  "Normal healthy checks must not emit repeat reconnected banners.");
let startup=initialApiProbeState();
startup=step(startup,false,0).state;
startup=step(startup,false,6000).state;
assert.equal(startup.reachable,null,"Startup should not prematurely claim no server.");
startup=step(startup,false,12000).state;
assert.equal(startup.reachable,false,"Persistent startup server outage must appear.");
assert.equal(step(startup,true,18000).recovered,false);

for(const marker of [
  "if (probing.current) return apiReachableRef.current",
  "epoch!==probeEpoch.current",
  "if (AppState.currentState === \"active\") void checkApiNow()",
  "setApiReconnectVersion(value=>value+1)",
  "setApiHasResolved(false)",
  "advanceApiProbe(apiProbeHistory.current,succeeded,Date.now())",
]){
  assert.ok(provider.includes(marker),"Global monitor missing safeguard: "+marker);
}
assert.ok(api.includes("probeApi(timeoutMs = API_PROBE_TIMEOUT_MS)"));
assert.ok(banner.includes('apiHasResolved && apiReachable === false'),
  "Show server down only if the provider confirms an outage.");
console.log("API health regression verified: burst navigation does not trigger a false offline/reconnected banner; sustained outages and recovery still report correctly.");
