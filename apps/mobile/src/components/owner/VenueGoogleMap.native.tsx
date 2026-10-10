import MapView,{Marker,PROVIDER_GOOGLE} from "react-native-maps";
import {StyleSheet} from "react-native";

type MapPoint={latitude:number;longitude:number};
type Props={point:MapPoint|null;venueName:string;markerHint:string;onPick:(point:MapPoint)=>void};
const DEFAULT_MAP_REGION={latitude:34.5553,longitude:69.2075,latitudeDelta:.08,longitudeDelta:.08};

/** Only loaded by iOS/Android. Native MapView must never be imported into a web route. */
export function VenueGoogleMap({point,venueName,markerHint,onPick}:Props){
  return <MapView
    provider={PROVIDER_GOOGLE}
    style={styles.map}
    initialRegion={point?{...point,latitudeDelta:.012,longitudeDelta:.012}:DEFAULT_MAP_REGION}
    mapType="standard"
    onPress={(event)=>onPick(event.nativeEvent.coordinate)}
    showsCompass
    showsUserLocation={false}
    toolbarEnabled={false}
  >
    {point?<Marker
      coordinate={point}
      draggable
      title={venueName}
      description={markerHint}
      onDragEnd={(event)=>onPick(event.nativeEvent.coordinate)}
    />:null}
  </MapView>;
}

const styles=StyleSheet.create({map:{flex:1,width:"100%",height:"100%"}});