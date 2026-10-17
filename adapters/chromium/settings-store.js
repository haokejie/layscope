import {readSettings, settingsKey} from "./rules.js";

// Called only inside the background queue: validation finishes before any write.
export async function loadSettings(api) {
  const stored = (await api.storage.local.get(settingsKey))[settingsKey];
  return readSettings(stored);
}
