import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GraphNode, GraphEdge, Vehicle, haversine } from '@/lib/engine';
import { AppMode } from '@/hooks/useSimulation';

interface MapViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  mode: AppMode;
  selectedNodes: string[];
  vehicles: Vehicle[];
  simulationRunning: boolean;
  focusedVehicleId: string | null;
  pois: GraphNode[];
  onMapClick: (lat: number, lng: number) => void;
  onNodeClick: (id: string) => void;
  onNodeRightClick: (id: string) => void;
  onEdgeClick: (id: string) => void;
  onVehicleClick: (id: string) => void;
  onVehicleArrived: (id: string) => void;
  onRecalcNeeded: (vehicleId: string, fromNodeId: string) => void;
  onChangeDestination: (vehicleId: string, newDestId: string, fromNodeId: string) => void;
}

const NODE_COLORS = { POI: '#22c55e', Junction: '#64748b', selected: '#facc15' };

export default function MapView({
  nodes, edges, mode, selectedNodes,
  vehicles, simulationRunning, focusedVehicleId, pois,
  onMapClick, onNodeClick, onNodeRightClick, onEdgeClick,
  onVehicleClick, onVehicleArrived, onRecalcNeeded, onChangeDestination,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const nodeMarkersRef = useRef(new Map<string, L.CircleMarker>());
  const edgeLinesRef = useRef(new Map<string, L.Polyline>());
  const arrowsRef = useRef<L.Polyline[]>([]);
  const vehicleMarkersRef = useRef(new Map<string, L.CircleMarker>());
  const animStateRef = useRef(new Map<string, { segmentIndex: number; progress: number; pathVersion: number }>());
  const frameRef = useRef(0);
  const focusRouteRef = useRef<L.Polyline[]>([]);
  const focusPopupRef = useRef<L.Popup | null>(null);

  // Stable refs for animation loop
  const vehiclesRef = useRef(vehicles);
  useEffect(() => { vehiclesRef.current = vehicles; }, [vehicles]);
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const cbRef = useRef({ onVehicleArrived, onRecalcNeeded, onVehicleClick, onChangeDestination });
  useEffect(() => { cbRef.current = { onVehicleArrived, onRecalcNeeded, onVehicleClick, onChangeDestination }; });
  const focusedRef = useRef(focusedVehicleId);
  useEffect(() => { focusedRef.current = focusedVehicleId; }, [focusedVehicleId]);
  const poisRef = useRef(pois);
  useEffect(() => { poisRef.current = pois; }, [pois]);

  // Build node lookup map
  const nodeMapRef = useRef(new Map<string, GraphNode>());
  useEffect(() => {
    const m = new Map<string, GraphNode>();
    nodes.forEach((n) => m.set(n.id, n));
    nodeMapRef.current = m;
  }, [nodes]);

  // 1. Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [-2.558, -44.368],
      zoom: 15,
      zoomControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Grid
    const gridGroup = L.layerGroup().addTo(map);
    const drawGrid = () => {
      gridGroup.clearLayers();
      const bounds = map.getBounds();
      const step = 0.002;
      const south = Math.floor(bounds.getSouth() / step) * step;
      const west = Math.floor(bounds.getWest() / step) * step;
      for (let lat = south; lat <= bounds.getNorth(); lat += step) {
        L.polyline([[lat, bounds.getWest()], [lat, bounds.getEast()]], { color: 'rgba(100,116,139,0.15)', weight: 1 }).addTo(gridGroup);
      }
      for (let lng = west; lng <= bounds.getEast(); lng += step) {
        L.polyline([[bounds.getSouth(), lng], [bounds.getNorth(), lng]], { color: 'rgba(100,116,139,0.15)', weight: 1 }).addTo(gridGroup);
      }
    };
    map.on('moveend zoomend', drawGrid);
    drawGrid();

    // Event delegation for vehicle destination select
    mapContainerRef.current.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      if (target.id?.startsWith('vdest-')) {
        const vehicleId = target.id.replace('vdest-', '');
        const newDestId = target.value;
        const state = animStateRef.current.get(vehicleId);
        const vehicle = vehiclesRef.current.find((v) => v.id === vehicleId);
        if (state && vehicle?.path) {
          const fromNodeId = state.progress > 0.01
            ? vehicle.path[Math.min(state.segmentIndex + 1, vehicle.path.length - 1)]
            : vehicle.path[state.segmentIndex];
          cbRef.current.onChangeDestination(vehicleId, newDestId, fromNodeId);
        }
      }
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // 2. Map click
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e: L.LeafletMouseEvent) => {
      if (mode === 'editor') onMapClick(e.latlng.lat, e.latlng.lng);
    };
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [mode, onMapClick]);

  // 3. Draw nodes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = nodeMarkersRef.current;
    const currentIds = new Set(nodes.map((n) => n.id));
    for (const [id, marker] of existing) {
      if (!currentIds.has(id)) { marker.remove(); existing.delete(id); }
    }
    for (const node of nodes) {
      const isSelected = selectedNodes.includes(node.id);
      const color = isSelected ? NODE_COLORS.selected : NODE_COLORS[node.type];
      if (existing.has(node.id)) {
        const m = existing.get(node.id)!;
        m.setLatLng([node.lat, node.lng]);
        m.setStyle({ fillColor: color, color: color });
      } else {
        const marker = L.circleMarker([node.lat, node.lng], {
          radius: node.type === 'POI' ? 8 : 5,
          fillColor: color, color, fillOpacity: 0.9, weight: 2,
        }).addTo(map);
        marker.bindTooltip(node.name, { permanent: false, className: 'node-tooltip', direction: 'top', offset: [0, -10] });
        marker.on('click', (e) => { L.DomEvent.stopPropagation(e); onNodeClick(node.id); });
        marker.on('contextmenu', (e) => { L.DomEvent.stopPropagation(e); L.DomEvent.preventDefault(e); onNodeRightClick(node.id); });
        existing.set(node.id, marker);
      }
    }
  }, [nodes, selectedNodes, onNodeClick, onNodeRightClick]);

  // 4. Draw edges
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = edgeLinesRef.current;
    const currentIds = new Set(edges.map((e) => e.id));
    arrowsRef.current.forEach((d) => d.remove());
    arrowsRef.current = [];
    for (const [id, line] of existing) {
      if (!currentIds.has(id)) { line.remove(); existing.delete(id); }
    }
    for (const edge of edges) {
      const fromNode = nodeMapRef.current.get(edge.from);
      const toNode = nodeMapRef.current.get(edge.to);
      if (!fromNode || !toNode) continue;
      const latlngs: L.LatLngExpression[] = [[fromNode.lat, fromNode.lng], [toNode.lat, toNode.lng]];
      const edgeColor = edge.isBlocked ? '#ef4444' : '#64748b';
      const dashArray = edge.isBlocked ? '8, 8' : undefined;
      if (existing.has(edge.id)) {
        const line = existing.get(edge.id)!;
        line.setLatLngs(latlngs);
        line.setStyle({ color: edgeColor, dashArray });
      } else {
        const line = L.polyline(latlngs, { color: edgeColor, weight: 3, opacity: 0.8, dashArray }).addTo(map);
        line.on('click', (e) => { L.DomEvent.stopPropagation(e); onEdgeClick(edge.id); });
        existing.set(edge.id, line);
      }
      if (!edge.bidirectional && !edge.isBlocked) {
        const midLat = (fromNode.lat + toNode.lat) / 2;
        const midLng = (fromNode.lng + toNode.lng) / 2;
        const angle = Math.atan2(toNode.lng - fromNode.lng, toNode.lat - fromNode.lat);
        const arrowLen = 0.0003;
        const tip: L.LatLngExpression = [midLat, midLng];
        const left: L.LatLngExpression = [midLat - arrowLen * Math.cos(angle - 0.5), midLng - arrowLen * Math.sin(angle - 0.5)];
        const right: L.LatLngExpression = [midLat - arrowLen * Math.cos(angle + 0.5), midLng - arrowLen * Math.sin(angle + 0.5)];
        const arrow = L.polyline([left, tip, right], { color: '#64748b', weight: 2, opacity: 0.9 }).addTo(map);
        arrowsRef.current.push(arrow);
      }
    }
  }, [edges, nodes, onEdgeClick]);

  // 5. Vehicle animation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!simulationRunning) {
      cancelAnimationFrame(frameRef.current);
      vehicleMarkersRef.current.forEach((m) => m.remove());
      vehicleMarkersRef.current.clear();
      animStateRef.current.clear();
      // Clear focus route
      focusRouteRef.current.forEach((l) => l.remove());
      focusRouteRef.current = [];
      if (focusPopupRef.current) { focusPopupRef.current.remove(); focusPopupRef.current = null; }
      return;
    }

    // Create markers for vehicles that don't have one yet
    for (const v of vehicles) {
      if ((v.status !== 'moving' && v.status !== 'stuck') || !v.path || v.path.length < 2) continue;
      if (!vehicleMarkersRef.current.has(v.id)) {
        const startNode = nodeMapRef.current.get(v.path[0]);
        if (!startNode) continue;
        const marker = L.circleMarker([startNode.lat, startNode.lng], {
          radius: 10, fillColor: v.color, color: '#ffffff', fillOpacity: 1, weight: 2,
        }).addTo(map);
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          cbRef.current.onVehicleClick(v.id);
        });
        marker.bindTooltip(v.name, { permanent: false, className: 'node-tooltip', direction: 'top', offset: [0, -14] });
        vehicleMarkersRef.current.set(v.id, marker);
        animStateRef.current.set(v.id, { segmentIndex: 0, progress: 0, pathVersion: v.pathVersion });
      }
    }

    let lastTime = performance.now();

    const animate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      const currentVehicles = vehiclesRef.current;
      const nm = nodeMapRef.current;

      for (const v of currentVehicles) {
        if (v.status !== 'moving' || !v.path || v.path.length < 2) {
          // Mantém o marcador se o veículo estiver 'stuck'
          if (v.status === 'arrived' || v.status === 'idle') {
            const m = vehicleMarkersRef.current.get(v.id);
            if (m) { m.remove(); vehicleMarkersRef.current.delete(v.id); }
          }
          continue;
        }

        let state = animStateRef.current.get(v.id);
        if (!state) {
          state = { segmentIndex: 0, progress: 0, pathVersion: v.pathVersion };
          animStateRef.current.set(v.id, state);
        }

        // Path was updated (recalculation)
        if (state.pathVersion !== v.pathVersion) {
          state.segmentIndex = 0;
          state.progress = 0;
          state.pathVersion = v.pathVersion;
        }

        if (state.segmentIndex >= v.path.length - 1) {
          // Arrived at destination
          const dest = nm.get(v.path[v.path.length - 1]);
          if (dest) vehicleMarkersRef.current.get(v.id)?.setLatLng([dest.lat, dest.lng]);
          cbRef.current.onVehicleArrived(v.id);
          continue;
        }

        const fromNode = nm.get(v.path[state.segmentIndex]);
        const toNode = nm.get(v.path[state.segmentIndex + 1]);
        if (!fromNode || !toNode) continue;

        const dist = haversine(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
        const speedMs = v.speed * 1000 / 3600;
        state.progress += (speedMs * dt) / Math.max(dist, 1);

        if (state.progress >= 1) {
          state.segmentIndex++;
          state.progress = 0;

          if (state.segmentIndex >= v.path.length - 1) {
            const dest = nm.get(v.path[v.path.length - 1]);
            if (dest) vehicleMarkersRef.current.get(v.id)?.setLatLng([dest.lat, dest.lng]);
            cbRef.current.onVehicleArrived(v.id);
            continue;
          }

          // Check if recalculation needed
          if (v.needsRecalc) {
            cbRef.current.onRecalcNeeded(v.id, v.path[state.segmentIndex]);
            continue;
          }
        }

        // Interpolate position
        const p = Math.min(state.progress, 1);
        const lat = fromNode.lat + (toNode.lat - fromNode.lat) * p;
        const lng = fromNode.lng + (toNode.lng - fromNode.lng) * p;
        const marker = vehicleMarkersRef.current.get(v.id);
        if (marker) marker.setLatLng([lat, lng]);

        // Update focus popup position
        if (focusedRef.current === v.id && focusPopupRef.current) {
          focusPopupRef.current.setLatLng([lat, lng]);
        }
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [simulationRunning, vehicles]);

  // 6. Focus: route line + popup
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous
    focusRouteRef.current.forEach((l) => l.remove());
    focusRouteRef.current = [];
    if (focusPopupRef.current) { focusPopupRef.current.remove(); focusPopupRef.current = null; }

    if (!focusedVehicleId || !simulationRunning) return;

    const vehicle = vehicles.find((v) => v.id === focusedVehicleId);
    if (!vehicle?.path || vehicle.path.length < 2) return;

    // Draw route
    const latlngs = vehicle.path
      .map((id) => nodeMapRef.current.get(id))
      .filter(Boolean)
      .map((n) => [n!.lat, n!.lng] as L.LatLngExpression);

    const glow = L.polyline(latlngs, { color: '#22c55e', weight: 8, opacity: 0.3, className: 'neon-glow-line' }).addTo(map);
    const line = L.polyline(latlngs, { color: '#22c55e', weight: 4, opacity: 0.9, className: 'neon-glow-line' }).addTo(map);
    focusRouteRef.current = [glow, line];

    // Show popup
    const marker = vehicleMarkersRef.current.get(focusedVehicleId);
    const currentPois = poisRef.current;
    const options = currentPois.map((p) =>
      `<option value="${p.id}" ${p.id === vehicle.destinationId ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    const popup = L.popup({ className: 'vehicle-popup', closeOnClick: false, autoClose: false, closeButton: true })
      .setContent(`
        <div style="font-family:Inter,sans-serif;font-size:12px;color:#e2e8f0;">
          <strong style="color:${vehicle.color};">● ${vehicle.name}</strong>
          <div style="margin-top:6px;">
            <label style="font-size:10px;text-transform:uppercase;color:#94a3b8;">Novo Destino</label>
            <select id="vdest-${vehicle.id}" style="width:100%;background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:4px;padding:4px;margin-top:2px;font-size:11px;">
              ${options}
            </select>
          </div>
        </div>
      `);

    if (marker) {
      popup.setLatLng(marker.getLatLng());
    }
    popup.openOn(map);
    focusPopupRef.current = popup;

    popup.on('remove', () => {
      focusPopupRef.current = null;
      // Quando o popup é removido (X clicado), desmarcar o veículo para esconder a rota
      cbRef.current.onVehicleClick(focusedVehicleId);
    });
  }, [focusedVehicleId, simulationRunning, vehicles]);

  return (
    <div
      ref={mapContainerRef}
      className="absolute inset-0 z-0"
      style={{ cursor: mode === 'editor' ? 'crosshair' : 'default' }}
    />
  );
}
