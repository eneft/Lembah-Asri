/** Gameplay coordinates stay in metres and retain the existing home layout.
 * The legacy world is an explicit development-only opt-in, never the default.
 * The playable boundary leaves room for the bridge, garden and both banks.
 */
export const HOME_AREA = Object.freeze({
  id: 'home',
  minX: -58, maxX: -12, minZ: -26, maxZ: 24,
  terrainX: -34, terrainZ: 0, terrainSize: 100,
  grassPadding: 8,
  playerRadius: .28,
});
export type SceneArea = 'home' | 'legacy';
export function resolveSceneArea(search: string): SceneArea {
  return new URLSearchParams(search).get('scene') === 'legacy' ? 'legacy' : 'home';
}
export function inHomeArea(x: number, z: number, padding = 0): boolean {
  return x >= HOME_AREA.minX - padding && x <= HOME_AREA.maxX + padding
    && z >= HOME_AREA.minZ - padding && z <= HOME_AREA.maxZ + padding;
}
export function constrainHomePosition(x: number, z: number) {
  const { minX, maxX, minZ, maxZ, playerRadius: r } = HOME_AREA;
  return { x: Math.max(minX + r, Math.min(maxX - r, x)),
    z: Math.max(minZ + r, Math.min(maxZ - r, z)) };
}
