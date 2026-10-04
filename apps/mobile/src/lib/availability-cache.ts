import AsyncStorage from "@react-native-async-storage/async-storage";
import type { VenueAvailabilityResponse } from "@leaguekick/contracts";

const PREFIX = "leaguekick.availability.v1";

function key(venueId: string, date: string) {
  return `${PREFIX}:${venueId}:${date}`;
}

export async function writeAvailabilityCache(value: VenueAvailabilityResponse) {
  await AsyncStorage.setItem(key(value.venue.id, value.date), JSON.stringify({ value, cachedAt: new Date().toISOString() }));
}

export async function readAvailabilityCache(venueId: string, date: string): Promise<{ value: VenueAvailabilityResponse; cachedAt: string } | null> {
  const raw = await AsyncStorage.getItem(key(venueId, date));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { value?: VenueAvailabilityResponse; cachedAt?: string };
    return parsed.value && parsed.cachedAt ? { value: parsed.value, cachedAt: parsed.cachedAt } : null;
  } catch {
    return null;
  }
}
