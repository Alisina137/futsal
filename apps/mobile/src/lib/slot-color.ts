/** Soften both halves of a timetable tile by exactly 15% toward white.
 * Return opaque hex instead of element opacity so status labels stay readable
 * and overlays do not bleed through neighboring slot cards. */
export const SLOT_BACKGROUND_SOFTENING=0.15;

export function softenSlotColor(hex:string):string{
  if(!/^#[0-9a-fA-F]{6}$/.test(hex))return hex;
  const channels=[1,3,5].map(index=>{
    const original=parseInt(hex.slice(index,index+2),16);
    return Math.round(original+(255-original)*SLOT_BACKGROUND_SOFTENING)
      .toString(16).padStart(2,"0");
  });
  return "#"+channels.join("").toUpperCase();
}
