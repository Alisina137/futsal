import {Redirect} from "expo-router";
// The Venue Owner dashboard always starts at its operational Overview.
export default function OwnerIndex(){return <Redirect href="/owner/overview"/>;}
