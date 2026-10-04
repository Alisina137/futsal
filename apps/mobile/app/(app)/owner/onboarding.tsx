import { colors, radius, spacing, touchTarget } from "@leaguekick/design-tokens";
import type { OwnerOnboardingStatus, OwnerVenueSetupRequest, VenueOpeningHourInput } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { ApiRequestError, ownerApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

const defaultHours: VenueOpeningHourInput[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  isClosed: false,
  opensAt: "08:00",
  closesAt: "22:00",
}));

export default function OwnerOnboardingScreen() {
  const { session } = useAuth();
  const { t, isRTL } = useLocale();
  const token = session?.accessToken;
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<OwnerOnboardingStatus | null>(null);
  const [name, setName] = useState("");
  const [publicPhone, setPublicPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [areaName, setAreaName] = useState("");
  const [duration, setDuration] = useState("90");
  const [price, setPrice] = useState("");
  const [hours, setHours] = useState<VenueOpeningHourInput[]>(defaultHours);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback((next: OwnerOnboardingStatus) => {
    setStatus(next);
    if (!next.venue) return;
    setName(next.venue.name);
    setPublicPhone(next.venue.publicPhone);
    setWhatsappPhone(next.venue.whatsappPhone ?? "");
    setProvince(next.venue.province);
    setCity(next.venue.city);
    setAddress(next.venue.address);
    const firstArea = next.venue.areas[0];
    if (firstArea) {
      setAreaName(firstArea.name);
      setDuration(String(firstArea.defaultSessionDurationMinutes));
      setPrice(String(firstArea.basePriceAfn));
    }
    if (next.venue.openingHours.length === 7) setHours(next.venue.openingHours);
    if (next.subscription.state !== "NOT_STARTED") setStep(7);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      hydrate(await ownerApi.getStatus(token));
    } catch {
      setError(t("owner.loadError"));
    } finally {
      setLoading(false);
    }
  }, [hydrate, t, token]);

  useEffect(() => { void load(); }, [load]);

  const setup = useMemo<OwnerVenueSetupRequest>(() => ({
    venue: {
      name: name.trim(),
      publicPhone: publicPhone.trim(),
      whatsappPhone: whatsappPhone.trim(),
      province: province.trim(),
      city: city.trim(),
      address: address.trim(),
      latitude: null,
      longitude: null,
    },
    areas: [{
      name: areaName.trim(),
      defaultSessionDurationMinutes: Number(duration),
      basePriceAfn: Number(price),
    }],
    openingHours: hours,
  }), [address, areaName, city, duration, hours, name, price, province, publicPhone, whatsappPhone]);

  function validateCurrentStep() {
    if (step === 1 && (name.trim().length < 2 || publicPhone.trim().length < 9)) return t("owner.validationIdentity");
    if (step === 2 && (province.trim().length < 2 || city.trim().length < 2 || address.trim().length < 5)) return t("owner.validationLocation");
    if (step === 3 && !areaName.trim()) return t("owner.validationArea");
    if (step === 4 && hours.some((hour) => !hour.isClosed && (!hour.opensAt || !hour.closesAt || hour.opensAt >= hour.closesAt))) return t("owner.validationHours");
    if (step === 5 && (!Number.isFinite(Number(duration)) || Number(duration) < 30 || !Number.isFinite(Number(price)) || Number(price) < 0)) return t("owner.validationPricing");
    return null;
  }

  function next() {
    const validation = validateCurrentStep();
    if (validation) { setError(validation); return; }
    setError(null);
    setStep((value) => Math.min(7, value + 1));
  }

  function back() {
    setError(null);
    setStep((value) => Math.max(0, value - 1));
  }

  function updateHour(dayOfWeek: number, patch: Partial<VenueOpeningHourInput>) {
    setHours((current) => current.map((item) => item.dayOfWeek === dayOfWeek ? { ...item, ...patch } : item));
  }

  async function saveSetup() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await ownerApi.saveSetup(token, setup);
      hydrate(saved);
      setStep(7);
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.code === "INVALID_VENUE_PHONE") setError(t("owner.validationPhone"));
      else if (cause instanceof ApiRequestError && cause.code === "VENUE_IDENTITY_LOCKED") setError(t("owner.identityLocked"));
      else if (cause instanceof ApiRequestError && cause.isNetworkError) setError(t("owner.networkError"));
      else setError(t("owner.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function startTrial() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      hydrate(await ownerApi.startTrial(token));
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.code === "TRIAL_ALREADY_USED") setError(t("owner.trialAlreadyUsed"));
      else if (cause instanceof ApiRequestError && cause.code === "SETUP_INCOMPLETE") setError(t("owner.setupIncomplete"));
      else if (cause instanceof ApiRequestError && cause.isNetworkError) setError(t("owner.networkError"));
      else setError(t("owner.trialError"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Screen><AppText>{t("common.loading")}</AppText></Screen>;

  return <Screen>
    <View style={{ gap: spacing.xs }}>
      <AppText variant="title" weight="bold">{t("owner.onboardingTitle")}</AppText>
      <AppText muted>{t("owner.stepOf", { current: step + 1, total: 8 })}</AppText>
    </View>

    <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: spacing.xs }}>
      {Array.from({ length: 8 }, (_, index) => <View key={index} style={{ flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: index <= step ? colors.primary : colors.border }} />)}
    </View>

    {step === 0 ? <Card>
      <AppText variant="bodyLarge" weight="bold">{t("owner.stepAccountTitle")}</AppText>
      <AppText>{t("owner.stepAccountBody")}</AppText>
      <AppText weight="semibold">{session?.user.displayName ?? ""}</AppText>
      <AppText forceLtr>{session?.user.phone ?? ""}</AppText>
    </Card> : null}

    {step === 1 ? <Card>
      <AppText variant="bodyLarge" weight="bold">{t("owner.stepIdentityTitle")}</AppText>
      <TextField label={t("owner.venueName")} value={name} onChangeText={setName} />
      <TextField label={t("owner.publicPhone")} value={publicPhone} onChangeText={setPublicPhone} keyboardType="phone-pad" forceLtr />
      <TextField label={t("owner.whatsappPhone")} value={whatsappPhone} onChangeText={setWhatsappPhone} keyboardType="phone-pad" forceLtr />
    </Card> : null}

    {step === 2 ? <Card>
      <AppText variant="bodyLarge" weight="bold">{t("owner.stepLocationTitle")}</AppText>
      <TextField label={t("owner.province")} value={province} onChangeText={setProvince} />
      <TextField label={t("owner.city")} value={city} onChangeText={setCity} />
      <TextField label={t("owner.address")} value={address} onChangeText={setAddress} multiline />
      <AppText variant="caption" muted>{t("owner.mapPinLater")}</AppText>
    </Card> : null}

    {step === 3 ? <Card>
      <AppText variant="bodyLarge" weight="bold">{t("owner.stepAreaTitle")}</AppText>
      <AppText>{t("owner.stepAreaBody")}</AppText>
      <TextField label={t("owner.areaName")} value={areaName} onChangeText={setAreaName} />
    </Card> : null}

    {step === 4 ? <Card>
      <AppText variant="bodyLarge" weight="bold">{t("owner.stepHoursTitle")}</AppText>
      <AppText>{t("owner.stepHoursBody")}</AppText>
      {hours.map((hour) => <View key={hour.dayOfWeek} style={{ gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: hour.dayOfWeek === 6 ? 0 : 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md }}>
          <AppText weight="semibold">{t(`owner.day.${hour.dayOfWeek}` as never)}</AppText>
          <Pressable onPress={() => updateHour(hour.dayOfWeek, {
            isClosed: !hour.isClosed,
            opensAt: hour.isClosed ? "08:00" : null,
            closesAt: hour.isClosed ? "22:00" : null,
          })} style={{ minHeight: touchTarget, paddingHorizontal: spacing.md, justifyContent: "center", borderRadius: radius.md, backgroundColor: hour.isClosed ? colors.surfaceMuted : colors.primarySoft }}>
            <AppText weight="semibold" style={{ color: hour.isClosed ? colors.textMuted : colors.primary }}>{hour.isClosed ? t("owner.closed") : t("owner.open")}</AppText>
          </Pressable>
        </View>
        {!hour.isClosed ? <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: spacing.sm }}>
          <TextField label={t("owner.opensAt")} value={hour.opensAt ?? ""} onChangeText={(value) => updateHour(hour.dayOfWeek, { opensAt: value })} forceLtr containerStyle={{ flex: 1 }} />
          <TextField label={t("owner.closesAt")} value={hour.closesAt ?? ""} onChangeText={(value) => updateHour(hour.dayOfWeek, { closesAt: value })} forceLtr containerStyle={{ flex: 1 }} />
        </View> : null}
      </View>)}
    </Card> : null}

    {step === 5 ? <Card>
      <AppText variant="bodyLarge" weight="bold">{t("owner.stepPricingTitle")}</AppText>
      <TextField label={t("owner.durationMinutes")} value={duration} onChangeText={setDuration} keyboardType="number-pad" forceLtr />
      <TextField label={t("owner.basePriceAfn")} value={price} onChangeText={setPrice} keyboardType="number-pad" forceLtr />
    </Card> : null}

    {step === 6 ? <Card>
      <AppText variant="bodyLarge" weight="bold">{t("owner.stepPreviewTitle")}</AppText>
      <PreviewRow label={t("owner.venueName")} value={name} rtl={isRTL} />
      <PreviewRow label={t("owner.location")} value={`${address}, ${city}, ${province}`} rtl={isRTL} />
      <PreviewRow label={t("owner.areaName")} value={areaName} rtl={isRTL} />
      <PreviewRow label={t("owner.durationMinutes")} value={duration} rtl={isRTL} ltr />
      <PreviewRow label={t("owner.basePriceAfn")} value={`${price} AFN`} rtl={isRTL} ltr />
      <AppText variant="caption" muted>{t("owner.previewBody")}</AppText>
      <Button label={t("owner.saveSetup")} onPress={() => void saveSetup()} loading={busy} />
    </Card> : null}

    {step === 7 ? <Card>
      <AppText variant="bodyLarge" weight="bold">{t("owner.stepTrialTitle")}</AppText>
      {status?.subscription.state === "NOT_STARTED" ? <>
        <AppText>{t("owner.stepTrialBody")}</AppText>
        <AppText weight="semibold">{t("owner.trialDuration")}</AppText>
        <Button label={t("owner.startTrial")} onPress={() => void startTrial()} loading={busy} disabled={!status?.setupComplete} />
      </> : <>
        <AppText weight="semibold" style={{ color: status?.subscription.state === "TRIAL" ? colors.success : colors.warning }}>
          {t(`owner.subscription.${status?.subscription.state ?? "NOT_STARTED"}` as never)}
        </AppText>
        {status?.subscription.trialEndsAt ? <AppText forceLtr>{status.subscription.trialEndsAt}</AppText> : null}
        <Button label={t("owner.goDashboard")} onPress={() => router.replace("/home")} />
      </>}
    </Card> : null}

    {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}

    {step < 6 ? <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: spacing.sm }}>
      {step > 0 ? <Button label={t("owner.back")} onPress={back} variant="secondary" style={{ flex: 1 }} /> : null}
      <Button label={t("owner.continue")} onPress={next} style={{ flex: 1 }} />
    </View> : null}
    {step === 6 ? <Button label={t("owner.back")} onPress={back} variant="secondary" /> : null}
  </Screen>;
}

function PreviewRow({ label, value, rtl, ltr = false }: { label: string; value: string; rtl: boolean; ltr?: boolean }) {
  return <View style={{ flexDirection: rtl ? "row-reverse" : "row", justifyContent: "space-between", gap: spacing.md }}>
    <AppText muted>{label}</AppText>
    <AppText weight="semibold" forceLtr={ltr} style={{ flexShrink: 1 }}>{value}</AppText>
  </View>;
}
