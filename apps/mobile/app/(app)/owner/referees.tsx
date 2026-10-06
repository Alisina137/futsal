import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, spacing } from "@leaguekick/design-tokens";
import type { VenueRefereeDto } from "@leaguekick/contracts";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { ApiRequestError, ownerApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function VenueRefereesScreen() {
  const { session } = useAuth();
  const { t, isRTL } = useLocale();
  const [referees, setReferees] = useState<VenueRefereeDto[]>([]);
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setMessage(null);
    try {
      setReferees((await ownerApi.referees(session.accessToken)).referees);
    } catch {
      setMessage(t("roles.refereeLoadError"));
    } finally {
      setLoading(false);
    }
  }, [session, t]);

  useEffect(() => { void load(); }, [load]);

  async function grant() {
    if (!session || identifier.trim().length < 3) return;
    setBusy("grant");
    setMessage(null);
    try {
      const result = await ownerApi.grantReferee(session.accessToken, { identifier: identifier.trim() });
      setReferees(result.referees);
      setIdentifier("");
      setMessage(t("roles.refereeGranted"));
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : t("roles.refereeLoadError"));
    } finally {
      setBusy(null);
    }
  }

  async function remove(userId: string) {
    if (!session) return;
    setBusy(userId);
    setMessage(null);
    try {
      setReferees((await ownerApi.removeReferee(session.accessToken, userId)).referees);
      setMessage(t("roles.refereeRemoved"));
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : t("roles.refereeLoadError"));
    } finally {
      setBusy(null);
    }
  }

  return <Screen showHeader>
    <View style={{ gap: spacing.xs }}>
      <AppText variant="title" weight="bold">{t("roles.venueRefereesTitle")}</AppText>
      <AppText muted>{t("roles.venueRefereesBody")}</AppText>
    </View>

    <Card>
      <AppText weight="semibold">{t("roles.grantReferee")}</AppText>
      <TextField
        label={t("roles.refereeIdentifier")}
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        forceLtr
      />
      <Button
        label={t("roles.grantReferee")}
        onPress={() => void grant()}
        loading={busy === "grant"}
        disabled={identifier.trim().length < 3}
      />
    </Card>

    {message ? <Card><AppText accessibilityRole="alert">{message}</AppText></Card> : null}
    {loading?<DataLoadingState variant="list"/>:null}

    {!loading && referees.length === 0 ? <Card>
      <AppText muted>{t("roles.noReferees")}</AppText>
    </Card> : null}

    {referees.map((referee) => <Card key={referee.userId}>
      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft }}>
          <Ionicons name="flag-outline" size={20} color={colors.primary}/>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText weight="bold">{referee.displayName}</AppText>
          {referee.username ? <AppText variant="caption" muted forceLtr>@{referee.username}</AppText> : null}
          <AppText variant="caption" muted forceLtr>{referee.phone}</AppText>
        </View>
        <Button
          label={t("roles.removeReferee")}
          onPress={() => void remove(referee.userId)}
          loading={busy === referee.userId}
          variant="danger"
        />
      </View>
    </Card>)}
  </Screen>;
}
