import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

type MapPoint={latitude:number;longitude:number};
type Props={
  initialPoint:MapPoint|null;
  readOnly?:boolean;
  onPick:(point:MapPoint)=>void;
  onFailed:()=>void;
  onReady:()=>void;
};

// Expo Go SDK 57 sometimes shows the Google watermark without actual tiles.
// Render a map in Android WebView independently of the native Google Maps SDK.
// Replace community tiles with a licensed hosted provider before large-scale launch.
function createMapHtml(initialPoint:MapPoint|null,readOnly:boolean):string{
  const center=initialPoint??{latitude:34.5553,longitude:69.2075};
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{width:100%;height:100%;padding:0;margin:0;background:#eff3f6}#map{position:absolute;inset:0}.leaflet-control-attribution{font-size:11px!important}.leaflet-container{font-family:system-ui,Arial,sans-serif}</style>
</head><body><div id="map" role="application" aria-label="Venue location map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var send=function(type,point){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:type,point:point||null}));};
  if(!window.L){send("error");return;}
  try{
    var start=${JSON.stringify([center.latitude,center.longitude])};
    var selected=${JSON.stringify(initialPoint?[initialPoint.latitude,initialPoint.longitude]:null)};
    var map=L.map("map",{zoomControl:true,attributionControl:true}).setView(start,selected?16:13);
    var tiles=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
      maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }).addTo(map);
    var loaded=false;
    tiles.on("tileload",function(){if(!loaded){loaded=true;send("ready");}});
    window.setTimeout(function(){if(!loaded)send("error");},10000);
    var marker=null;
    function setPin(latlng,notify){
      if(!marker){
        marker=L.marker(latlng,{draggable:${!readOnly}}).addTo(map);
        if(!${readOnly})marker.on("dragend",function(){var p=marker.getLatLng();send("pick",{latitude:p.lat,longitude:p.lng});});
      }else{marker.setLatLng(latlng);}
      if(notify)send("pick",{latitude:latlng.lat,longitude:latlng.lng});
    }
    if(selected)setPin(L.latLng(selected[0],selected[1]),false);
    if(!${readOnly})map.on("click",function(event){setPin(event.latlng,true);});
    map.invalidateSize();
  }catch(error){send("error");}
})();
</script></body></html>`;
}

export function VenueLocationWebMap({initialPoint,readOnly=false,onPick,onFailed,onReady}:Props){
  const html=useMemo(()=>createMapHtml(initialPoint,readOnly),[initialPoint?.latitude,initialPoint?.longitude,readOnly]);
  function receive(event:WebViewMessageEvent){
    try{
      const message:unknown=JSON.parse(event.nativeEvent.data);
      if(!message||typeof message!=="object")return;
      const parsed=message as {type?:string;point?:MapPoint|null};
      if(parsed.type==="ready"){onReady();return;}
      if(parsed.type==="error"){onFailed();return;}
      if(parsed.type!=="pick"||!parsed.point)return;
      const {latitude,longitude}=parsed.point;
      if(typeof latitude==="number"&&typeof longitude==="number"&&
         Number.isFinite(latitude)&&Number.isFinite(longitude)&&
         latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180){
        onPick({latitude,longitude});
      }
    }catch{}
  }
  return <View style={styles.container}>
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
  container:{flex:1,minHeight:220,backgroundColor:"#EFF3F6"},
  web:{flex:1,backgroundColor:"#EFF3F6"},
});
