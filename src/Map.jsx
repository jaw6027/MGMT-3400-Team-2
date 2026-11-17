import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { assess } from './model';
import { LocateFixed, Map as MapIcon } from 'lucide-react';

export default function LocationMap({ candidates, selected, onSelect }) {
  const root = useRef(null);
  const map = useRef(null);
  const markers = useRef(null);
  const tiles = useRef(null);
  const [streetMap, setStreetMap] = useState(false);
  const [tileError, setTileError] = useState(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  useEffect(() => {
    const instance = L.map(root.current, { zoomControl: false, attributionControl: true, minZoom: 10, maxZoom: 17 }).setView([34.687, -118.155], 12);
    map.current = instance;
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    const schematic = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000" viewBox="0 0 1200 1000"><defs><pattern id="grid" width="82" height="70" patternUnits="userSpaceOnUse"><rect width="82" height="70" fill="#e9ede4"/><path d="M0 0H82V70" fill="none" stroke="#fff" stroke-width="5"/></pattern></defs><rect width="1200" height="1000" fill="url(#grid)"/><g fill="#d2dfcb"><rect x="150" y="350" width="105" height="100" rx="10"/><rect x="720" y="165" width="125" height="115" rx="12"/><rect x="805" y="640" width="155" height="100" rx="12"/></g><g fill="none" stroke="#d5dacb" stroke-width="16"><path d="M0 200H1200M0 500H1200M0 800H1200M290 0V1000M610 0V1000M935 0V1000"/><path d="M460 1000Q530 600 500 400T430 0" stroke="#d8d4bf" stroke-width="24"/></g><g fill="none" stroke="#fffdf5" stroke-width="9"><path d="M0 200H1200M0 500H1200M0 800H1200M290 0V1000M610 0V1000M935 0V1000"/><path d="M460 1000Q530 600 500 400T430 0" stroke-width="14"/></g><g font-family="Arial,sans-serif" font-size="17" fill="#7d8a75" letter-spacing="3"><text x="630" y="460">LANCASTER</text><text x="660" y="490" font-size="11" letter-spacing="1">SCHEMATIC · NOT A STREET MAP</text><text x="100" y="730" font-size="12">ANTELOPE VALLEY</text></g></svg>`;
    L.imageOverlay(`data:image/svg+xml,${encodeURIComponent(schematic)}`, [[34.60, -118.36], [34.80, -117.99]]).addTo(instance);
    markers.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(root.current);
    return () => { observer.disconnect(); instance.remove(); };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    if (streetMap) {
      setTileError(false);
      tiles.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).on('tileerror', () => setTileError(true)).addTo(map.current);
    } else if (tiles.current) { tiles.current.remove(); tiles.current = null; }
  }, [streetMap]);
  useEffect(() => {
    markers.current.clearLayers();
    const points = candidates.filter(c => c.lat != null && c.lng != null);
    for (const candidate of points) {
      const { score, label } = assess(candidate);
      const pin = document.createElement('button');
      pin.className = `map-pin ${candidate.id === selected?.id ? 'active' : ''} ${label === 'Worth a visit' ? 'high' : ''}`;
      pin.setAttribute('aria-label', `Select ${candidate.name}, score ${score}`);
      pin.textContent = score;
      const marker = L.marker([candidate.lat, candidate.lng], {
        keyboard: false,
        icon: L.divIcon({ className: 'map-pin-wrap', html: pin, iconSize: [40, 42], iconAnchor: [20, 40] }),
      }).addTo(markers.current);
      marker.bindTooltip(document.createTextNode(candidate.name), { direction: 'top', offset: [0, -35] });
      marker.on('click', () => selectRef.current(candidate));
    }
    if (selected?.lat != null) map.current.panTo([selected.lat, selected.lng], { animate: false });
  }, [candidates, selected]);
  const fit = () => {
    const points = candidates.filter(c => c.lat != null).map(c => [c.lat, c.lng]);
    if (points.length) map.current.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 13 });
    else map.current.setView([34.687, -118.155], 12);
  };
  return <div className="map-shell">
    <div ref={root} className="location-map" aria-label="Lancaster candidate map" />
    <div className="map-top"><span className="map-city"><span className="live-dot" /> Lancaster, CA</span><button className="map-tool" onClick={fit} aria-label="Fit all locations"><LocateFixed size={18} /></button></div>
    <div className="map-bottom"><button className={`map-layer ${streetMap ? 'enabled' : ''}`} onClick={() => setStreetMap(!streetMap)}><MapIcon size={15} />{streetMap ? 'Street map on' : 'Enable street map'}</button><span>{streetMap ? (tileError ? 'Some tiles unavailable' : '© OpenStreetMap') : 'Schematic · approximate geography'}</span></div>
  </div>;
}
