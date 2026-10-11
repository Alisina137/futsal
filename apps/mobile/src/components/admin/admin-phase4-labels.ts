import type {LanguageCode} from "@leaguekick/contracts";
import type {SectionKey} from "./admin-navigation";
const strings={
  en:{teams:"Teams",competitions:"Competitions",referees:"Referees",reservations:"Reservations",cases:"Investigations"},
  "fa-AF":{teams:"تیم‌ها",competitions:"رقابت‌ها",referees:"داوران",reservations:"رزروها",cases:"بررسی‌ها"},
  "ps-AF":{teams:"ټیمونه",competitions:"سیالۍ",referees:"ریفریان",reservations:"ریزرفونه",cases:"څېړنې"},
};
export function adminPhase4Label(section:SectionKey,language:LanguageCode):string|null{
  if(section==="teams"||section==="competitions"||section==="referees"||section==="reservations"||section==="cases")
    return strings[language][section];
  return null;
}
