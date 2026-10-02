export type NodeType = 'POI' | 'Junction';

export type IndustrialZone = 
  | 'CHARGING'
  | 'MAINTENANCE'
  | 'PICKING'
  | 'STORAGE_UPPER'
  | 'STORAGE_LOWER'
  | 'HIGHWAY'
  | 'SHIPPING'
  | 'RECEIVING';

export interface PlantNode {
  id: string;
  name: string;
  x: number; // 0 to 1600 (Planta horizontal)
  y: number; // 0 to 1000 (Planta vertical)
  type: NodeType;
  zone?: IndustrialZone;
  description?: string;
}

export interface PlantEdge {
  id: string;
  from: string;
  to: string;
  bidirectional: boolean;
  isBlocked: boolean;
  distance: number;
  weightMultiplier?: number; // Para zonas de velocidade reduzida ou congestionamento
}

export interface PlantData {
  name: string;
  width: number;
  height: number;
  svgUrl: string;
  nodes: PlantNode[];
  edges: PlantEdge[];
}
