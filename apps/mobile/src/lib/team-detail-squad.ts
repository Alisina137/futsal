import type {PlayerPosition,TeamMemberDto} from "@leaguekick/contracts";

export type SquadPositionFilter="ALL"|PlayerPosition;

export const squadPositionFilters:readonly SquadPositionFilter[]=[
  "ALL","GOALKEEPER","FIXO","ALA","PIVO","UNIVERSAL","UNSPECIFIED",
];

/** Server-returned membership is already privacy filtered. Never reconstruct hidden names. */
export function teamSquadView(
  visibleMembers:readonly TeamMemberDto[],
  managerUserId:string,captainUserId:string|null,
  options:{query?:string;position?:SquadPositionFilter;leadersOnly?:boolean}={},
){
  const query=(options.query??"").trim().toLocaleLowerCase();
  const position=options.position??"ALL";
  // Source-of-truth team IDs take priority over potentially stale membership roles.
  const leaders=visibleMembers.filter(member=>
    member.userId===managerUserId||member.userId===captainUserId);
  const members=options.leadersOnly?leaders:visibleMembers;
  const sorted=members.filter(member=>
    (position==="ALL"||member.position===position)&&
    (!query||member.publicDisplayName.toLocaleLowerCase().includes(query)||
      (member.shirtNumber!==null&&String(member.shirtNumber).includes(query))))
    .sort((a,b)=>{
      // Default: manager, captain, then players by jersey and display name.
      const order=(item:TeamMemberDto)=>item.userId===managerUserId?0:
        item.userId===captainUserId?1:2;
      const rank=order(a)-order(b);
      if(rank)return rank;
      const shirt=(a.shirtNumber??100)-(b.shirtNumber??100);
      if(shirt)return shirt;
      return a.publicDisplayName.localeCompare(b.publicDisplayName);
    });
  return {members:sorted,visibleCount:visibleMembers.length,leadersCount:leaders.length};
}

/** Team privacy is authoritative; roster identities are only those actually returned. */
export function canDisplayTeamRoster(
  teamPrivacy:"PUBLIC"|"PRIVATE",isApprovedMember:boolean,isManager:boolean,
){
  return teamPrivacy==="PUBLIC"||isApprovedMember||isManager;
}

/** The public player screen only supports profiles explicitly made public. */
export function mayOpenPublicPlayer(userId:string,publicProfileIds:readonly string[]){
  return publicProfileIds.includes(userId);
}
