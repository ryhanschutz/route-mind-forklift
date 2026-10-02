import { PlantNode, PlantEdge, PlantData } from '../plant-layout/types';

export function euclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function calculateHeadingAngle(x1: number, y1: number, x2: number, y2: number): number {
  // Retorna ângulo em graus (0° aponta para direita, 90° para baixo no sistema de coordenadas do SVG/Leaflet)
  const dy = y2 - y1;
  const dx = x2 - x1;
  const rad = Math.atan2(dy, dx);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

export class PlantGraph {
  nodes: Map<string, PlantNode> = new Map();
  edges: Map<string, PlantEdge> = new Map();

  addNode(node: PlantNode) {
    this.nodes.set(node.id, node);
  }

  removeNode(id: string) {
    this.nodes.delete(id);
    for (const [eid, edge] of this.edges) {
      if (edge.from === id || edge.to === id) {
        this.edges.delete(eid);
      }
    }
  }

  addEdge(fromId: string, toId: string, bidirectional: boolean = true): PlantEdge | null {
    const from = this.nodes.get(fromId);
    const to = this.nodes.get(toId);
    if (!from || !to) return null;

    const edge: PlantEdge = {
      id: crypto.randomUUID(),
      from: fromId,
      to: toId,
      bidirectional,
      isBlocked: false,
      distance: euclideanDistance(from.x, from.y, to.x, to.y),
    };
    this.edges.set(edge.id, edge);
    return edge;
  }

  removeEdge(id: string) {
    this.edges.delete(id);
  }

  getNeighbors(nodeId: string): { node: PlantNode; cost: number; edgeId: string }[] {
    const results: { node: PlantNode; cost: number; edgeId: string }[] = [];
    for (const edge of this.edges.values()) {
      if (edge.isBlocked) continue;

      let neighborId: string | null = null;
      if (edge.from === nodeId) neighborId = edge.to;
      else if (edge.bidirectional && edge.to === nodeId) neighborId = edge.from;

      if (neighborId) {
        const n = this.nodes.get(neighborId);
        if (n) {
          const cost = edge.distance * (edge.weightMultiplier ?? 1.0);
          results.push({ node: n, cost, edgeId: edge.id });
        }
      }
    }
    return results;
  }

  exportData(name: string = 'Layout Industrial RouteMind', width: number = 1600, height: number = 1000): PlantData {
    return {
      name,
      width,
      height,
      svgUrl: `${import.meta.env.BASE_URL}images/warehouse_plant.svg`,
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  importData(data: PlantData) {
    this.nodes.clear();
    this.edges.clear();
    data.nodes.forEach((n) => this.nodes.set(n.id, n));
    data.edges.forEach((e) => this.edges.set(e.id, e));
  }
}

// === Algoritmo A* Otimizado para Planta Fabril ===

function heuristic(graph: PlantGraph, aId: string, bId: string): number {
  const a = graph.nodes.get(aId);
  const b = graph.nodes.get(bId);
  if (!a || !b) return Infinity;
  return euclideanDistance(a.x, a.y, b.x, b.y);
}

export function findPlantPath(
  graph: PlantGraph,
  startId: string,
  goalId: string
): { path: string[]; totalCost: number; success: boolean } {
  if (!graph.nodes.has(startId) || !graph.nodes.has(goalId)) {
    return { path: [], totalCost: 0, success: false };
  }

  if (startId === goalId) {
    return { path: [startId], totalCost: 0, success: true };
  }

  const openSet = new Set<string>([startId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startId, 0]]);
  const fScore = new Map<string, number>([[startId, heuristic(graph, startId, goalId)]]);

  while (openSet.size > 0) {
    let current = '';
    let lowestF = Infinity;
    for (const id of openSet) {
      const f = fScore.get(id) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = id;
      }
    }

    if (current === goalId) {
      const path: string[] = [current];
      let c = current;
      while (cameFrom.has(c)) {
        c = cameFrom.get(c)!;
        path.unshift(c);
      }
      return { path, totalCost: gScore.get(goalId) ?? 0, success: true };
    }

    openSet.delete(current);

    for (const { node: neighbor, cost } of graph.getNeighbors(current)) {
      const tentativeG = (gScore.get(current) ?? Infinity) + cost;
      if (tentativeG < (gScore.get(neighbor.id) ?? Infinity)) {
        cameFrom.set(neighbor.id, current);
        gScore.set(neighbor.id, tentativeG);
        fScore.set(neighbor.id, tentativeG + heuristic(graph, neighbor.id, goalId));
        openSet.add(neighbor.id);
      }
    }
  }

  return { path: [], totalCost: 0, success: false };
}
