import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PlantNode, PlantEdge } from '../types';
import { Forklift, DockTruck, ForkliftLoad } from '../../fleet/types';
import { AppMode } from './PlantControlPanel';
import { euclideanDistance, calculateHeadingAngle } from '../../routing/engine';
import { EdgeTrafficStat } from '../../routing/traffic-analysis';
import { assetUrl } from '@/lib/assets';

export type EditorTool = 'add_poi' | 'add_junction' | 'connect_nodes' | 'toggle_block' | 'delete';

interface PlantMapViewProps {
  nodes: PlantNode[];
  edges: PlantEdge[];
  mode: AppMode;
  editorTool: EditorTool;
  selectedNodes: string[];
  vehicles: Forklift[];
  dockTrucks: DockTruck[];
  simulationRunning: boolean;
  focusedVehicleId: string | null;
  showHeatmap: boolean;
  edgeTrafficMap: Map<string, EdgeTrafficStat>;
  pois: PlantNode[];
  onNodeDragEnd: (id: string, x: number, y: number) => void;
  onMapClick: (x: number, y: number) => void;
  onNodeClick: (id: string) => void;
  onNodeRightClick: (id: string) => void;
  onEdgeClick: (id: string) => void;
  onVehicleClick: (id: string) => void;
  onVehicleArrived: (id: string) => void;
  onRecalcNeeded: (vehicleId: string, fromNodeId: string) => void;
  onChangeDestination: (vehicleId: string, newDestId: string, fromNodeId: string) => void;
  onDispatchVehicle: (vehicleId: string, destId: string, load?: ForkliftLoad) => void;
}

const PLANT_WIDTH = 1600;
const PLANT_HEIGHT = 1000;

function svgToLatLng(x: number, y: number): L.LatLngExpression {
  return [PLANT_HEIGHT - y, x];
}

function latLngToSvg(lat: number, lng: number): { x: number; y: number } {
  return {
    x: Math.round(Math.max(0, Math.min(PLANT_WIDTH, lng))),
    y: Math.round(Math.max(0, Math.min(PLANT_HEIGHT, PLANT_HEIGHT - lat))),
  };
}

function getBoxBounds(x: number, y: number, w: number, h: number): L.LatLngBoundsExpression {
  return [
    [PLANT_HEIGHT - (y + h), x],
    [PLANT_HEIGHT - y, x + w],
  ];
}

export default function PlantMapView({
  nodes,
  edges,
  mode,
  editorTool,
  selectedNodes,
  vehicles,
  dockTrucks,
  simulationRunning,
  focusedVehicleId,
  showHeatmap,
  edgeTrafficMap,
  pois,
  onNodeDragEnd,
  onMapClick,
  onNodeClick,
  onNodeRightClick,
  onEdgeClick,
  onVehicleClick,
  onVehicleArrived,
  onRecalcNeeded,
  onChangeDestination,
  onDispatchVehicle,
}: PlantMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const nodeMarkersRef = useRef(new Map<string, L.Marker>());
  const edgeLinesRef = useRef(new Map<string, L.Polyline>());
  const arrowsRef = useRef<L.Polyline[]>([]);
  const vehicleMarkersRef = useRef(new Map<string, L.Marker>());
  const shippingTruckMarkersRef = useRef(new Map<string, L.Marker>());
  const animStateRef = useRef(new Map<string, { segmentIndex: number; progress: number; pathVersion: number; currentX: number; currentY: number }>());
  const frameRef = useRef(0);
  const focusRouteRef = useRef<L.Polyline[]>([]);
  const focusPopupRef = useRef<L.Popup | null>(null);

  // Refs estáveis
  const vehiclesRef = useRef(vehicles);
  useEffect(() => { vehiclesRef.current = vehicles; }, [vehicles]);
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const edgesRef = useRef(edges);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  const nodeMapRef = useRef(new Map<string, PlantNode>());
  useEffect(() => {
    const m = new Map<string, PlantNode>();
    nodes.forEach((n) => m.set(n.id, n));
    nodeMapRef.current = m;
  }, [nodes]);

  const cbRef = useRef({ onVehicleArrived, onRecalcNeeded, onVehicleClick, onChangeDestination, onDispatchVehicle, onNodeDragEnd });
  useEffect(() => {
    cbRef.current = { onVehicleArrived, onRecalcNeeded, onVehicleClick, onChangeDestination, onDispatchVehicle, onNodeDragEnd };
  });

  const focusedRef = useRef(focusedVehicleId);
  useEffect(() => { focusedRef.current = focusedVehicleId; }, [focusedVehicleId]);
  const poisRef = useRef(pois);
  useEffect(() => { poisRef.current = pois; }, [pois]);

  // 1. Inicializar mapa Leaflet com CRS.Simple e camadas físicas (Racks 56px, Caminhões e Paletes)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const bounds: L.LatLngBoundsExpression = [[0, 0], [PLANT_HEIGHT, PLANT_WIDTH]];

    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 3,
      zoomSnap: 0.1,
      attributionControl: false,
      zoomControl: false,
    });

    // Camada 1: Planta Baixa SCADA Base
    L.imageOverlay(assetUrl('images/warehouse_plant.svg'), bounds, {
      opacity: 1,
      interactive: false,
    }).addTo(map);

    // === Camada 2: Racks Industriais WEG (Escalonável com o mapa) ===
    // Utilizando 1 imagem única ajustada ao molde. 
    // Como o PNG tem espaço em branco/transparente nas laterais, "esticamos" o RACK_W para 140px
    // e centralizamos para que o conteúdo visual ocupe exatamente a vaga pontilhada de 56px.
    const RACK_W = 160;
    const RACK_H = 265;
    const offsetX = (RACK_W - 56) / 2; // Centraliza a imagem expandida na vaga original
    
    // Corredores superiores (y = 235)
    const upperRackX = [90, 154, 232, 296, 374, 438, 516, 580, 658, 722, 800, 864, 942, 1006, 1084, 1148];
    upperRackX.forEach((x) => {
      L.imageOverlay(assetUrl('images/rack-weg.png'), getBoxBounds(x - offsetX, 235, RACK_W, RACK_H), { interactive: false }).addTo(map);
    });

    // Corredores inferiores (y = 605)
    const lowerRackX = [516, 580, 658, 722, 800, 864, 942, 1006, 1084, 1148];
    lowerRackX.forEach((x) => {
      L.imageOverlay(assetUrl('images/rack-weg.png'), getBoxBounds(x - offsetX, 605, RACK_W, RACK_H), { interactive: false }).addTo(map);
    });

    // === Camada 3: Caminhões de Recebimento Inbound (Escalonável com o mapa, Aspect Ratio ~2:1) ===
    const TRUCK_IN_W = 140;
    const TRUCK_IN_H = 70;
    [677, 772, 867].forEach((cy) => {
      L.imageOverlay(assetUrl('images/truck-topdown.png'), getBoxBounds(85, cy - TRUCK_IN_H/2, TRUCK_IN_W, TRUCK_IN_H), { interactive: false }).addTo(map);
    });

    // === Camada 4: Paletes WEG - Picking, Staging e Buffer (Escalonável com o mapa, Aspect Ratio 3:2) ===
    const PAL_W = 42;
    const PAL_H = 28;
    
    const renderPallet = (x: number, y: number, plc: boolean) => {
      const img = plc ? assetUrl('images/pallet-plc-weg.png') : assetUrl('images/pallet-motors-weg.png');
      L.imageOverlay(img, getBoxBounds(x - PAL_W/2, y - PAL_H/2, PAL_W, PAL_H), { interactive: false }).addTo(map);
    };

    // Picking area
    [
      { x: 565, y: 113, plc: true },  { x: 640, y: 113, plc: false },
      { x: 725, y: 113, plc: true },  { x: 800, y: 113, plc: false },
      { x: 885, y: 113, plc: true },  { x: 960, y: 113, plc: false },
      { x: 1045, y: 113, plc: true }, { x: 1130, y: 113, plc: false },
      { x: 565, y: 169, plc: false }, { x: 640, y: 169, plc: true },
      { x: 725, y: 169, plc: false }, { x: 800, y: 169, plc: true },
      { x: 885, y: 169, plc: false }, { x: 960, y: 169, plc: true },
      { x: 1045, y: 169, plc: false },{ x: 1130, y: 169, plc: true },
    ].forEach((p) => renderPallet(p.x, p.y, p.plc));

    // Staging, buffer e expedição
    [
      { x: 308, y: 680, plc: true },  { x: 368, y: 680, plc: false }, { x: 428, y: 680, plc: true },
      { x: 308, y: 730, plc: false }, { x: 368, y: 730, plc: true },  { x: 428, y: 730, plc: false },
      { x: 308, y: 830, plc: true },  { x: 368, y: 830, plc: false }, { x: 428, y: 830, plc: true },
      { x: 308, y: 880, plc: false }, { x: 368, y: 880, plc: true },  { x: 428, y: 880, plc: false },
      { x: 1273, y: 770, plc: true }, { x: 1343, y: 770, plc: false },
      { x: 1413, y: 770, plc: true }, { x: 1483, y: 770, plc: false },
      { x: 1273, y: 840, plc: false },{ x: 1343, y: 840, plc: true },
      { x: 1413, y: 840, plc: false },{ x: 1483, y: 840, plc: true },
    ].forEach((p) => renderPallet(p.x, p.y, p.plc));

    map.fitBounds(bounds);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const updateScale = () => {
      // Base scale at zoom 0 is 1. Each zoom level multiplies by 2.
      const scale = Math.pow(2, map.getZoom());
      document.documentElement.style.setProperty('--map-scale', scale.toString());
    };
    map.on('zoom', updateScale);
    updateScale(); // Initial scale

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Renderizar Caminhões Dinâmicos de Expedição com Animação de Partida/Retorno
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const dockPositions: Record<string, { x: number; y: number }> = {
      'doca-s01': { x: 1375, y: 128 },
      'doca-s02': { x: 1375, y: 288 },
      'doca-s03': { x: 1375, y: 448 },
    };

    dockTrucks.forEach((truck) => {
      const pos = dockPositions[truck.dockId];
      if (!pos) return;

      const latlng = svgToLatLng(pos.x + 70, pos.y + 35);

      let transformStyle = 'transform: translateX(0); opacity: 1;';
      if (truck.status === 'departing') {
        transformStyle = 'transform: translateX(250px); opacity: 0; transition: all 1.2s ease-in;';
      } else if (truck.status === 'away') {
        transformStyle = 'transform: translateX(250px); opacity: 0; pointer-events: none;';
      } else if (truck.status === 'arriving') {
        transformStyle = 'transform: translateX(0); opacity: 1; transition: all 1.2s ease-out;';
      }

      const badgeColor = truck.palletsLoaded >= truck.maxPallets ? '#16A34A' : '#051E4B';

      const html = `
        <div style="transform: scale(var(--map-scale, 1)); transform-origin: center center; width:140px; height:70px;">
          <div id="truck-anim-${truck.id}" style="position:relative; width:100%; height:100%; ${transformStyle}">
            <div style="position:absolute; top:-16px; left:0; width:100%; display:flex; justify-content:center;">
              <span id="truck-label-${truck.id}" style="background:${badgeColor}; color:#FFF; font-size:9px; font-weight:800; padding:1px 6px; border-radius:3px; border:1px solid #F49E03; box-shadow:0 2px 4px rgba(0,0,0,0.2); white-space:nowrap; transition: background 0.3s ease;">
                ${truck.dockName.split(' ')[0]} ${truck.dockName.split(' ')[1]} • 📦 ${truck.palletsLoaded}/${truck.maxPallets} Paletes
              </span>
            </div>
            <img src="${assetUrl('images/truck-topdown.png')}" style="width:140px; height:70px; object-fit:contain; filter:drop-shadow(0 3px 6px rgba(5,30,75,0.25));" />
          </div>
        </div>
      `;

      if (shippingTruckMarkersRef.current.has(truck.id)) {
        // Atualiza diretamente no DOM para preservar a transição CSS que seria perdida usando setIcon
        const animDiv = document.getElementById(`truck-anim-${truck.id}`);
        if (animDiv) {
          animDiv.style.cssText = `position:relative; width:100%; height:100%; ${transformStyle}`;
        }
        const labelSpan = document.getElementById(`truck-label-${truck.id}`);
        if (labelSpan) {
          labelSpan.innerHTML = `${truck.dockName.split(' ')[0]} ${truck.dockName.split(' ')[1]} • 📦 ${truck.palletsLoaded}/${truck.maxPallets} Paletes`;
          labelSpan.style.background = badgeColor;
        }
      } else {
        const icon = L.divIcon({
          className: 'custom-truck-icon',
          html,
          iconSize: [140, 70],
          iconAnchor: [70, 35],
        });
        const marker = L.marker(latlng, { icon, zIndexOffset: 200, interactive: false }).addTo(map);
        shippingTruckMarkersRef.current.set(truck.id, marker);
      }
    });
  }, [dockTrucks]);

  // 3. Clique no Mapa (Inserção de Nós)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handler = (e: L.LeafletMouseEvent) => {
      if (mode === 'editor') {
        if (editorTool === 'add_poi' || editorTool === 'add_junction') {
          const { x, y } = latLngToSvg(e.latlng.lat, e.latlng.lng);
          onMapClick(x, y);
        }
      }
    };

    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [mode, editorTool, onMapClick]);

  // 4. Renderizar Nós com Suporte Completo a Drag and Drop (Mover Ponto / Junção)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existing = nodeMarkersRef.current;
    const currentIds = new Set(nodes.map((n) => n.id));

    for (const [id, marker] of existing) {
      if (!currentIds.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }

    for (const node of nodes) {
      const isSelected = selectedNodes.includes(node.id);
      const isPoi = node.type === 'POI';
      const latlng = svgToLatLng(node.x, node.y);

      const color = isSelected ? '#F49E03' : isPoi ? '#051E4B' : '#64748B';
      const bgColor = isSelected ? '#FEF3C7' : isPoi ? '#F49E03' : '#FFFFFF';
      const size = isSelected ? 16 : isPoi ? 14 : 10;

      const html = `
        <div style="width:${size}px; height:${size}px; border-radius:50%; background:${bgColor}; border:2.5px solid ${color}; box-shadow:0 2px 5px rgba(5,30,75,0.3); transition:transform 0.1s ease; cursor:${mode === 'editor' ? 'grab' : 'pointer'};">
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-node-marker',
        html,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      if (existing.has(node.id)) {
        const m = existing.get(node.id)!;
        m.setLatLng(latlng);
        m.setIcon(icon);
        if (mode === 'editor') {
          m.dragging?.enable();
        } else {
          m.dragging?.disable();
        }
      } else {
        const marker = L.marker(latlng, {
          icon,
          draggable: mode === 'editor',
          zIndexOffset: isPoi ? 500 : 300,
        }).addTo(map);

        marker.bindTooltip(node.name, {
          permanent: false,
          className: 'industrial-tooltip',
          direction: 'top',
          offset: [0, -8],
        });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onNodeClick(node.id);
        });

        marker.on('contextmenu', (e) => {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);
          onNodeRightClick(node.id);
        });

        // Evento de Drag: atualiza linhas conectadas em tempo real
        marker.on('drag', () => {
          const currentLatLng = marker.getLatLng();
          const { x: newX, y: newY } = latLngToSvg(currentLatLng.lat, currentLatLng.lng);

          // Atualizar visualmente as arestas conectadas a este nó
          for (const edge of edgesRef.current) {
            if (edge.from === node.id || edge.to === node.id) {
              const line = edgeLinesRef.current.get(edge.id);
              if (line) {
                const otherId = edge.from === node.id ? edge.to : edge.from;
                const otherNode = nodeMapRef.current.get(otherId);
                if (otherNode) {
                  const pts: L.LatLngExpression[] = edge.from === node.id
                    ? [svgToLatLng(newX, newY), svgToLatLng(otherNode.x, otherNode.y)]
                    : [svgToLatLng(otherNode.x, otherNode.y), svgToLatLng(newX, newY)];
                  line.setLatLngs(pts);
                }
              }
            }
          }
        });

        // Evento de DragEnd: persiste a nova coordenada no estado do grafo
        marker.on('dragend', () => {
          const finalLatLng = marker.getLatLng();
          const { x, y } = latLngToSvg(finalLatLng.lat, finalLatLng.lng);
          cbRef.current.onNodeDragEnd(node.id, x, y);
        });

        existing.set(node.id, marker);
      }
    }
  }, [nodes, selectedNodes, mode, onNodeClick, onNodeRightClick]);

  // 5. Renderizar Vias / Arestas (com Heatmap e Sentidos)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existing = edgeLinesRef.current;
    const currentIds = new Set(edges.map((e) => e.id));

    arrowsRef.current.forEach((d) => d.remove());
    arrowsRef.current = [];

    for (const [id, line] of existing) {
      if (!currentIds.has(id)) {
        line.remove();
        existing.delete(id);
      }
    }

    for (const edge of edges) {
      const fromNode = nodeMapRef.current.get(edge.from);
      const toNode = nodeMapRef.current.get(edge.to);
      if (!fromNode || !toNode) continue;

      const latlngs: L.LatLngExpression[] = [
        svgToLatLng(fromNode.x, fromNode.y),
        svgToLatLng(toNode.x, toNode.y),
      ];

      let edgeColor = '#051E4B';
      let edgeWeight = 3;

      if (edge.isBlocked) {
        edgeColor = '#DC2626';
        edgeWeight = 4;
      } else if (showHeatmap) {
        const stat = edgeTrafficMap.get(edge.id);
        if (stat?.saturationLevel === 'critical') {
          edgeColor = '#DC2626';
          edgeWeight = 5;
        } else if (stat?.saturationLevel === 'high') {
          edgeColor = '#F97316';
          edgeWeight = 4;
        } else if (stat?.saturationLevel === 'medium') {
          edgeColor = '#F49E03';
          edgeWeight = 3.5;
        } else {
          edgeColor = '#16A34A';
          edgeWeight = 2.5;
        }
      }

      const dashArray = edge.isBlocked ? '6, 6' : undefined;

      if (existing.has(edge.id)) {
        const line = existing.get(edge.id)!;
        line.setLatLngs(latlngs);
        line.setStyle({ color: edgeColor, weight: edgeWeight, dashArray });
      } else {
        const line = L.polyline(latlngs, {
          color: edgeColor,
          weight: edgeWeight,
          opacity: 0.85,
          dashArray,
        }).addTo(map);

        line.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onEdgeClick(edge.id);
        });

        existing.set(edge.id, line);
      }

      if (!edge.bidirectional && !edge.isBlocked) {
        const midX = (fromNode.x + toNode.x) / 2;
        const midY = (fromNode.y + toNode.y) / 2;
        const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
        const arrowLen = 14;

        const pMid = svgToLatLng(midX, midY) as [number, number];
        const pLeft = svgToLatLng(
          midX - arrowLen * Math.cos(angle - 0.5),
          midY - arrowLen * Math.sin(angle - 0.5)
        ) as [number, number];
        const pRight = svgToLatLng(
          midX - arrowLen * Math.cos(angle + 0.5),
          midY - arrowLen * Math.sin(angle + 0.5)
        ) as [number, number];

        const arrow = L.polyline([pLeft, pMid, pRight], {
          color: edgeColor,
          weight: 2.5,
          opacity: 0.9,
        }).addTo(map);

        arrowsRef.current.push(arrow);
      }
    }
  }, [edges, nodes, showHeatmap, edgeTrafficMap, onEdgeClick]);

  // 6. Animação e Preservação de Empilhadeiras no Mapa (Em Repouso no Destino)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!simulationRunning) {
      cancelAnimationFrame(frameRef.current);
      vehicleMarkersRef.current.forEach((m) => m.remove());
      vehicleMarkersRef.current.clear();
      animStateRef.current.clear();

      focusRouteRef.current.forEach((l) => l.remove());
      focusRouteRef.current = [];
      if (focusPopupRef.current) {
        focusPopupRef.current.remove();
        focusPopupRef.current = null;
      }
      return;
    }

    const getPalletImage = (load: Forklift['load']) => {
      if (load === 'pallet_plc') return assetUrl('images/pallet-plc-weg.png');
      if (load === 'pallet_motors') return assetUrl('images/pallet-motors-weg.png');
      return null;
    };

    for (const v of vehicles) {
      // Posição inicial ou posição atual de repouso
      const currentNodeId = v.status === 'arrived' && v.destinationId ? v.destinationId : v.originId;
      const startNode = nodeMapRef.current.get(currentNodeId);
      if (!startNode) continue;

      const palletSrc = getPalletImage(v.load);

      const iconHtml = `
        <div id="vwrap-${v.id}" class="forklift-icon-container" style="width:48px; height:26px; position:relative;">
          <div id="vrot-${v.id}" style="width:48px; height:26px; position:relative; transform:rotate(${v.headingAngle + 180}deg); transition:transform 0.12s linear; transform-origin:center center;">
            ${palletSrc ? `<img id="vpal-${v.id}" src="${palletSrc}" style="position:absolute; left:-14px; top:3px; width:20px; height:20px; object-fit:contain; z-index:10; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.3));" />` : `<img id="vpal-${v.id}" src="" style="display:none;" />`}
            <img id="vimg-${v.id}" src="${assetUrl('images/forklift-topdown.png')}"
                 style="width:48px; height:26px; object-fit:contain; filter:drop-shadow(0 2px 4px rgba(5,30,75,0.3));" 
                 alt="${v.name}" />
          </div>
          <span id="vtag-${v.id}" class="forklift-tag">${v.code} ${v.status === 'arrived' ? '(Repouso)' : ''}</span>
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-forklift-icon',
        html: iconHtml,
        iconSize: [48, 26],
        iconAnchor: [24, 13],
      });

      if (!vehicleMarkersRef.current.has(v.id)) {
        const marker = L.marker(svgToLatLng(startNode.x, startNode.y), { icon, zIndexOffset: 1000 }).addTo(map);

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          cbRef.current.onVehicleClick(v.id);
        });

        vehicleMarkersRef.current.set(v.id, marker);
        animStateRef.current.set(v.id, {
          segmentIndex: 0,
          progress: 0,
          pathVersion: v.pathVersion,
          currentX: startNode.x,
          currentY: startNode.y,
        });
      } else {
        const marker = vehicleMarkersRef.current.get(v.id)!;
        marker.setIcon(icon);
      }
    }

    let lastTime = performance.now();

    const animate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      const currentVehicles = vehiclesRef.current;
      const nm = nodeMapRef.current;

      for (const v of currentVehicles) {
        if (!v.path || v.path.length < 2) continue;

        let state = animStateRef.current.get(v.id);
        if (!state) {
          state = { segmentIndex: 0, progress: 0, pathVersion: v.pathVersion, currentX: 0, currentY: 0 };
          animStateRef.current.set(v.id, state);
        }

        // Se está em repouso (arrived), mantém na posição final física do POI de destino
        if (v.status === 'arrived') {
          const dest = nm.get(v.destinationId || v.path[v.path.length - 1]);
          if (dest) {
            vehicleMarkersRef.current.get(v.id)?.setLatLng(svgToLatLng(dest.x, dest.y));
          }
          continue;
        }

        if (v.status !== 'moving') continue;

        if (state.pathVersion !== v.pathVersion) {
          state.segmentIndex = 0;
          state.progress = 0;
          state.pathVersion = v.pathVersion;
          // Posicionar o marker fisicamente no início do novo caminho (evita "teletransporte")
          const startNode = nm.get(v.path[0]);
          if (startNode) {
            state.currentX = startNode.x;
            state.currentY = startNode.y;
            vehicleMarkersRef.current.get(v.id)?.setLatLng(svgToLatLng(startNode.x, startNode.y));
          }
        }

        if (state.segmentIndex >= v.path.length - 1) {
          const dest = nm.get(v.path[v.path.length - 1]);
          if (dest) {
            vehicleMarkersRef.current.get(v.id)?.setLatLng(svgToLatLng(dest.x, dest.y));
          }
          cbRef.current.onVehicleArrived(v.id);
          continue;
        }

        const fromNode = nm.get(v.path[state.segmentIndex]);
        const toNode = nm.get(v.path[state.segmentIndex + 1]);
        if (!fromNode || !toNode) continue;

        const dist = euclideanDistance(fromNode.x, fromNode.y, toNode.x, toNode.y);
        const speedPxPerSec = v.speed * 8;
        state.progress += (speedPxPerSec * dt) / Math.max(dist, 1);

        const angle = calculateHeadingAngle(fromNode.x, fromNode.y, toNode.x, toNode.y);
        const rotEl = document.getElementById(`vrot-${v.id}`);
        if (rotEl) {
          rotEl.style.transform = `rotate(${angle + 180}deg)`;
        }

        if (state.progress >= 1) {
          state.segmentIndex++;
          state.progress = 0;

          if (state.segmentIndex >= v.path.length - 1) {
            const dest = nm.get(v.path[v.path.length - 1]);
            if (dest) {
              vehicleMarkersRef.current.get(v.id)?.setLatLng(svgToLatLng(dest.x, dest.y));
            }
            cbRef.current.onVehicleArrived(v.id);
            continue;
          }

          if (v.needsRecalc) {
            cbRef.current.onRecalcNeeded(v.id, v.path[state.segmentIndex]);
            continue;
          }
        }

        const p = Math.min(state.progress, 1);
        const currentX = fromNode.x + (toNode.x - fromNode.x) * p;
        const currentY = fromNode.y + (toNode.y - fromNode.y) * p;
        state.currentX = currentX;
        state.currentY = currentY;

        const marker = vehicleMarkersRef.current.get(v.id);
        if (marker) {
          marker.setLatLng(svgToLatLng(currentX, currentY));
        }

        if (focusedRef.current === v.id && focusPopupRef.current) {
          focusPopupRef.current.setLatLng(svgToLatLng(currentX, currentY));
        }
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [simulationRunning, vehicles]);

  // 7. Foco na Empilhadeira & Despacho Dinâmico de Missões
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    focusRouteRef.current.forEach((l) => l.remove());
    focusRouteRef.current = [];
    if (focusPopupRef.current) {
      focusPopupRef.current.remove();
      focusPopupRef.current = null;
    }

    if (!focusedVehicleId || !simulationRunning) return;

    const vehicle = vehicles.find((v) => v.id === focusedVehicleId);
    if (!vehicle) return;

    if (vehicle.path && vehicle.path.length >= 2 && vehicle.status === 'moving') {
      const latlngs = vehicle.path
        .map((id) => nodeMapRef.current.get(id))
        .filter(Boolean)
        .map((n) => svgToLatLng(n!.x, n!.y));

      const glow = L.polyline(latlngs, {
        color: '#F49E03',
        weight: 8,
        opacity: 0.35,
      }).addTo(map);

      const line = L.polyline(latlngs, {
        color: '#051E4B',
        weight: 3.5,
        dashArray: '8, 6',
        opacity: 0.95,
      }).addTo(map);

      focusRouteRef.current = [glow, line];
    }

    const marker = vehicleMarkersRef.current.get(focusedVehicleId);
    const currentPois = poisRef.current;
    const originNode = nodeMapRef.current.get(vehicle.originId);

    const options = currentPois.map((p) =>
      `<option value="${p.id}" ${p.id === vehicle.destinationId ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    const loadLabels: Record<Forklift['load'], { name: string; img: string | null }> = {
      empty: { name: 'Sem Carga (Vazia)', img: null },
      pallet_plc: { name: 'Palete Módulos PLC WEG', img: '/images/pallet-plc-weg.png' },
      pallet_motors: { name: 'Palete 6x Motores WEG', img: '/images/pallet-motors-weg.png' },
    };

    const currentLoadInfo = loadLabels[vehicle.load] || loadLabels.empty;

    const popup = L.popup({
      className: 'industrial-popup',
      closeOnClick: false,
      autoClose: false,
      closeButton: true,
      offset: [0, -18],
    }).setContent(`
      <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;color:#051E4B;min-width:220px;padding:2px;">
        <div style="display:flex;align-items:center;justify-content:between;gap:6px;margin-bottom:6px;border-bottom:1px solid #E2E8F0;padding-bottom:4px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <img src="${assetUrl('images/forklift-topdown.png')}" style="width:24px;height:24px;object-fit:contain;" />
            <div>
              <strong style="color:#051E4B;font-size:12px;display:block;">${vehicle.name}</strong>
              <span style="font-size:9px;color:#64748B;font-family:'JetBrains Mono',monospace;">CÓD: ${vehicle.code}</span>
            </div>
          </div>
        </div>

        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:6px;margin-bottom:6px;">
          <div style="font-size:9.5px;font-weight:700;color:#64748B;text-transform:uppercase;margin-bottom:2px;">Localização Física Atual</div>
          <div style="font-size:11px;font-weight:700;color:#051E4B;">📍 ${originNode?.name || 'Ponto Operacional'}</div>
        </div>

        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:6px;margin-bottom:6px;">
          <div style="font-size:9.5px;font-weight:700;color:#64748B;text-transform:uppercase;margin-bottom:2px;">Carga Atual</div>
          <div style="display:flex;align-items:center;gap:6px;">
            ${currentLoadInfo.img ? `<img src="${currentLoadInfo.img}" style="width:24px;height:18px;object-fit:contain;background:#FFF;padding:1px;border-radius:2px;border:1px solid #CBD5E1;" />` : `<span style="font-size:14px;">📦</span>`}
            <span style="font-size:11px;font-weight:700;color:#051E4B;">${currentLoadInfo.name}</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;color:#64748B;margin-bottom:6px;">
          <div>Status: <strong style="color:${vehicle.status === 'moving' ? '#16A34A' : '#051E4B'}">${vehicle.status === 'moving' ? 'Em Rota' : vehicle.status === 'arrived' ? 'Em Repouso' : vehicle.status}</strong></div>
          <div>Bateria: <strong style="color:#F49E03">${vehicle.battery}%</strong></div>
        </div>

        <div>
          <label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#64748B;display:block;">Novo Destino da Missão</label>
          <select id="vdest-popup-${vehicle.id}" style="width:100%;background:#FFF;color:#051E4B;border:1px solid #CBD5E1;border-radius:4px;padding:4px;margin-top:2px;font-size:11px;font-weight:600;">
            ${options}
          </select>
        </div>

        <button id="vbtn-dispatch-${vehicle.id}" style="margin-top:8px;width:100%;background:#051E4B;color:#FFF;border:none;border-radius:5px;padding:6px;font-size:11px;font-weight:800;cursor:pointer;text-transform:uppercase;letter-spacing:0.5px;">
          ▶ Despachar para este Destino
        </button>
      </div>
    `);

    if (marker) {
      popup.setLatLng(marker.getLatLng());
    }
    popup.openOn(map);
    focusPopupRef.current = popup;

    setTimeout(() => {
      const btn = document.getElementById(`vbtn-dispatch-${vehicle.id}`);
      if (btn) {
        btn.onclick = () => {
          const select = document.getElementById(`vdest-popup-${vehicle.id}`) as HTMLSelectElement;
          if (select) {
            cbRef.current.onDispatchVehicle(vehicle.id, select.value);
            popup.remove();
          }
        };
      }
    }, 100);

    popup.on('remove', () => {
      focusPopupRef.current = null;
      cbRef.current.onVehicleClick(focusedVehicleId);
    });
  }, [focusedVehicleId, simulationRunning, vehicles]);

  return (
    <div
      ref={mapContainerRef}
      className="absolute inset-0 z-0 bg-[#ECEFF1]"
      style={{ cursor: mode === 'editor' ? 'crosshair' : 'default' }}
    />
  );
}
