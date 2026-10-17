/** Fail closed for cached referee overview authorization. Server errors, rejected
 * roles and cancelled requests are never converted into offline success.
 */
export function refereeOverviewRecovery(error:unknown):"OFFLINE"|"REJECT"{
  if(!error||typeof error!=="object")return "REJECT";
  const value=error as {code?:unknown;status?:unknown};
  return (value.code==="NETWORK_ERROR"||value.code==="TIMEOUT")&&
    (value.status===null||value.status===undefined)?"OFFLINE":"REJECT";
}
