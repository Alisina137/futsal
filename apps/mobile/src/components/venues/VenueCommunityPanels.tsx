import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {BookingDto,PublicVenueDto,VenueReviewSummary} from "@leaguekick/contracts";
import {useEffect,useState} from "react";
import {Pressable,StyleSheet,View} from "react-native";
import {bookingApi,venueApi} from "../../lib/api";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {TextField} from "../ui/TextField";
import {TimeOfDayPickerField} from "../ui/TimeOfDayPickerField";

export function VenueReviewsPanel({venue,reviewBookingId}:{
  venue:PublicVenueDto;reviewBookingId?:string|undefined;
}){
  const {session}=useAuth(),{t,isRTL,language}=useLocale();
  const tr=(key:string,values?:Record<string,string|number>)=>t(("booking.community."+key) as never,values);
  const [summary,setSummary]=useState<VenueReviewSummary|null>(null);
  const [bookings,setBookings]=useState<BookingDto[]>([]);
  const [selected,setSelected]=useState<string|null>(reviewBookingId??null);
  const [rating,setRating]=useState(5),[body,setBody]=useState("");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const actor=session?.accessToken;
  async function reload(){
    setLoading(true);setError(null);
    try{
      const [reviews,mine]=await Promise.all([
        venueApi.reviews(venue.id),
        actor?bookingApi.mine(actor):Promise.resolve({bookings:[] as BookingDto[]}),
      ]);
      setSummary(reviews);
      setBookings(mine.bookings.filter(b=>b.venueId===venue.id&&b.playerUserId===session?.user.id));
    }catch{setError(tr("loadError"));}
    finally{setLoading(false);}
  }
  useEffect(()=>{void reload();},[venue.id,actor]);
  useEffect(()=>{if(reviewBookingId)setSelected(reviewBookingId);},[reviewBookingId]);
  const reviewed=new Set(summary?.reviews.map(x=>x.bookingId)??[]);
  const eligible=bookings.filter(b=>b.source==="ONLINE"&&b.status==="CONFIRMED"&&
    Date.parse(b.endsAt)<=Date.now()&&!reviewed.has(b.id));
  async function submit(){
    if(!actor||!selected||!eligible.some(b=>b.id===selected)||busy)return;
    setBusy(true);setError(null);
    try{
      await bookingApi.review(actor,{bookingId:selected,rating,body:body.trim()});
      setSelected(null);setBody("");setRating(5);
      await reload();
    }catch{setError(tr("submitError"));}
    finally{setBusy(false);}
  }
  return <View testID="venue-verified-reviews" style={styles.stack}>
    <Card style={styles.stack}>
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="star" size={25} color="#B7791F"/>
        <AppText variant="title" weight="bold">{summary?.reviewCount?
          summary.averageRating.toFixed(1):"—"} / 5</AppText>
        <AppText muted variant="caption">{tr("reviewsCount",{count:summary?.reviewCount??0})}</AppText>
      </View>
      <AppText variant="caption" muted>{tr("verifiedOnly")}</AppText>
      {error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}
      {loading?<DataLoadingState variant="list" minHeight={90}/>:null}
      {summary?.reviews.length?summary.reviews.map(item=><View key={item.id}
        style={styles.review}>
        <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="shield-checkmark" size={17} color="#15803D"/>
          <AppText weight="medium" style={{flex:1}}>{tr("verifiedGuest")}</AppText>
          <AppText variant="caption" weight="bold" style={{color:"#B7791F"}}>
            {"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}
          </AppText>
        </View>
        {item.body?<AppText>{item.body}</AppText>:null}
        <AppText variant="caption" muted>
          {new Intl.DateTimeFormat(language==="en"?"en-GB":language,{
            timeZone:"Asia/Kabul",day:"numeric",month:"short",year:"numeric",
          }).format(new Date(item.createdAt))}
        </AppText>
      </View>):!loading?<AppText muted>{tr("noReviews")}</AppText>:null}
      <Button label={t("common.retry")} variant="secondary"
        disabled={loading||busy} onPress={()=>void reload()}/>
    </Card>
    {actor?<Card style={styles.stack}>
      <AppText variant="bodyLarge" weight="bold">{tr("writeReview")}</AppText>
      {!eligible.length?<AppText muted variant="caption">{tr("reviewEligibility")}</AppText>:<>
        <AppText muted variant="caption">{tr("pickBooking")}</AppText>
        <View style={styles.stack}>
          {eligible.slice(0,10).map(b=><Pressable key={b.id}
            testID={"venue-review-booking-"+b.id} accessibilityRole="button"
            accessibilityState={{selected:selected===b.id}}
            onPress={()=>setSelected(b.id)}
            style={[styles.bookingChoice,selected===b.id&&styles.chosen]}>
            <Ionicons name={selected===b.id?"checkmark-circle":"ellipse-outline"}
              color={colors.primary} size={20}/>
            <AppText style={{flex:1}}>{new Intl.DateTimeFormat(
              language==="en"?"en-GB":language,{timeZone:venue.timezone,
                day:"numeric",month:"short",year:"numeric"}).format(new Date(b.startsAt))}</AppText>
          </Pressable>)}
        </View>
        <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {[1,2,3,4,5].map(n=><Pressable key={n} testID={"venue-review-star-"+n}
            accessibilityRole="button" accessibilityLabel={tr("stars",{count:n})}
            accessibilityState={{selected:n===rating}} onPress={()=>setRating(n)}>
            <Ionicons name={n<=rating?"star":"star-outline"} size={30} color="#B7791F"/>
          </Pressable>)}
        </View>
        <TextField label={tr("yourReview")} value={body} onChangeText={setBody}
          placeholder={tr("reviewPlaceholder")} multiline maxLength={500}/>
        <Button label={tr("publishReview")} onPress={()=>void submit()}
          disabled={!selected||busy} loading={busy}/>
      </>}
    </Card>:<Card><AppText muted>{tr("signInReview")}</AppText></Card>}
  </View>;
}

export function VenueSavedTimePanel({venue}:{
  venue:PublicVenueDto;
}){
  const {session}=useAuth(),{t}=useLocale();
  const tr=(key:string)=>t(("booking.community."+key) as never);
  const [preferred,setPreferred]=useState("18:00");
  const [saved,setSaved]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const token=session?.accessToken;
  useEffect(()=>{
    if(!token)return;
    let active=true;
    void bookingApi.savedVenueTime(token,venue.id)
      .then(result=>{if(active){setSaved(result.preferredStart);
        if(result.preferredStart)setPreferred(result.preferredStart);}})
      .catch(()=>{if(active)setError(tr("loadError"));});
    return()=>{active=false;};
  },[token,venue.id]);
  async function save(value:string|null){
    if(!token||busy)return;
    setBusy(true);setError(null);
    try{
      const result=await bookingApi.saveVenueTime(token,venue.id,value);
      setSaved(result.preferredStart);
    }catch{setError(tr("saveError"));}
    finally{setBusy(false);}
  }
  return <Card testID="venue-saved-time" style={styles.stack}>
    <AppText variant="bodyLarge" weight="bold">{tr("savedTime")}</AppText>
    <AppText variant="caption" muted>{tr("savedTimeDescription")}</AppText>
    {token?<><TimeOfDayPickerField label={tr("preferredStart")}
      value={preferred} onChange={setPreferred}/>
      <AppText variant="caption" muted>{saved?tr("saved"):tr("notSaved")}</AppText>
      <View style={styles.row}>
        <Button label={tr("saveTime")} loading={busy} disabled={busy}
          onPress={()=>void save(preferred)} style={{flex:1}}/>
        {saved?<Button label={tr("clearTime")} variant="secondary" disabled={busy}
          onPress={()=>void save(null)} style={{flex:1}}/>:null}
      </View>
    </>:<AppText muted>{tr("signInSave")}</AppText>}
    {error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}
  </Card>;
}
const styles=StyleSheet.create({
  stack:{gap:spacing.md},
  row:{flexDirection:"row",alignItems:"center",gap:spacing.sm,flexWrap:"wrap"},
  review:{gap:spacing.xs,borderTopColor:colors.border,borderTopWidth:1,paddingTop:spacing.sm},
  bookingChoice:{flexDirection:"row",alignItems:"center",gap:spacing.sm,minHeight:45,
    borderRadius:radius.md,padding:spacing.sm,borderColor:colors.border,borderWidth:1},
  chosen:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
});
