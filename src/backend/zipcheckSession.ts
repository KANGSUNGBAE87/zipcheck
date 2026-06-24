const CORE_USER_ID_KEY = 'zipcheck:core-user-id:v1';

export const loadZipcheckCoreUserId = (): string | null => {
  try {
    return localStorage.getItem(CORE_USER_ID_KEY);
  } catch {
    return null;
  }
};

export const saveZipcheckCoreUserId = (coreUserId: string) => {
  try {
    localStorage.setItem(CORE_USER_ID_KEY, coreUserId);
  } catch {
    // Session persistence is best effort; Supabase remains the source of truth.
  }
};

export const clearZipcheckCoreUserId = () => {
  try {
    localStorage.removeItem(CORE_USER_ID_KEY);
  } catch {
    // Ignore storage failures in embedded WebView fallback modes.
  }
};
