export const BARK_ATLAS_SIZE: number;
export interface BarkIsland {x0:number;x1:number;y0:number;y1:number}
export const BARK_UV_ISLANDS: Readonly<{
  trunk: Readonly<BarkIsland>;
  bough: Readonly<BarkIsland>;
  twig: Readonly<BarkIsland>;
}>;
export type BarkIslandName = keyof typeof BARK_UV_ISLANDS;
export interface BarkTubeData {
  p: number[];
  uv: number[];
  colors: number[];
  idx: number[];
  barkIslands?: Array<{name:string;verts:number;rings:number;u:number[];v:number[];variation:number}>;
}
export function paintBarkUVAtlas(size?:number): Uint8Array;
export function addUnwrappedBarkTube(
  geometry: BarkTubeData,
  points: number[][],
  radii: number[],
  sides: number,
  islandName: BarkIslandName,
  variation?: number
): void;
