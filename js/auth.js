// Google-Login via Google Identity Services (GIS) – OAuth 2.0 Token Client.
// Liefert einen Access-Token mit Scopes für Sheets-Zugriff + Basis-Profil.
// Kein ID-Token/Server-Verifizierung nötig, da rein client-seitige App ohne Backend.

import { CONFIG } from "./config.js";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;
let currentUser = null;

const listeners = new Set();

function notify() {
  listeners.forEach((cb) => cb({ user: currentUser, isSignedIn: !!accessToken }));
}

export function onAuthChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function ensureTokenClient() {
  if (tokenClient) return tokenClient;

  if (!window.google?.accounts?.oauth2) {
    throw new Error(
      "Google Identity Services SDK nicht geladen (Skript-Tag in index.html prüfen)."
    );
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_OAUTH_CLIENT_ID,
    scope: SCOPES,
    callback: () => {}, // wird pro Aufruf in login() überschrieben
  });
  return tokenClient;
}

async function fetchUserInfo(token) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Konnte Google-Profil nicht laden.");
  return res.json();
}

export function login() {
  return new Promise((resolve, reject) => {
    const client = ensureTokenClient();

    client.callback = async (response) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      accessToken = response.access_token;
      tokenExpiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000;
      try {
        currentUser = await fetchUserInfo(accessToken);
      } catch (err) {
        currentUser = null;
      }
      notify();
      resolve({ accessToken, user: currentUser });
    };

    client.requestAccessToken({ prompt: accessToken ? "" : "consent" });
  });
}

export function logout() {
  if (accessToken && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  tokenExpiresAt = 0;
  currentUser = null;
  notify();
}

export function isSignedIn() {
  return !!accessToken && Date.now() < tokenExpiresAt;
}

export function getUser() {
  return currentUser;
}

// Liefert einen gültigen Access-Token, holt bei Bedarf (Ablauf) automatisch
// einen neuen ohne erneuten Consent-Dialog ("prompt: ''", silent refresh).
export async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt - 30_000) {
    return accessToken;
  }
  const client = ensureTokenClient();
  return new Promise((resolve, reject) => {
    client.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      accessToken = response.access_token;
      tokenExpiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000;
      notify();
      resolve(accessToken);
    };
    client.requestAccessToken({ prompt: "" });
  });
}
