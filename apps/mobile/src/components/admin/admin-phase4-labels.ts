import type {LanguageCode} from "@leaguekick/contracts";
import type {SectionKey} from "./admin-navigation";
const strings={
  en:{teams:"Teams",competitions:"Competitions",referees:"Referees",reservations:"Reservations",cases:"Investigations",
    moderation:"Content moderation",support:"Support tickets",reports:"User reports",
    announcements:"Platform announcements",deliveries:"Delivery health"},
  "fa-AF":{teams:"تیم‌ها",competitions:"رقابت‌ها",referees:"داوران",reservations:"رزروها",cases:"بررسی‌ها",
    moderation:"نظارت بر محتوا",support:"درخواست‌های پشتیبانی",reports:"گزارش‌های کاربران",
    announcements:"اعلان‌های سراسری",deliveries:"وضعیت تحویل"},
  "ps-AF":{teams:"ټیمونه",competitions:"سیالۍ",referees:"ریفریان",reservations:"ریزرفونه",cases:"څېړنې",
    moderation:"د منځپانګې څارنه",support:"د ملاتړ ټکټونه",reports:"د کاروونکو راپورونه",
    announcements:"د پلیټفارم خبرتیاوې",deliveries:"د لېږد حالت"},
};
export function adminPhase4Label(section:SectionKey,language:LanguageCode):string|null{
  if(section==="teams"||section==="competitions"||section==="referees"||section==="reservations"||section==="cases"||section==="moderation"||section==="reports"||section==="support"||section==="announcements"||section==="deliveries")
    return strings[language][section];
  return null;
}
