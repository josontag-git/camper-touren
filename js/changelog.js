// "Was ist neu"-Banner: Text wird manuell bei jedem nennenswerten Release
// aktualisiert (wie die README-Abschnitte). Banner erscheint wieder, sobald
// sich die id ändert, auch wenn ein früherer Stand schon weggeklickt wurde.

const STORAGE_DISMISSED = "campingAppChangelogDismissed";

export const LATEST_CHANGE = {
  id: "2026-07-18-milestone-7",
  text: "Neu: Header-Hintergrund wählbar, Inspire mit Details/Undo/Neustart, Zeitachse in Plan & Route.",
};

export function isChangelogDismissed() {
  return localStorage.getItem(STORAGE_DISMISSED) === LATEST_CHANGE.id;
}

export function dismissChangelog() {
  localStorage.setItem(STORAGE_DISMISSED, LATEST_CHANGE.id);
}
