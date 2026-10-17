// Serialized with the exact shared core by build.mjs, never copied into the core.
export function dispatchAutoLoad(core, expectedURL, defaultLayoutVisible) {
  if (location.href !== expectedURL || document.readyState !== "complete") return {state: "skipped"};
  const status = core("status");
  if (status.state !== "absent") return status;
  return core("load", {layoutVisible: defaultLayoutVisible});
}
