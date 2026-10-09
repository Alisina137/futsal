type Listener=(accessToken:string,unreadCount:number)=>void;
const listeners=new Set<Listener>();
/** Keep the fixed top-nav badge in sync with inbox changes, without polling. */
export function onNotificationUnreadChange(listener:Listener){
  listeners.add(listener);
  return ()=>{listeners.delete(listener);};
}
export function publishNotificationUnread(accessToken:string,unreadCount:number){
  for(const listener of listeners)listener(accessToken,Math.max(0,unreadCount));
}
