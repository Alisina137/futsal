type Listener=()=>void;
const listeners=new Set<Listener>();
/** Preferences screen asks the native bridge to update the device registration. */
export function onPushPreferenceChange(listener:Listener){
  listeners.add(listener);
  return ()=>{listeners.delete(listener);};
}
export function publishPushPreferenceChange(){
  for(const listener of listeners)listener();
}
