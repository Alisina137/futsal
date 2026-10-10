import MapView from "react-native-maps";
import {StyleSheet,View} from "react-native";
type Point={latitude:number;longitude:number};
type Props={onLocation:(point:Point)=>void;onError:()=>void};
/** Invisible foreground-only native probe; permission is requested by the screen first. */
export function NearbyDeviceLocation({onLocation}:Props){
  return <View pointerEvents="none" style={styles.container}>
    <MapView style={styles.map} showsUserLocation showsMyLocationButton={false}
      onUserLocationChange={event=>{
        const value=event.nativeEvent.coordinate;
        if(value)onLocation({latitude:value.latitude,longitude:value.longitude});
      }}/>
  </View>;
}
const styles=StyleSheet.create({
  container:{width:2,height:2,overflow:"hidden",alignSelf:"flex-start"},
  map:{width:2,height:2},
});
