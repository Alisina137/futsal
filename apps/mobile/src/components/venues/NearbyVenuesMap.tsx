import type { NearbyVenueDto } from "@leaguekick/contracts";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { resolveMediaImageUrl } from "../../lib/api";

type Point={latitude:number;longitude:number};
type Props={
  position:Point;
  venues:NearbyVenueDto[];
  onSelect:(id:string)=>void;
  onFailed:()=>void;
  onReady:()=>void;
};

function createNearbyMapHtml(position:Point,venues:NearbyVenueDto[]):string{
  // Only serializable, bounded location data is passed to the embedded map.
  // Escape HTML-breaking characters so venue names never become executable script.
  const payload=JSON.stringify({
    position,
    venues:venues.slice(0,10).map(v=>({
      id:v.id,name:v.name,latitude:v.latitude,longitude:v.longitude,
      imageUrl:resolveMediaImageUrl(v.imageUrl),
    })),
  }).replace(/</g,"\\u003c").replace(/>/g,"\\u003e").replace(/&/g,"\\u0026");

  return '<!doctype html><html lang="en"><head>'+
    '<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>'+
    '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>'+
    '<style>'+
    'html,body,#map{height:100%;width:100%;padding:0;margin:0;background:#e8eef6}'+
    '#map{position:absolute;inset:0}.leaflet-container{font-family:system-ui,Arial,sans-serif}'+
    '.leaflet-control-attribution{font-size:10px!important}'+
    '.venue-pin{background:none;border:0}'+
    '.venue-bubble{width:110px;min-height:56px;box-sizing:border-box;background:white;border:2px solid #145BD5;box-shadow:0 3px 9px rgba(20,35,64,.18);border-radius:12px;padding:4px;display:flex;align-items:center;gap:5px}'+
    '.venue-bubble img,.venue-fallback{flex:0 0 34px;width:34px;height:34px;object-fit:cover;border-radius:7px;background:#E5EEFF;display:flex;align-items:center;justify-content:center}'+
    '.venue-label{font-size:11px;line-height:13px;font-weight:700;color:#14233c;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}'+
    '.venue-bubble:after{content:"";position:absolute;left:49px;bottom:-9px;border-left:8px solid transparent;border-right:8px solid transparent;border-top:9px solid #145BD5}'+
    '</style></head><body><div id="map" role="application" aria-label="Nearby futsal venue map"></div>'+
    '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>'+
    '<script>(function(){'+
    'var model='+payload+';'+
    'function send(type,id){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:type,id:id||null}));}'+
    'if(!window.L){send("error");return;}'+
    'try{'+
    'var origin=[model.position.latitude,model.position.longitude];'+
    'var map=L.map("map",{zoomControl:true,attributionControl:true}).setView(origin,12);'+
    'var layer=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);'+
    'var loaded=false;layer.on("tileload",function(){if(!loaded){loaded=true;send("ready");}});'+
    'setTimeout(function(){if(!loaded)send("error");},12000);'+
    'var me=L.circleMarker(origin,{radius:9,fillColor:"#145BD5",color:"white",weight:3,fillOpacity:1}).addTo(map);'+
    'var features=[me];'+
    'model.venues.forEach(function(venue){'+
    'var bubble=document.createElement("div");bubble.className="venue-bubble";'+
    'if(venue.imageUrl){var photo=document.createElement("img");photo.src=venue.imageUrl;photo.alt="";bubble.appendChild(photo);}'+
    'else{var fallback=document.createElement("div");fallback.className="venue-fallback";fallback.textContent="⚽";bubble.appendChild(fallback);}'+
    'var label=document.createElement("span");label.className="venue-label";label.textContent=venue.name;bubble.appendChild(label);'+
    'var marker=L.marker([venue.latitude,venue.longitude],{icon:L.divIcon({html:bubble.outerHTML,className:"venue-pin",iconSize:[110,64],iconAnchor:[55,64]})}).addTo(map);'+
    'marker.on("click",function(){send("select",venue.id);});features.push(marker);'+
    '});'+
    'if(features.length>1)map.fitBounds(L.featureGroup(features).getBounds().pad(.25),{maxZoom:14});'+
    'setTimeout(function(){map.invalidateSize();},300);'+
    '}catch(error){send("error");}'+
    '})();</script></body></html>';
}

export function NearbyVenuesMap({position,venues,onSelect,onFailed,onReady}:Props){
  const html=useMemo(()=>createNearbyMapHtml(position,venues),
    [position.latitude,position.longitude,venues]);
  function receive(event:WebViewMessageEvent){
    try{
      const message:unknown=JSON.parse(event.nativeEvent.data);
      if(!message||typeof message!=="object")return;
      const data=message as {type?:string;id?:string};
      if(data.type==="ready")onReady();
      if(data.type==="error")onFailed();
      if(data.type==="select"&&data.id&&venues.some(venue=>venue.id===data.id))onSelect(data.id);
    }catch{}
  }
  return <View testID="nearby-venues-map" style={styles.root}>
    <WebView
      style={styles.web}
      source={{html}}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled={false}
      cacheEnabled
      onMessage={receive}
      onError={onFailed}
      allowsBackForwardNavigationGestures={false}
      setSupportMultipleWindows={false}
    />
  </View>;
}

const styles=StyleSheet.create({
  root:{width:"100%",height:420,borderRadius:14,overflow:"hidden",backgroundColor:"#E8EEF6"},
  web:{flex:1,backgroundColor:"#E8EEF6"},
});
