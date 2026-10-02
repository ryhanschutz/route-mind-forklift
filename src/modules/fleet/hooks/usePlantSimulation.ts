import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PlantGraph, findPlantPath, euclideanDistance } from '../../routing/engine';
import { PlantNode, PlantEdge, PlantData, NodeType } from '../../plant-layout/types';
import { Forklift, ForkliftLoad, DockTruck } from '../types';
import { IndustrialLog } from '../../radio-console/types';
import { speakIndustrialAlert } from '../../radio-console/voice';
import { createDefaultWarehousePlant } from '../../plant-layout/presets/defaultWarehouse';
import { analyzePlantTraffic, PlantTrafficReport } from '../../routing/traffic-analysis';
import { AppMode } from '../../plant-layout/components/PlantControlPanel';

const VEHICLE_PALETTE = ['#051E4B', '#F49E03', '#0B2E6F', '#D97706', '#1E3A8A', '#B45309'];

export function usePlantSimulation() {
  const defaultPreset = useMemo(() => createDefaultWarehousePlant(), []);
  const graphRef = useRef(new PlantGraph());

  const [nodes, setNodes] = useState<PlantNode[]>(defaultPreset.nodes);
  const [edges, setEdges] = useState<PlantEdge[]>(defaultPreset.edges);
  const [mode, setMode] = useState<AppMode>('simulation');
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [logs, setLogs] = useState<IndustrialLog[]>([]);
  const [vehicles, setVehicles] = useState<Forklift[]>([]);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [focusedVehicleId, setFocusedVehicleId] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);

  // Estado dos 3 Caminhões de Expedição nas Docas
  const [dockTrucks, setDockTrucks] = useState<DockTruck[]>([
    { id: 'truck-s01', dockId: 'doca-s01', dockName: 'Doca 01 (Expedição)', palletsLoaded: 2, maxPallets: 4, status: 'docked', departuresCount: 0 },
    { id: 'truck-s02', dockId: 'doca-s02', dockName: 'Doca 02 (Expedição)', palletsLoaded: 1, maxPallets: 4, status: 'docked', departuresCount: 0 },
    { id: 'truck-s03', dockId: 'doca-s03', dockName: 'Doca 03 (Expedição)', palletsLoaded: 0, maxPallets: 4, status: 'docked', departuresCount: 0 },
  ]);

  // Contador acumulativo de passagens para Heatmap
  const [cumulativePassages, setCumulativePassages] = useState<Map<string, number>>(new Map());

  // Inicializar o grafo com o preset padrão
  useEffect(() => {
    graphRef.current.importData(defaultPreset);
    setNodes(Array.from(graphRef.current.nodes.values()));
    setEdges(Array.from(graphRef.current.edges.values()));

    const initialFleet: Forklift[] = [
      {
        id: crypto.randomUUID(),
        name: 'Empilhadeira 01 (Inbound PLC)',
        code: 'EMP-01',
        color: VEHICLE_PALETTE[0],
        originId: 'doca-r01',
        destinationId: 'est-a3',
        speed: 16,
        battery: 94,
        load: 'pallet_plc',
        path: null,
        pathVersion: 0,
        status: 'idle',
        needsRecalc: false,
        headingAngle: 0,
        totalDistance: 0,
        tripsCount: 0,
      },
      {
        id: crypto.randomUUID(),
        name: 'Empilhadeira 02 (Outbound Motores)',
        code: 'EMP-02',
        color: VEHICLE_PALETTE[1],
        originId: 'est-b2',
        destinationId: 'doca-s02',
        speed: 18,
        battery: 88,
        load: 'pallet_motors',
        path: null,
        pathVersion: 0,
        status: 'idle',
        needsRecalc: false,
        headingAngle: 0,
        totalDistance: 0,
        tripsCount: 0,
      },
      {
        id: crypto.randomUUID(),
        name: 'AGV Autônomo 03 (Linha WEG)',
        code: 'AGV-03',
        color: VEHICLE_PALETTE[2],
        originId: 'pick-02',
        destinationId: 'shp-stage-01',
        speed: 12,
        battery: 97,
        load: 'pallet_motors',
        path: null,
        pathVersion: 0,
        status: 'idle',
        needsRecalc: false,
        headingAngle: 0,
        totalDistance: 0,
        tripsCount: 0,
      },
    ];

    setVehicles(initialFleet);
    addLog('Sistema inicializado com layout industrial RouteMind 4.0', 'info', 'SISTEMA');
  }, []);

  const addLog = useCallback((message: string, type: IndustrialLog['type'] = 'info', source?: string) => {
    setLogs((prev) => [
      { id: crypto.randomUUID(), timestamp: new Date(), message, type, source },
      ...prev.slice(0, 99),
    ]);
  }, []);

  const sync = useCallback(() => {
    setNodes(Array.from(graphRef.current.nodes.values()));
    setEdges(Array.from(graphRef.current.edges.values()));
  }, []);

  // === Mover Ponto / Junção (Drag & Drop) ===
  const updateNodePosition = useCallback((id: string, newX: number, newY: number) => {
    const node = graphRef.current.nodes.get(id);
    if (!node) return;

    node.x = newX;
    node.y = newY;

    // Recalcular distâncias euclidianas de todas as arestas conectadas a este nó
    for (const edge of graphRef.current.edges.values()) {
      if (edge.from === id || edge.to === id) {
        const fromNode = graphRef.current.nodes.get(edge.from);
        const toNode = graphRef.current.nodes.get(edge.to);
        if (fromNode && toNode) {
          edge.distance = euclideanDistance(fromNode.x, fromNode.y, toNode.x, toNode.y);
        }
      }
    }

    sync();
    addLog(`Ponto "${node.name}" reposicionado para [X: ${newX}, Y: ${newY}]`, 'info', 'EDITOR');
  }, [sync, addLog]);

  // === Edição do Grafo / Planta ===

  const addNode = useCallback((x: number, y: number, type: NodeType) => {
    const count = graphRef.current.nodes.size + 1;
    const node: PlantNode = {
      id: crypto.randomUUID(),
      name: type === 'POI' ? `Ponto Operacional ${count}` : `Cruzamento ${count}`,
      x,
      y,
      type,
    };
    graphRef.current.addNode(node);
    sync();
    addLog(`Nó "${node.name}" criado nas coordenadas [X: ${x}, Y: ${y}]`, 'info', 'EDITOR');
  }, [sync, addLog]);

  const removeNode = useCallback((id: string) => {
    const node = graphRef.current.nodes.get(id);
    graphRef.current.removeNode(id);
    sync();
    if (node) addLog(`Nó "${node.name}" removido da malha`, 'warning', 'EDITOR');
  }, [sync, addLog]);

  const selectNodeForEdge = useCallback((id: string) => {
    setSelectedNodes((prev) => {
      if (prev.includes(id)) return prev.filter((n) => n !== id);
      const next = [...prev, id];
      if (next.length === 2) {
        const edge = graphRef.current.addEdge(next[0], next[1], true);
        if (edge) {
          sync();
          const fromName = graphRef.current.nodes.get(next[0])?.name;
          const toName = graphRef.current.nodes.get(next[1])?.name;
          addLog(`Via conectada: ${fromName} ↔ ${toName}`, 'info', 'EDITOR');
        }
        return [];
      }
      return next;
    });
  }, [sync, addLog]);

  const toggleEdgeDirection = useCallback((edgeId: string) => {
    const edge = graphRef.current.edges.get(edgeId);
    if (edge) {
      edge.bidirectional = !edge.bidirectional;
      sync();
      const fromName = graphRef.current.nodes.get(edge.from)?.name;
      const toName = graphRef.current.nodes.get(edge.to)?.name;
      addLog(`Via ${fromName} → ${toName}: alterada para ${edge.bidirectional ? 'Bidirecional' : 'Mão Única'}`, 'info', 'EDITOR');
    }
  }, [sync, addLog]);

  const toggleEdgeBlock = useCallback((edgeId: string) => {
    const edge = graphRef.current.edges.get(edgeId);
    if (!edge) return;
    edge.isBlocked = !edge.isBlocked;
    sync();

    const fromName = graphRef.current.nodes.get(edge.from)?.name;
    const toName = graphRef.current.nodes.get(edge.to)?.name;

    if (edge.isBlocked) {
      addLog(`⚠ OBSTRUÇÃO DETECTADA: Via entre ${fromName} e ${toName} BLOQUEADA!`, 'block', 'TORRE');
      speakIndustrialAlert(`Atenção, via bloqueada entre ${fromName} e ${toName}. Desviando tráfego.`, 'urgent');

      setVehicles((prev) =>
        prev.map((v) => {
          if (v.status !== 'moving' || !v.path) return v;
          for (let i = 0; i < v.path.length - 1; i++) {
            const a = v.path[i];
            const b = v.path[i + 1];
            if (
              (edge.from === a && edge.to === b) ||
              (edge.bidirectional && edge.from === b && edge.to === a)
            ) {
              addLog(`Empilhadeira ${v.code} recalculará rota via A* no próximo cruzamento`, 'warning', v.code);
              return { ...v, needsRecalc: true };
            }
          }
          return v;
        })
      );
    } else {
      addLog(`Via entre ${fromName} e ${toName} DESBLOQUEADA`, 'info', 'TORRE');
      speakIndustrialAlert(`Via liberada entre ${fromName} e ${toName}.`);
    }
  }, [sync, addLog]);

  const removeEdge = useCallback((id: string) => {
    graphRef.current.removeEdge(id);
    sync();
    addLog('Via industrial removida', 'warning', 'EDITOR');
  }, [sync, addLog]);

  const updateNodeName = useCallback((id: string, name: string) => {
    const node = graphRef.current.nodes.get(id);
    if (node) {
      node.name = name;
      sync();
    }
  }, [sync]);

  const updateNodeType = useCallback((id: string, type: NodeType) => {
    const node = graphRef.current.nodes.get(id);
    if (node) {
      node.type = type;
      sync();
    }
  }, [sync]);

  // === Gestão de Frota ===

  const addVehicle = useCallback(() => {
    setVehicles((prev) => {
      if (prev.length >= 6) return prev;
      const num = prev.length + 1;
      const newV: Forklift = {
        id: crypto.randomUUID(),
        name: `Empilhadeira 0${num}`,
        code: `EMP-0${num}`,
        color: VEHICLE_PALETTE[(num - 1) % VEHICLE_PALETTE.length],
        originId: 'doca-r01',
        destinationId: 'est-a1',
        speed: 15,
        battery: 100,
        load: 'empty',
        path: null,
        pathVersion: 0,
        status: 'idle',
        needsRecalc: false,
        headingAngle: 0,
        totalDistance: 0,
        tripsCount: 0,
      };
      addLog(`Nova empilhadeira cadastrada no sistema: ${newV.name}`, 'info', newV.code);
      return [...prev, newV];
    });
  }, [addLog]);

  const removeVehicle = useCallback((id: string) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    if (focusedVehicleId === id) setFocusedVehicleId(null);
  }, [focusedVehicleId]);

  const updateVehicle = useCallback((id: string, field: keyof Forklift, value: Forklift[keyof Forklift]) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  }, []);

  // === Despachar Missão Individual (ou Iniciar Simulação Global) ===

  const dispatchSingleVehicle = useCallback((vehicleId: string, customDestId?: string, customLoad?: ForkliftLoad) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id !== vehicleId) return v;
        const targetDest = customDestId || v.destinationId;
        const targetLoad = customLoad !== undefined ? customLoad : v.load;

        if (!v.originId || !targetDest) return v;

        const result = findPlantPath(graphRef.current, v.originId, targetDest);
        if (result.success) {
          const originName = graphRef.current.nodes.get(v.originId)?.name || 'Origem';
          const destName = graphRef.current.nodes.get(targetDest)?.name || 'Destino';
          addLog(`${v.code}: Nova missão iniciada [${originName} → ${destName}]`, 'route', v.code);
          speakIndustrialAlert(`${v.code} em rota para ${destName}.`);

          // Incrementar passagens no Heatmap
          setCumulativePassages((cur) => {
            const nextMap = new Map(cur);
            for (let i = 0; i < result.path.length - 1; i++) {
              const a = result.path[i];
              const b = result.path[i + 1];
              const edge = Array.from(graphRef.current.edges.values()).find(
                (e) => (e.from === a && e.to === b) || (e.bidirectional && e.from === b && e.to === a)
              );
              if (edge) nextMap.set(edge.id, (nextMap.get(edge.id) || 0) + 1);
            }
            return nextMap;
          });

          return {
            ...v,
            destinationId: targetDest,
            load: targetLoad,
            path: result.path,
            pathVersion: v.pathVersion + 1,
            status: 'moving' as const,
            needsRecalc: false,
          };
        } else {
          addLog(`${v.code}: Nenhuma rota encontrada para ${targetDest}!`, 'block', v.code);
          return { ...v, status: 'stuck' as const };
        }
      })
    );
    setSimulationRunning(true);
  }, [addLog]);

  const startSimulation = useCallback(() => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (!v.originId || !v.destinationId) return v;
        const result = findPlantPath(graphRef.current, v.originId, v.destinationId);
        if (result.success) {
          const originName = graphRef.current.nodes.get(v.originId)?.name || 'Origem';
          const destName = graphRef.current.nodes.get(v.destinationId)?.name || 'Destino';
          addLog(`${v.code}: Rota iniciada [${originName} → ${destName}]`, 'route', v.code);

          setCumulativePassages((cur) => {
            const nextMap = new Map(cur);
            for (let i = 0; i < result.path.length - 1; i++) {
              const a = result.path[i];
              const b = result.path[i + 1];
              const edge = Array.from(graphRef.current.edges.values()).find(
                (e) => (e.from === a && e.to === b) || (e.bidirectional && e.from === b && e.to === a)
              );
              if (edge) nextMap.set(edge.id, (nextMap.get(edge.id) || 0) + 1);
            }
            return nextMap;
          });

          return {
            ...v,
            path: result.path,
            pathVersion: v.pathVersion + 1,
            status: 'moving' as const,
            needsRecalc: false,
          };
        } else {
          addLog(`${v.code}: Sem rota viável encontrada!`, 'block', v.code);
          return { ...v, path: null, status: 'stuck' as const };
        }
      })
    );

    setSimulationRunning(true);
    addLog('▶ Simulação de Tráfego Iniciada', 'info', 'TORRE');
    speakIndustrialAlert('Simulação de tráfego iniciada.');
  }, [addLog]);

  const stopSimulation = useCallback(() => {
    setSimulationRunning(false);
    setFocusedVehicleId(null);
    setVehicles((prev) =>
      prev.map((v) => ({
        ...v,
        path: null,
        status: 'idle' as const,
        needsRecalc: false,
        pathVersion: 0,
      }))
    );
    for (const edge of graphRef.current.edges.values()) {
      edge.isBlocked = false;
    }
    sync();
    addLog('■ Simulação parada — tráfego reiniciado', 'info', 'TORRE');
  }, [sync, addLog]);

  const recalculateVehicle = useCallback((vehicleId: string, fromNodeId: string) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id !== vehicleId) return v;
        const result = findPlantPath(graphRef.current, fromNodeId, v.destinationId);
        if (result.success) {
          const pivotName = graphRef.current.nodes.get(result.path[1])?.name ?? 'Cruzamento';
          addLog(`${v.code}: Rota recalculada com sucesso via ${pivotName}`, 'route', v.code);
          speakIndustrialAlert(`${v.code}, nova rota traçada via ${pivotName}.`);
          return {
            ...v,
            path: result.path,
            pathVersion: v.pathVersion + 1,
            needsRecalc: false,
            status: 'moving' as const,
          };
        } else {
          addLog(`${v.code}: SEM ROTA ALTERNATIVA DISPONÍVEL! Veículo retido.`, 'block', v.code);
          speakIndustrialAlert(`Atenção, ${v.code} sem rota alternativa disponível.`);
          return { ...v, status: 'stuck' as const, needsRecalc: false };
        }
      })
    );
  }, [addLog]);

  // === Chegada ao Destino: Entrega de Palete, Repouso e Sistema de Caminhão ===
  const onVehicleArrived = useCallback((vehicleId: string) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id !== vehicleId || v.status === 'arrived') return v;
        const destName = graphRef.current.nodes.get(v.destinationId)?.name || 'Destino';
        const hadLoad = v.load !== 'empty';
        const loadName = v.load === 'pallet_plc' ? 'Palete PLC WEG' : v.load === 'pallet_motors' ? 'Palete Motores WEG' : 'Carga';

        // 1. Log de entrega
        if (hadLoad) {
          addLog(`✓ ${v.code} descarregou ${loadName} em ${destName}`, 'arrival', v.code);
          speakIndustrialAlert(`${v.code} entregou a carga em ${destName}.`);
        } else {
          addLog(`✓ ${v.code} chegou em repouso a: ${destName}`, 'arrival', v.code);
        }

        // 2. Se o destino for uma das Docas de Expedição (doca-s01, doca-s02, doca-s03) e estava carregada, carregar no caminhão!
        if (['doca-s01', 'doca-s02', 'doca-s03'].includes(v.destinationId) && hadLoad) {
          setDockTrucks((trucks) =>
            trucks.map((truck) => {
              if (truck.dockId !== v.destinationId) return truck;
              const nextPallets = truck.palletsLoaded + 1;

              if (nextPallets >= truck.maxPallets) {
                // Caminhão completou a capacidade! Partir para expedição com animação
                addLog(`🚚 CAMINHÃO DA ${truck.dockName.toUpperCase()} TOTALMENTE CARREGADO (4/4)! Partindo para expedição externa...`, 'info', 'EXPEDIÇÃO');
                speakIndustrialAlert(`Caminhão da ${truck.dockName} totalmente carregado. Partindo para expedição externa.`);

                // Disparar animação de partida e retorno
                setTimeout(() => {
                  setDockTrucks((cur) => cur.map((t) => (t.id === truck.id ? { ...t, status: 'away', palletsLoaded: 0 } : t)));
                  // Após 6 segundos, um novo caminhão vazio chega à doca
                  setTimeout(() => {
                    setDockTrucks((cur) => cur.map((t) => (t.id === truck.id ? { ...t, status: 'arriving' } : t)));
                    setTimeout(() => {
                      setDockTrucks((cur) => cur.map((t) => (t.id === truck.id ? { ...t, status: 'docked', departuresCount: t.departuresCount + 1 } : t)));
                      addLog(`🚚 Novo caminhão vazio atracado na ${truck.dockName}`, 'info', 'EXPEDIÇÃO');
                    }, 1200);
                  }, 5000);
                }, 800);

                return { ...truck, palletsLoaded: nextPallets, status: 'departing' };
              }

              return { ...truck, palletsLoaded: nextPallets };
            })
          );
        }

        // 3. Determinar carga final conforme tipo do destino
        const isPickingLocation = v.destinationId.startsWith('pick') || v.destinationId.startsWith('doca-r');
        const isShippingDock = ['doca-s01', 'doca-s02', 'doca-s03'].includes(v.destinationId);

        let finalLoad: ForkliftLoad;
        if (isPickingLocation && !hadLoad) {
          // Empilhadeira chegou vazia em ponto de coleta → recebe pallet aleatório
          finalLoad = Math.random() > 0.5 ? 'pallet_plc' : 'pallet_motors';
          const pickedName = finalLoad === 'pallet_plc' ? 'Palete PLC WEG' : 'Palete Motores WEG';
          addLog(`📦 ${v.code} coletou ${pickedName} em ${destName}`, 'info', v.code);
          speakIndustrialAlert(`${v.code} coletou carga em ${destName}.`);
        } else if (isShippingDock && hadLoad) {
          finalLoad = 'empty';
        } else if (hadLoad && !isPickingLocation) {
          finalLoad = 'empty'; // Descarrega em qualquer outro destino
        } else {
          finalLoad = v.load; // Mantém o que tem (vazia ou carregada)
        }

        return {
          ...v,
          originId: v.destinationId, // Fixa o ponto de repouso como a nova partida física!
          load: finalLoad,
          status: 'arrived' as const,
          tripsCount: v.tripsCount + 1,
          battery: Math.max(15, v.battery - 3),
        };
      })
    );
  }, [addLog]);

  const changeVehicleDestination = useCallback((vehicleId: string, newDestId: string, fromNodeId: string) => {
    const result = findPlantPath(graphRef.current, fromNodeId, newDestId);
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id !== vehicleId) return v;
        if (result.success) {
          const newDestName = graphRef.current.nodes.get(newDestId)?.name || 'Novo Destino';
          addLog(`${v.code}: Destino alterado para ${newDestName}`, 'route', v.code);
          speakIndustrialAlert(`${v.code}, novo trajeto traçado para ${newDestName}.`);
          return {
            ...v,
            destinationId: newDestId,
            path: result.path,
            pathVersion: v.pathVersion + 1,
            needsRecalc: false,
            status: 'moving' as const,
          };
        } else {
          addLog(`${v.code}: Sem rota viável para o novo destino!`, 'block', v.code);
          return { ...v, destinationId: newDestId, status: 'stuck' as const };
        }
      })
    );
  }, [addLog]);

  const resetPlantToDefault = useCallback(() => {
    const preset = createDefaultWarehousePlant();
    graphRef.current.importData(preset);
    sync();
    setCumulativePassages(new Map());
    addLog('Layout fabril restaurado para a configuração padrão', 'info', 'SISTEMA');
  }, [sync, addLog]);

  const exportMap = useCallback(() => {
    const data = graphRef.current.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'routemind_planta_industrial.json';
    a.click();
    URL.revokeObjectURL(url);
    addLog('Malha da planta exportada: routemind_planta_industrial.json', 'info', 'SISTEMA');
  }, [addLog]);

  const importMap = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data: PlantData = JSON.parse(e.target?.result as string);
        graphRef.current.importData(data);
        sync();
        addLog(`Malha importada com sucesso: ${data.nodes.length} nós, ${data.edges.length} vias`, 'info', 'SISTEMA');
      } catch {
        addLog('Erro ao importar arquivo de malha JSON', 'warning', 'SISTEMA');
      }
    };
    reader.readAsText(file);
  }, [sync, addLog]);

  const trafficReport = useMemo(() => {
    return analyzePlantTraffic(edges, nodes, vehicles, cumulativePassages);
  }, [edges, nodes, vehicles, cumulativePassages]);

  return {
    nodes,
    edges,
    mode,
    setMode,
    selectedNodes,
    logs,
    vehicles,
    dockTrucks,
    simulationRunning,
    focusedVehicleId,
    setFocusedVehicleId,
    showHeatmap,
    setShowHeatmap,
    trafficReport,
    updateNodePosition,
    addNode,
    removeNode,
    selectNodeForEdge,
    toggleEdgeDirection,
    toggleEdgeBlock,
    removeEdge,
    updateNodeName,
    updateNodeType,
    addVehicle,
    removeVehicle,
    updateVehicle,
    dispatchSingleVehicle,
    startSimulation,
    stopSimulation,
    recalculateVehicle,
    onVehicleArrived,
    changeVehicleDestination,
    resetPlantToDefault,
    exportMap,
    importMap,
    clearLogs: () => setLogs([]),
  };
}
