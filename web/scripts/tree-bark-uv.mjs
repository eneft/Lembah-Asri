/**
 * Lembah Asri — UV-unwrapped bark artwork.
 *
 * This is an ART atlas, not a repeating mathematical stripe texture.
 * Each of the three baked UV islands has its own painted pigment field,
 * interruptions, knots and sparse irregular hairline cracks. The trunk
 * is one continuous cylinder strip from the roots to the crown. Branches
 * and twigs have separate atlas islands, so there is no repetitive wood
 * grain at their joints.
 *
 * Browser-independent, deterministic, and uses no remote image/asset.
 */
export const BARK_ATLAS_SIZE = 1024;
export const BARK_UV_ISLANDS = Object.freeze({
  trunk: Object.freeze({x0:36,x1:501,y0:34,y1:988}),
  bough: Object.freeze({x0:544,x1:794,y0:34,y1:988}),
  twig:  Object.freeze({x0:835,x1:987,y0:34,y1:988})
});

const TAU=Math.PI*2;
const clamp=(x,a=0,b=255)=>Math.max(a,Math.min(b,x));
function smoothstep(a,b,x){
  const t=clamp((x-a)/(b-a),0,1);
  return t*t*(3-2*t);
}
function hash(x,y,seed){
  let s=(Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(seed,2246822519))|0;
  s=Math.imul(s^(s>>>13),1274126177);
  return ((s^(s>>>16))>>>0)/4294967295;
}
// A noise *painting wash* that connects at the left and right UV seam.
function tileNoise(u,v,period,vertical,seed){
  const x=u*period,y=v*vertical,ix=Math.floor(x),iy=Math.floor(y);
  const fx=x-ix,fy=y-iy;
  const ax=fx*fx*(3-2*fx),ay=fy*fy*(3-2*fy);
  const a=(ix%period+period)%period,b=(a+1)%period;
  const top=hash(a,iy,seed)*(1-ax)+hash(b,iy,seed)*ax;
  const bottom=hash(a,iy+1,seed)*(1-ax)+hash(b,iy+1,seed)*ax;
  return top*(1-ay)+bottom*ay;
}
function circleDistance(a,b){
  const d=Math.abs(a-b);
  return Math.min(d,1-d);
}
function paintAt(u,v,kind){
  const branch=kind!=='trunk';
  const lite=kind==='twig'?7:kind==='bough'?3:0;
  const large=tileNoise(u,v,5,9,67+lite);
  const mid=tileNoise(u,v,11,22,221+lite);
  const small=tileNoise(u,v,23,48,53+lite);
  const glaze=(large-.5)*29+(mid-.5)*17+(small-.5)*7;
  let fissure=0;
  const fissures=branch?4:7;
  for(let i=0;i<fissures;i++){
    const cx=((i+.37)/fissures
      +.022*Math.sin(v*(10+i*.8)+i*1.81)
      +.007*Math.sin(v*(34+i*.5)+i*.91)+1)%1;
    const dist=circleDistance(u,cx);
    const width=(branch?.005:.0038)+.002*mid;
    // Short, broken fissures — NOT uninterrupted stripes.
    const window=smoothstep(.08+(i%3)*.045,.20+(i%3)*.045,v)
      *(1-smoothstep(.70+(i%2)*.065,.83+(i%2)*.06,v));
    const interrupted=.30+.70*smoothstep(.33,.58,
      tileNoise(u,v,7,18,710+i));
    fissure+=Math.exp(-Math.pow(dist/width,2))*window*interrupted;
  }
  let knot=0,ring=0;
  const knots=branch?[[.43,.51,.10,.085]]:[[.27,.38,.083,.070],[.73,.70,.060,.051]];
  for(const [ku,kv,rx,ry] of knots){
    const du=circleDistance(u,ku)/rx,dv=(v-kv)/ry;
    const r=Math.hypot(du,dv);
    knot+=Math.exp(-r*r*5)*20;
    ring+=Math.exp(-Math.pow((r-1.05)/.22,2))*7;
  }
  const low=1-smoothstep(.04,.29,v);
  const moss=Math.max(0,large-.56)*low*24;
  const base=branch?[148,111,81]:[144,108,79];
  const light=7*(.5-u)+5*(v-.4)+glaze+ring-fissure*19-knot;
  const r=clamp(base[0]+light-moss*.56);
  const g=clamp(base[1]+light*.85+moss*.63);
  const b=clamp(base[2]+light*.73+moss*.28);
  return [Math.round(r),Math.round(g),Math.round(b)];
}
export function paintBarkUVAtlas(size=BARK_ATLAS_SIZE){
  if(size!==BARK_ATLAS_SIZE)throw new Error('Bark layout must stay 1024px for its authored UV islands');
  const output=new Uint8Array(size*size*4);
  // Neutral backing and generous bleed/gutters are deliberate.
  for(let i=0;i<output.length;i+=4){
    output[i]=145;output[i+1]=110;output[i+2]=83;output[i+3]=255;
  }
  for(const [kind,island] of Object.entries(BARK_UV_ISLANDS)){
    const w=island.x1-island.x0,h=island.y1-island.y0;
    for(let y=island.y0;y<=island.y1;y++){
      for(let x=island.x0;x<=island.x1;x++){
        const u=(x-island.x0)/w,v=(y-island.y0)/h;
        const [r,g,b]=paintAt(u,v,kind);
        const off=(y*size+x)*4;
        output[off]=r;output[off+1]=g;output[off+2]=b;
      }
    }
  }
  return output;
}
function vecSub(a,b){return a.map((v,i)=>v-b[i]);}
function vecAdd(a,b){return a.map((v,i)=>v+b[i]);}
function vecMul(a,s){return a.map(v=>v*s);}
function dot(a,b){return a.reduce((sum,v,i)=>sum+v*b[i],0);}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function norm(v){const size=Math.sqrt(dot(v,v));return vecMul(v,1/Math.max(size,1e-8));}

/**
 * UV unwrap every connected tube as ONE strip. The V coordinate is continuous
 * through all of its rings: no 0→1 resets on adjacent trunk segments.
 * Branches reuse a separate painted island, not the trunk strip.
 *
 * The mesh remains true 3D and keeps the approved branch positions and radii.
 */
export function addUnwrappedBarkTube(geometry,points,radii,sides,islandName,variation=0){
  if(points.length<2||radii.length!==points.length)throw new Error('Invalid bark tube rings');
  if(sides<4)throw new Error('Bark tube requires at least four sides');
  const art=BARK_UV_ISLANDS[islandName];
  if(!art)throw new Error('Unknown bark UV island '+islandName);
  const len=[0];
  for(let i=1;i<points.length;i++){
    const d=vecSub(points[i],points[i-1]);
    len.push(len[i-1]+Math.sqrt(dot(d,d)));
  }
  const total=len[len.length-1];
  if(total<.01)throw new Error('Degenerate bark tube');
  const phase=(variation%4)*.022;
  const u0=(art.x0+.5)/BARK_ATLAS_SIZE;
  const u1=(art.x1-.5)/BARK_ATLAS_SIZE;
  const v0=(art.y0+.5)/BARK_ATLAS_SIZE+phase;
  const v1=(art.y1-.5)/BARK_ATLAS_SIZE-phase;
  const originalCount=geometry.p.length/3;
  const tangent0=norm(vecSub(points[1],points[0]));
  const ref=Math.abs(dot(tangent0,[1,0,0]))<.83?[1,0,0]:[0,0,1];
  for(let ring=0;ring<points.length;ring++){
    const prev=points[Math.max(0,ring-1)],next=points[Math.min(points.length-1,ring+1)];
    const tangent=norm(vecSub(next,prev));
    const across=norm(vecSub(ref,vecMul(tangent,dot(ref,tangent))));
    const side=norm(cross(tangent,across));
    const v=v0+(v1-v0)*len[ring]/total;
    for(let j=0;j<=sides;j++){
      const angle=TAU*j/sides;
      const offset=vecAdd(vecMul(across,radii[ring]*Math.cos(angle)),
        vecMul(side,radii[ring]*Math.sin(angle)));
      const vertex=vecAdd(points[ring],offset);
      geometry.p.push(...vertex);
      geometry.uv.push(u0+(u1-u0)*j/sides,v);
      const rootDark=1-.11*(1-smoothstep(0,.57,vertex[1]));
      geometry.colors.push(rootDark,rootDark*.996,rootDark*.991);
    }
  }
  for(let ring=0;ring<points.length-1;ring++){
    for(let j=0;j<sides;j++){
      const a=originalCount+ring*(sides+1)+j,b=a+sides+1;
      geometry.idx.push(a,a+1,b,a+1,b+1,b);
    }
  }
  geometry.barkIslands=geometry.barkIslands||[];
  geometry.barkIslands.push({name:islandName,verts:(sides+1)*points.length,
    rings:points.length,u:[u0,u1],v:[v0,v1],variation});
}
