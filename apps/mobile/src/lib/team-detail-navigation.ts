/** One navigation source of truth for the public Team Detail experience. */
export const teamDetailSubtabs={
  media:["posts","photos"],
  squad:["players","leaders"],
  matches:["upcoming","results"],
  competitions:["active","past"],
  stats:["overview","form","topPlayers"],
  about:["overview","members"],
} as const;

export type TeamDetailMainTab=keyof typeof teamDetailSubtabs;
export type TeamDetailSubtabs={
  [T in TeamDetailMainTab]:(typeof teamDetailSubtabs)[T][number];
};
export type TeamDetailNavigation={
  main:TeamDetailMainTab;
  sub:TeamDetailSubtabs;
};
const defaults:TeamDetailSubtabs={
  media:"posts",squad:"players",matches:"upcoming",
  competitions:"active",stats:"overview",about:"overview",
};

function first(value:string|string[]|undefined){
  return typeof value==="string"?value:Array.isArray(value)?value[0]:undefined;
}

function validMain(value:string|undefined):value is TeamDetailMainTab{
  return !!value&&Object.prototype.hasOwnProperty.call(teamDetailSubtabs,value);
}
function validSub<T extends TeamDetailMainTab>(main:T,value:string|undefined):value is TeamDetailSubtabs[T]{
  return !!value&&(teamDetailSubtabs[main] as readonly string[]).includes(value);
}

/** New team visits default to Media > Posts; only valid deep links override it. */
export function initialTeamNavigation(
  requestedMain?:string|string[],requestedSub?:string|string[],
):TeamDetailNavigation{
  const mainValue=first(requestedMain);
  const main=validMain(mainValue)?mainValue:"media";
  const subValue=first(requestedSub);
  return {main,sub:{...defaults,...(validSub(main,subValue)?{[main]:subValue}:{})}};
}

/** Ordinary main-tab changes preserve every previously selected subtab. */
export function switchTeamMain<T extends TeamDetailMainTab>(
  current:TeamDetailNavigation,main:T,target?:TeamDetailSubtabs[T],
):TeamDetailNavigation{
  return {main,sub:target?{...current.sub,[main]:target}:current.sub};
}

/** Inactive tabs cannot change the active tab's sub-selection. */
export function switchTeamSub<T extends TeamDetailMainTab>(
  current:TeamDetailNavigation,main:T,target:TeamDetailSubtabs[T],
):TeamDetailNavigation{
  if(current.main!==main)return current;
  return {...current,sub:{...current.sub,[main]:target}};
}
