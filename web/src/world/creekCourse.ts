import { MathUtils } from 'three';

export const CREEK=Object.freeze({
  start:-79.5,end:79.5,sourceZ:-79.5,mouthZ:79.5,flowSign:1,
  bridgeMin:7.25,bridgeMax:9.95,waterY:-.20,bedY:-.65,bankWidth:.79
});

export function creekOuterMeander(z:number):number {
  const upstream=1-MathUtils.smoothstep(z,-28,-12);
  const downstream=MathUtils.smoothstep(z,27,43);
  return Math.max(upstream,downstream)*(1.25*Math.sin(z*.085+.63)+.4*Math.sin(z*.19-.4));
}

// Two shallow pools bite into the open west field. Their east edges stay at
// the surveyed fence line; the bridge deck and both landings keep their span.
const pools=[{z:-5.5,radius:5.4,inset:.93},{z:18,radius:4.4,inset:.80}] as const;

export function westPoolInset(z:number):number {
  const crossing=MathUtils.smoothstep(Math.abs(z-8.6),2.0,4.8);
  return crossing*pools.reduce((sum,p)=>sum+p.inset*Math.exp(-(((z-p.z)/p.radius)**2)),0);
}

export function creekCenterX(z:number):number {
  return -45.5+.12*Math.sin(z*.37+.2)+.09*Math.sin(z*.82-.7)+creekOuterMeander(z)-westPoolInset(z);
}

export function creekWidth(z:number):number {
  return 2.64+.010*(z+4.5)+.13*Math.sin(z*.29+.8)+.07*Math.cos(z*.69-.3)+2*westPoolInset(z);
}

const [up,down]=pools;
// The ground, its shadow receiver and all four shore materials sample the
// same footprint that positions the geometry, including the west-only pools.
export const creekCourseGLSL=`
#ifndef LEMBAH_CREEK_COURSE
#define LEMBAH_CREEK_COURSE
vec2 creekCourse(float zC) {
  float envelope=max(1.0-smoothstep(-28.0,-12.0,zC),smoothstep(27.0,43.0,zC));
  float farBend=envelope*(1.25*sin(zC*.085+.63)+.4*sin(zC*.19-.4));
  vec2 t=(vec2(zC)-vec2(${up.z.toFixed(1)},${down.z.toFixed(1)}))/vec2(${up.radius},${down.radius});
  float inset=smoothstep(2.,4.8,abs(zC-8.6))*dot(vec2(${up.inset},${down.inset}),exp(-t*t));
  float xC=-45.5+.12*sin(zC*.37+.2)+.09*sin(zC*.82-.7)+farBend-inset;
  float halfC=.5*(2.64+.010*(zC+4.5)+.13*sin(zC*.29+.8)+.07*cos(zC*.69-.3))+inset;
  return vec2(xC,halfC);
}
#endif
`;
