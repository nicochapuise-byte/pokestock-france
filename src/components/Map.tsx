"use client";
import {useEffect,useState} from "react";
import {CircleMarker,MapContainer,Popup,TileLayer,useMap} from "react-leaflet";
type Pos=[number,number];
function Fly({position}:{position:Pos|null}){const map=useMap();useEffect(()=>{if(position)map.flyTo(position,13)},[position,map]);return null}
export default function Map({userPosition}:{userPosition:Pos|null}){const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);if(!ready)return <div className="grid h-full place-items-center bg-slate-100 text-slate-500">Chargement de la carte…</div>;return <MapContainer center={[46.6,2.4]} zoom={6} minZoom={5} className="h-full w-full"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Fly position={userPosition}/>{userPosition&&<CircleMarker center={userPosition} radius={9}><Popup>Vous êtes ici</Popup></CircleMarker>}</MapContainer>}
