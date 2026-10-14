import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {BookingDto,PublicVenueDto,VenueReviewSort,VenueReviewSummary} from "@leaguekick/contracts";
import {useEffect,useRef,useState} from "react";
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
  const tx=(key:string)=>t(("vd2."+key) as never);
  const [summary,setSummary]=useState<VenueReviewSummary|null>(null);
  const [sort,setSort]=useState<VenueReviewSort>("recent");
  const [moreBusy,setMoreBusy]=useState(false);
  const [eligibleLimit,setEligibleLimit]=useState(10);
  const requestSequence=useRef(0);
  const [bookings,setBookings]=useState<BookingDto[]>([]);
  const [reviewedBookingIds,setReviewedBookingIds]=useState<string[]>([]);
  const [selected,setSelected]=useState<string|null>(reviewBookingId??null);
  const [rating,setRating]=useState(5),[body,setBody]=useState("");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const actor=session?.accessToken;
  async function reload(){
    const sequence=++requestSequence.current;
    setLoading(true);setError(null);setMoreBusy(false);
    try{
      const [reviews,mine,reviewed]=await Promise.all([
        venueApi.reviews(venue.id,1,sort),
        actor?bookingApi.mine(actor):Promise.resolve({bookings:[] as BookingDto[]}),
        actor?bookingApi.myVenueReviews(actor,venue.id):
          Promise.resolve({venueId:venue.id,reviewedBookingIds:[] as string[]}),
      ]);
      if(sequence!==requestSequence.current)return;
      setSummary(reviews);
      setReviewedBookingIds(reviewed.reviewedBookingIds);
      setBookings(mine.bookings.filter(b=>b.venueId===venue.id&&b.playerUserId===session?.user.id));
    }catch{
      if(sequence===requestSequence.current)setError(tr("loadError"));
    }finally{
      if(sequence===requestSequence.current)setLoading(false);
    }
  }
  useEffect(()=>{
    // Never retain a previous account's private review eligibility on identity change.
    setReviewedBookingIds([]);setBookings([]);setSummary(null);setEligibleLimit(10);
    void reload();
    return()=>{requestSequence.current+=1;};
  },[venue.id,actor,sort]);
  async function loadMore(){
    if(!summary?.hasMore||loading||moreBusy)return;
    const sequence=requestSequence.current;
    setMoreBusy(true);setError(null);
    try{
      const next=await venueApi.reviews(venue.id,summary.page+1,sort);
      if(sequence!==requestSequence.current)return;
      setSummary(current=>current?{
        ...next,reviews:[...current.reviews,
          ...next.reviews.filter(item=>!current.reviews.some(previous=>previous.id===item.id))],
      }:next);
    }catch{
      if(sequence===requestSequence.current)setError(tr("loadError"));
    }finally{
      if(sequence===requestSequence.current)setMoreBusy(false);
    }
  }
  useEffect(()=>{
    // Forms are private to the current account and venue, even during a pending POST.
    setBusy(false);setBody("");setRating(5);
    setSelected(reviewBookingId??null);
  },[actor,venue.id]);
  useEffect(()=>{setSelected(reviewBookingId??null);},[reviewBookingId,venue.id]);
  const reviewed=new Set(reviewedBookingIds);
  const eligible=bookings.filter(b=>b.source==="ONLINE"&&b.status==="CONFIRMED"&&
    Date.parse(b.endsAt)<=Date.now()&&!reviewed.has(b.id));
  async function submit(){
    if(!actor||!selected||!eligible.some(b=>b.id===selected)||busy)return;
    // A completed request from a prior account or venue must not reset the
    // current user's review form, eligibility or error state.
    const request=requestSequence.current;
    setBusy(true);setError(null);
    try{
      await bookingApi.review(actor,{bookingId:selected,rating,body:body.trim()});
      if(request!==requestSequence.current)return;
      setSelected(null);setBody("");setRating(5);
      await reload();
    }catch{
      if(request===requestSequence.current)setError(tr("submitError"));
    }finally{
      if(request===requestSequence.current)setBusy(false);
    }
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
      {summary?.ratingCounts?<View style={styles.stack}>
        {([5,4,3,2,1] as const).map(rating=><View key={rating}
          style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <AppText variant="caption" weight="medium">{"★ "+rating}</AppText>
          <View style={{flex:1,minWidth:60,height:7,backgroundColor:colors.surfaceMuted,borderRadius:4,overflow:"hidden"}}>
            <View style={{backgroundColor:"#B7791F",height:"100%",
              width:`${summary.reviewCount?100*(summary.ratingCounts[rating-1]??0)/summary.reviewCount:0}%` as `${number}%`}}/>
          </View>
          <AppText variant="caption" muted>{summary.ratingCounts[rating-1]??0}</AppText>
        </View>)}
      </View>:null}
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {(["recent","highest","lowest"] as const).map(key=><Button key={key}
          style={{flex:1,minWidth:0}} variant={sort===key?"primary":"secondary"}
          label={tx("reviewSort."+key)} disabled={loading||moreBusy}
          onPress={()=>setSort(key)}/>)}
      </View>
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
      {summary?.hasMore?<Button label={tx("moreReviews")} variant="secondary"
        disabled={loading||moreBusy} loading={moreBusy} onPress={()=>void loadMore()}/>:null}
      <Button label={t("common.retry")} variant="secondary"
        disabled={loading||busy} onPress={()=>void reload()}/>
    </Card>
    {actor?<Card style={styles.stack}>
      <AppText variant="bodyLarge" weight="bold">{tr("writeReview")}</AppText>
      {!eligible.length?<AppText muted variant="caption">{tr("reviewEligibility")}</AppText>:<>
        <AppText muted variant="caption">{tr("pickBooking")}</AppText>
        <View style={styles.stack}>
          {eligible.slice(0,eligibleLimit).map(b=><Pressable key={b.id}
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
        {eligible.length>eligibleLimit?<Button label={tx("moreEligible")} variant="secondary"
          onPress={()=>setEligibleLimit(n=>n+10)}/>:null}
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
  const operation=useRef(0);
  const token=session?.accessToken;
  useEffect(()=>{
    const id=++operation.current;
    setSaved(null);setBusy(false);setError(null);setPreferred("18:00");
    if(!token)return()=>{operation.current+=1;};
    void bookingApi.savedVenueTime(token,venue.id)
      .then(result=>{
        if(id===operation.current){setSaved(result.preferredStart);
          if(result.preferredStart)setPreferred(result.preferredStart);}
      }).catch(()=>{if(id===operation.current)setError(tr("loadError"));});
    return()=>{operation.current+=1;};
  },[token,venue.id]);
  async function save(value:string|null){
    if(!token||busy)return;
    const id=operation.current;
    setBusy(true);setError(null);
    try{
      const result=await bookingApi.saveVenueTime(token,venue.id,value);
      if(id===operation.current)setSaved(result.preferredStart);
    }catch{if(id===operation.current)setError(tr("saveError"));}
    finally{if(id===operation.current)setBusy(false);}
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
