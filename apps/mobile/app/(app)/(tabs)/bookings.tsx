import { colors, spacing } from "@leaguekick/design-tokens";
import type { BookingDto } from "@leaguekick/contracts";
import { useCallback, useEffect, useState } from "react";
import { bookingApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function MyBookingsScreen(){
  const {session}=useAuth(); const {t}=useLocale();
  const [items,setItems]=useState<BookingDto[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{if(!session)return;setLoading(true);setError(null);try{setItems((await bookingApi.mine(session.accessToken)).bookings);}catch{setError(t("booking.loadBookingsError"));}finally{setLoading(false);}},[session,t]);
  useEffect(()=>{void load();},[load]);

  async function cancel(id:string){if(!session)return;try{await bookingApi.cancel(session.accessToken,id);await load();}catch{setError(t("booking.cancelError"));}}

  if(loading)return <Screen showHeader><DataLoadingState variant="list" minHeight={460}/></Screen>;

  return <Screen showHeader>
    <AppText variant="title" weight="bold">{t("booking.myBookings")}</AppText>
    <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="secondary"/>
    {error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}
    {!loading&&items.length===0?<Card><AppText>{t("booking.noBookings")}</AppText></Card>:null}
    {items.map((item)=><Card key={item.id}>
      <AppText variant="bodyLarge" weight="bold">{item.venueName}</AppText>
      <AppText forceLtr>{item.startsAt}</AppText>
      <AppText weight="semibold">{item.priceAfn} AFN · {t(`booking.status.${item.status}` as never)}</AppText>
      {item.status!=="CANCELLED"&&Date.parse(item.startsAt)>Date.now()?<Button label={t("booking.cancel")} onPress={()=>void cancel(item.id)} variant="secondary"/>:null}
    </Card>)}
  </Screen>;
}
