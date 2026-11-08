declare module 'virtual:natally-identity' {
  const identity: {
    /** Stamped MAJOR.MINOR.BUILD from version.json. */
    version: string;
    /** Short commit hash the running code was built/served from. */
    commit: string;
    /** True when served with uncommitted edits (dev only). */
    dirty: boolean;
    /** Badge text, e.g. "v1.20.765 · 5a2251f" or "… · 5a2251f+edits". */
    label: string;
  };
  export default identity;
}
