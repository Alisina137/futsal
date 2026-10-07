import { colors } from "@leaguekick/design-tokens";
import type { OwnerOnboardingStatus } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ownerApi, ApiRequestError } from "../../lib/api";
import { useAuth } from "../../providers/AuthProvider";
import { useLocale } from "../../providers/LocaleProvider";
import { OwnerTopNav } from "./OwnerTopNav";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DataLoadingState } from "../ui/DataLoadingState";
import { Screen } from "../ui/Screen";

export function OwnerDashboard() {
  const { session } = useAuth();
  const { t } = useLocale();
  const token = session?.accessToken;
  const [status, setStatus] = useState<OwnerOnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setStatus(await ownerApi.getStatus(token));
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.isNetworkError) setError(t("owner.networkError"));
      else setError(t("owner.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <Screen showHeader>
      <OwnerTopNav/>
      <DataLoadingState variant="dashboard" minHeight={520}/>
    </Screen>;
  }

  return <Screen showHeader>
    <OwnerTopNav/>

    {error ? <Card>
      <AppText style={{ color: colors.danger }}>{error}</AppText>
      <Button label={t("common.retry")} onPress={() => void load()} variant="secondary" />
    </Card> : null}

    {!status?.venue ? <Card>
      <AppText weight="semibold" style={{ color: colors.primary }}>{t("owner.setupRequiredTitle")}</AppText>
      <AppText>{t("owner.setupRequiredBody")}</AppText>
      <Button label={t("owner.startSetup")} onPress={() => router.push("/owner/onboarding")} />
    </Card> : null}

    {status?.subscription.state === "EXPIRED" ? <Card style={{ backgroundColor: colors.surfaceMuted }}>
      <AppText weight="semibold" style={{ color: colors.warning }}>{t("owner.trialExpiredTitle")}</AppText>
      <AppText>{t("owner.trialExpiredBody")}</AppText>
    </Card> : null}
  </Screen>;
}
