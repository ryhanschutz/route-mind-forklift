import { PlantEdge, PlantNode } from '../plant-layout/types';
import { Forklift } from '../fleet/types';

export interface EdgeTrafficStat {
  edgeId: string;
  passageCount: number;
  currentVehicles: number;
  saturationLevel: 'low' | 'medium' | 'high' | 'critical';
  saturationPercent: number;
}

export interface IntersectionStat {
  nodeId: string;
  nodeName: string;
  conflictRisk: 'normal' | 'caution' | 'critical';
  nearbyVehiclesCount: number;
}

export interface PlantTrafficReport {
  totalActiveVehicles: number;
  busyEdgesCount: number;
  blockedEdgesCount: number;
  criticalBottlenecks: { fromName: string; toName: string; level: string; vehicleCount: number }[];
  highRiskIntersections: IntersectionStat[];
  edgeTraffic: Map<string, EdgeTrafficStat>;
}

export function analyzePlantTraffic(
  edges: PlantEdge[],
  nodes: PlantNode[],
  vehicles: Forklift[],
  cumulativePassages: Map<string, number>
): PlantTrafficReport {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgeTraffic = new Map<string, EdgeTrafficStat>();

  // Contagem de veículos trafegando atualmente em cada aresta
  const activeVehiclesOnEdge = new Map<string, number>();

  vehicles.forEach((v) => {
    if (v.status !== 'moving' || !v.path || v.path.length < 2) return;
    // Para cada segmento da rota do veículo
    for (let i = 0; i < v.path.length - 1; i++) {
      const a = v.path[i];
      const b = v.path[i + 1];
      const edge = edges.find(
        (e) => (e.from === a && e.to === b) || (e.bidirectional && e.from === b && e.to === a)
      );
      if (edge) {
        activeVehiclesOnEdge.set(edge.id, (activeVehiclesOnEdge.get(edge.id) || 0) + 1);
      }
    }
  });

  const criticalBottlenecks: PlantTrafficReport['criticalBottlenecks'] = [];

  edges.forEach((edge) => {
    const currentOnEdge = activeVehiclesOnEdge.get(edge.id) || 0;
    const passages = cumulativePassages.get(edge.id) || 0;
    
    // Nível de saturação: mais de 2 veículos planejados ou mais de 8 passagens acumuladas
    let saturationPercent = Math.min(100, Math.round((currentOnEdge * 35) + (passages * 5)));
    let saturationLevel: EdgeTrafficStat['saturationLevel'] = 'low';

    if (edge.isBlocked) {
      saturationLevel = 'critical';
      saturationPercent = 100;
    } else if (currentOnEdge >= 2 || passages >= 15) {
      saturationLevel = 'critical';
    } else if (currentOnEdge === 1 || passages >= 8) {
      saturationLevel = 'high';
    } else if (passages >= 3) {
      saturationLevel = 'medium';
    }

    edgeTraffic.set(edge.id, {
      edgeId: edge.id,
      passageCount: passages,
      currentVehicles: currentOnEdge,
      saturationLevel,
      saturationPercent,
    });

    if (saturationLevel === 'critical' || saturationLevel === 'high') {
      const fromName = nodeMap.get(edge.from)?.name || 'Nó A';
      const toName = nodeMap.get(edge.to)?.name || 'Nó B';
      criticalBottlenecks.push({
        fromName,
        toName,
        level: saturationLevel,
        vehicleCount: currentOnEdge,
      });
    }
  });

  // Análise de cruzamentos / interseções (nós com múltiplos veículos próximos)
  const highRiskIntersections: IntersectionStat[] = [];
  nodes.forEach((node) => {
    if (node.type !== 'Junction') return;
    let nearby = 0;
    vehicles.forEach((v) => {
      if (v.status === 'moving' && v.path?.includes(node.id)) {
        nearby++;
      }
    });

    if (nearby >= 2) {
      highRiskIntersections.push({
        nodeId: node.id,
        nodeName: node.name,
        conflictRisk: nearby >= 3 ? 'critical' : 'caution',
        nearbyVehiclesCount: nearby,
      });
    }
  });

  const blockedCount = edges.filter((e) => e.isBlocked).length;
  const busyCount = Array.from(edgeTraffic.values()).filter((stat) => stat.currentVehicles > 0).length;

  return {
    totalActiveVehicles: vehicles.filter((v) => v.status === 'moving').length,
    busyEdgesCount: busyCount,
    blockedEdgesCount: blockedCount,
    criticalBottlenecks,
    highRiskIntersections,
    edgeTraffic,
  };
}
