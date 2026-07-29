export type QualityOverlayState = {
  meshVersion: number;
  show: boolean;
  autoEnabled: boolean;
};

export function defaultQualityOverlayState(
  meshVersion: number,
): QualityOverlayState {
  return { meshVersion, show: false, autoEnabled: false };
}

export function resolveQualityOverlayState(
  state: QualityOverlayState,
  meshLoadVersion: number,
): QualityOverlayState {
  return state.meshVersion === meshLoadVersion
    ? state
    : defaultQualityOverlayState(meshLoadVersion);
}

/** True when a stored flatten snapshot matches the current session fingerprint. */
export function isFlattenSnapshotCurrent(
  storedKey: string | null | undefined,
  currentKey: string,
): boolean {
  return storedKey != null && storedKey === currentKey;
}
