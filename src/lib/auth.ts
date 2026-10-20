export const DEMO_EMAIL = "demo@nudge.ai";
export const DEMO_PASSWORD = "nudge123";
export const AUTH_STORAGE_KEY = "nudge-demo-authenticated";

export function isDemoAuthenticated() {
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
}

export function signInDemo() {
  window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
}

export function signOutDemo() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
