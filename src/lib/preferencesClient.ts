import {
  type PreferencesResponse,
  type PreferencesScope,
  resolvePreferencesScope,
  normalizePreferencesUser,
} from "@/lib/preferencesContract";

interface PreferencesRequestOptions {
  scope?: PreferencesScope;
  user?: string;
  signal?: AbortSignal;
}

export async function fetchPreferences(options: PreferencesRequestOptions = {}): Promise<PreferencesResponse> {
  const scope = options.scope ?? getDefaultPreferencesScope();
  const user = normalizePreferencesUser(options.user ?? getDefaultPreferencesUser());
  const params = new URLSearchParams({
    scope,
    user,
  });

  const response = await fetch(`/api/preferences?${params.toString()}`, {
    method: "GET",
    signal: options.signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load preferences (status ${response.status})`);
  }

  return (await response.json()) as PreferencesResponse;
}

export async function updatePreferences(
  payload: { presets?: unknown; watchlistSymbols?: unknown },
  options: PreferencesRequestOptions = {}
): Promise<PreferencesResponse> {
  const scope = options.scope ?? getDefaultPreferencesScope();
  const user = normalizePreferencesUser(options.user ?? getDefaultPreferencesUser());
  const params = new URLSearchParams({
    scope,
    user,
  });

  const response = await fetch(`/api/preferences?${params.toString()}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: options.signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to save preferences (status ${response.status})`);
  }

  return (await response.json()) as PreferencesResponse;
}

export function getDefaultPreferencesScope(): PreferencesScope {
  const envScope = process.env.NEXT_PUBLIC_PREFERENCES_SCOPE;
  const inferred = process.env.NODE_ENV === "development" ? "dev" : "local";
  return resolvePreferencesScope(envScope, inferred);
}

export function getDefaultPreferencesUser(): string {
  return process.env.NEXT_PUBLIC_PREFERENCES_USER ?? "local";
}
