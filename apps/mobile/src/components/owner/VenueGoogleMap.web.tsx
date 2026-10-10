import {VenueLocationWebMap} from "./VenueLocationWebMap";

type MapPoint={latitude:number;longitude:number};
type Props={point:MapPoint|null;venueName:string;markerHint:string;onPick:(point:MapPoint)=>void};

/** Browser fallback. Never bundles react-native-maps or its native codegen. */
export function VenueGoogleMap({point,onPick}:Props){
  return <VenueLocationWebMap initialPoint={point} onPick={onPick}
    onReady={()=>{}} onFailed={()=>{}}/>;
}
