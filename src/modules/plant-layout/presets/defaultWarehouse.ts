import { PlantData, PlantNode, PlantEdge } from '../types';
import { euclideanDistance } from '../../routing/engine';

export function createDefaultWarehousePlant(): PlantData {
  const nodes: PlantNode[] = [
    // === RECARGA DE AGVs (CHARGING) ===
    { id: 'ch-01', name: 'Recarga AGV-01', x: 111, y: 126, type: 'POI', zone: 'CHARGING', description: 'Posto de carga rápida 1' },
    { id: 'ch-02', name: 'Recarga AGV-02', x: 183, y: 126, type: 'POI', zone: 'CHARGING', description: 'Posto de carga rápida 2' },
    { id: 'ch-03', name: 'Recarga AGV-03', x: 255, y: 126, type: 'POI', zone: 'CHARGING', description: 'Posto de carga rápida 3' },
    { id: 'j-chg-exit', name: 'Saída Recarga', x: 183, y: 220, type: 'Junction', zone: 'CHARGING' },

    // === MANUTENÇÃO / OFICINA ===
    { id: 'maint-01', name: 'Bancada Manutenção', x: 355, y: 158, type: 'POI', zone: 'MAINTENANCE', description: 'Reparo preventivo' },
    { id: 'maint-box', name: 'Box Reparo Crítico', x: 452, y: 150, type: 'POI', zone: 'MAINTENANCE', description: 'Oficina mecânica' },
    { id: 'j-maint-exit', name: 'Saída Manutenção', x: 406, y: 220, type: 'Junction', zone: 'MAINTENANCE' },

    // === PICKING / CONSOLIDAÇÃO ===
    { id: 'pick-01', name: 'Picking Estação 01', x: 604, y: 127, type: 'POI', zone: 'PICKING' },
    { id: 'pick-02', name: 'Picking Estação 02', x: 759, y: 127, type: 'POI', zone: 'PICKING' },
    { id: 'pick-03', name: 'Picking Estação 03', x: 914, y: 127, type: 'POI', zone: 'PICKING' },
    { id: 'pick-04', name: 'Picking Estação 04', x: 1080, y: 127, type: 'POI', zone: 'PICKING' },
    { id: 'j-pick-01', name: 'Acesso Pick-01', x: 604, y: 220, type: 'Junction', zone: 'PICKING' },
    { id: 'j-pick-02', name: 'Acesso Pick-02', x: 759, y: 220, type: 'Junction', zone: 'PICKING' },
    { id: 'j-pick-03', name: 'Acesso Pick-03', x: 914, y: 220, type: 'Junction', zone: 'PICKING' },
    { id: 'j-pick-04', name: 'Acesso Pick-04', x: 1080, y: 220, type: 'Junction', zone: 'PICKING' },

    // === CORREDORES SUPERIORES (TOP AISLES & RACKS) ===
    { id: 'a1-top', name: 'Topo Corredor 01', x: 150, y: 220, type: 'Junction', zone: 'STORAGE_UPPER' },
    { id: 'est-a1', name: 'Estoque Rack A-01', x: 150, y: 365, type: 'POI', zone: 'STORAGE_UPPER' },
    { id: 'a2-top', name: 'Topo Corredor 02', x: 292, y: 220, type: 'Junction', zone: 'STORAGE_UPPER' },
    { id: 'est-a2', name: 'Estoque Rack A-02', x: 292, y: 365, type: 'POI', zone: 'STORAGE_UPPER' },
    { id: 'a3-top', name: 'Topo Corredor 03', x: 434, y: 220, type: 'Junction', zone: 'STORAGE_UPPER' },
    { id: 'est-a3', name: 'Estoque Rack A-03', x: 434, y: 365, type: 'POI', zone: 'STORAGE_UPPER' },
    { id: 'a4-top', name: 'Topo Corredor 04', x: 576, y: 220, type: 'Junction', zone: 'STORAGE_UPPER' },
    { id: 'est-a4', name: 'Estoque Rack A-04', x: 576, y: 365, type: 'POI', zone: 'STORAGE_UPPER' },
    { id: 'a5-top', name: 'Topo Corredor 05', x: 718, y: 220, type: 'Junction', zone: 'STORAGE_UPPER' },
    { id: 'est-a5', name: 'Estoque Rack A-05', x: 718, y: 365, type: 'POI', zone: 'STORAGE_UPPER' },
    { id: 'a6-top', name: 'Topo Corredor 06', x: 860, y: 220, type: 'Junction', zone: 'STORAGE_UPPER' },
    { id: 'est-a6', name: 'Estoque Rack A-06', x: 860, y: 365, type: 'POI', zone: 'STORAGE_UPPER' },
    { id: 'a7-top', name: 'Topo Corredor 07', x: 1002, y: 220, type: 'Junction', zone: 'STORAGE_UPPER' },
    { id: 'est-a7', name: 'Estoque Rack A-07', x: 1002, y: 365, type: 'POI', zone: 'STORAGE_UPPER' },
    { id: 'a8-top', name: 'Topo Corredor 08', x: 1144, y: 220, type: 'Junction', zone: 'STORAGE_UPPER' },
    { id: 'est-a8', name: 'Estoque Rack A-08', x: 1144, y: 365, type: 'POI', zone: 'STORAGE_UPPER' },

    // === FORKLIFT HIGHWAY (MAIN ARTERY NODES, Y = 551) ===
    { id: 'hw-01', name: 'Highway Cruzamento 01', x: 150, y: 551, type: 'Junction', zone: 'HIGHWAY' },
    { id: 'hw-02', name: 'Highway Cruzamento 02', x: 292, y: 551, type: 'Junction', zone: 'HIGHWAY' },
    { id: 'hw-03', name: 'Highway Cruzamento 03', x: 434, y: 551, type: 'Junction', zone: 'HIGHWAY' },
    { id: 'hw-04', name: 'Highway Cruzamento 04', x: 576, y: 551, type: 'Junction', zone: 'HIGHWAY' },
    { id: 'hw-05', name: 'Highway Cruzamento 05', x: 718, y: 551, type: 'Junction', zone: 'HIGHWAY' },
    { id: 'hw-06', name: 'Highway Cruzamento 06', x: 860, y: 551, type: 'Junction', zone: 'HIGHWAY' },
    { id: 'hw-07', name: 'Highway Cruzamento 07', x: 1002, y: 551, type: 'Junction', zone: 'HIGHWAY' },
    { id: 'hw-08', name: 'Highway Cruzamento 08', x: 1144, y: 551, type: 'Junction', zone: 'HIGHWAY' },
    { id: 'hw-east', name: 'Highway Acesso Expedição', x: 1240, y: 551, type: 'Junction', zone: 'HIGHWAY' },

    // === CORREDORES INFERIORES (BOTTOM AISLES & RACKS) ===
    { id: 'est-b1', name: 'Estoque Rack B-01', x: 576, y: 760, type: 'POI', zone: 'STORAGE_LOWER' },
    { id: 'a9-bot', name: 'Fim Corredor 09', x: 576, y: 934, type: 'Junction', zone: 'STORAGE_LOWER' },
    { id: 'est-b2', name: 'Estoque Rack B-02', x: 718, y: 760, type: 'POI', zone: 'STORAGE_LOWER' },
    { id: 'a10-bot', name: 'Fim Corredor 10', x: 718, y: 934, type: 'Junction', zone: 'STORAGE_LOWER' },
    { id: 'est-b3', name: 'Estoque Rack B-03', x: 860, y: 760, type: 'POI', zone: 'STORAGE_LOWER' },
    { id: 'a11-bot', name: 'Fim Corredor 11', x: 860, y: 934, type: 'Junction', zone: 'STORAGE_LOWER' },
    { id: 'est-b4', name: 'Estoque Rack B-04', x: 1002, y: 760, type: 'POI', zone: 'STORAGE_LOWER' },
    { id: 'a12-bot', name: 'Fim Corredor 12', x: 1002, y: 934, type: 'Junction', zone: 'STORAGE_LOWER' },
    { id: 'est-b5', name: 'Estoque Rack B-05', x: 1144, y: 760, type: 'POI', zone: 'STORAGE_LOWER' },
    { id: 'a13-bot', name: 'Fim Corredor 13', x: 1144, y: 934, type: 'Junction', zone: 'STORAGE_LOWER' },

    // === RECEBIMENTO (RECEIVING) ===
    { id: 'doca-r01', name: 'Doca Recebimento 01', x: 145, y: 677, type: 'POI', zone: 'RECEIVING', description: 'Descarga Inbound carreta 1' },
    { id: 'doca-r02', name: 'Doca Recebimento 02', x: 145, y: 767, type: 'POI', zone: 'RECEIVING', description: 'Descarga Inbound carreta 2' },
    { id: 'doca-r03', name: 'Doca Recebimento 03', x: 145, y: 857, type: 'POI', zone: 'RECEIVING', description: 'Descarga Inbound carreta 3' },
    { id: 'rcv-stage', name: 'Staging Recebimento', x: 337, y: 700, type: 'POI', zone: 'RECEIVING', description: 'Inspeção e triagem' },
    { id: 'rcv-buffer', name: 'Buffer Pallets Entrada', x: 337, y: 835, type: 'POI', zone: 'RECEIVING' },
    { id: 'j-rcv-main', name: 'Corredor Recebimento', x: 450, y: 767, type: 'Junction', zone: 'RECEIVING' },

    // === EXPEDIÇÃO (SHIPPING) ===
    { id: 'doca-s01', name: 'Doca Expedição 01', x: 1442, y: 170, type: 'POI', zone: 'SHIPPING', description: 'Carregamento Outbound 1' },
    { id: 'doca-s02', name: 'Doca Expedição 02', x: 1442, y: 330, type: 'POI', zone: 'SHIPPING', description: 'Carregamento Outbound 2' },
    { id: 'doca-s03', name: 'Doca Expedição 03', x: 1442, y: 490, type: 'POI', zone: 'SHIPPING', description: 'Carregamento Outbound 3' },
    { id: 'shp-stage-01', name: 'Staging Expedição Norte', x: 1275, y: 160, type: 'POI', zone: 'SHIPPING' },
    { id: 'shp-stage-02', name: 'Staging Expedição Centro', x: 1275, y: 390, type: 'POI', zone: 'SHIPPING' },
    { id: 'shp-buffer', name: 'Buffer Saída Pallets', x: 1370, y: 800, type: 'POI', zone: 'SHIPPING' },
    { id: 'j-shp-01', name: 'Pátio Doca S-01', x: 1350, y: 170, type: 'Junction', zone: 'SHIPPING' },
    { id: 'j-shp-02', name: 'Pátio Doca S-02', x: 1350, y: 330, type: 'Junction', zone: 'SHIPPING' },
    { id: 'j-shp-03', name: 'Pátio Doca S-03', x: 1350, y: 490, type: 'Junction', zone: 'SHIPPING' },
    { id: 'j-shp-south', name: 'Pátio Expedição Sul', x: 1350, y: 680, type: 'Junction', zone: 'SHIPPING' },
  ];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Helper para conectar nós
  const rawEdges: [string, string, boolean][] = [
    // Recarga
    ['ch-01', 'j-chg-exit', true],
    ['ch-02', 'j-chg-exit', true],
    ['ch-03', 'j-chg-exit', true],
    ['j-chg-exit', 'a1-top', true],
    ['j-chg-exit', 'a2-top', true],

    // Manutenção
    ['maint-01', 'j-maint-exit', true],
    ['maint-box', 'j-maint-exit', true],
    ['j-maint-exit', 'a2-top', true],
    ['j-maint-exit', 'a3-top', true],

    // Top Circulation Way (Aisle tops connection)
    ['a1-top', 'a2-top', true],
    ['a2-top', 'a3-top', true],
    ['a3-top', 'a4-top', true],
    ['a4-top', 'j-pick-01', true],
    ['j-pick-01', 'a5-top', true],
    ['a5-top', 'j-pick-02', true],
    ['j-pick-02', 'a6-top', true],
    ['a6-top', 'j-pick-03', true],
    ['j-pick-03', 'a7-top', true],
    ['a7-top', 'j-pick-04', true],
    ['j-pick-04', 'a8-top', true],

    // Picking bays connection
    ['pick-01', 'j-pick-01', true],
    ['pick-02', 'j-pick-02', true],
    ['pick-03', 'j-pick-03', true],
    ['pick-04', 'j-pick-04', true],

    // Upper Aisles vertical paths (Top to Highway via Stock POIs)
    ['a1-top', 'est-a1', true],
    ['est-a1', 'hw-01', true],
    ['a2-top', 'est-a2', true],
    ['est-a2', 'hw-02', true],
    ['a3-top', 'est-a3', true],
    ['est-a3', 'hw-03', true],
    ['a4-top', 'est-a4', true],
    ['est-a4', 'hw-04', true],
    ['a5-top', 'est-a5', true],
    ['est-a5', 'hw-05', true],
    ['a6-top', 'est-a6', true],
    ['est-a6', 'hw-06', true],
    ['a7-top', 'est-a7', true],
    ['est-a7', 'hw-07', true],
    ['a8-top', 'est-a8', true],
    ['est-a8', 'hw-08', true],

    // FORKLIFT HIGHWAY (Main horizontal artery)
    ['hw-01', 'hw-02', true],
    ['hw-02', 'hw-03', true],
    ['hw-03', 'hw-04', true],
    ['hw-04', 'hw-05', true],
    ['hw-05', 'hw-06', true],
    ['hw-06', 'hw-07', true],
    ['hw-07', 'hw-08', true],
    ['hw-08', 'hw-east', true],

    // Lower Aisles vertical paths (Highway to Bottom via Stock POIs)
    ['hw-04', 'est-b1', true],
    ['est-b1', 'a9-bot', true],
    ['hw-05', 'est-b2', true],
    ['est-b2', 'a10-bot', true],
    ['hw-06', 'est-b3', true],
    ['est-b3', 'a11-bot', true],
    ['hw-07', 'est-b4', true],
    ['est-b4', 'a12-bot', true],
    ['hw-08', 'est-b5', true],
    ['est-b5', 'a13-bot', true],

    // Bottom horizontal perimeter
    ['a9-bot', 'a10-bot', true],
    ['a10-bot', 'a11-bot', true],
    ['a11-bot', 'a12-bot', true],
    ['a12-bot', 'a13-bot', true],

    // Receiving Connections
    ['hw-03', 'j-rcv-main', true],
    ['doca-r01', 'rcv-stage', true],
    ['doca-r02', 'rcv-stage', true],
    ['doca-r03', 'rcv-buffer', true],
    ['rcv-stage', 'j-rcv-main', true],
    ['rcv-buffer', 'j-rcv-main', true],
    ['hw-01', 'doca-r01', true],

    // Shipping Connections
    ['hw-east', 'shp-stage-02', true],
    ['hw-east', 'j-shp-02', true],
    ['shp-stage-01', 'j-shp-01', true],
    ['shp-stage-02', 'j-shp-02', true],
    ['j-shp-01', 'doca-s01', true],
    ['j-shp-02', 'doca-s02', true],
    ['j-shp-03', 'doca-s03', true],
    ['j-shp-01', 'j-shp-02', true],
    ['j-shp-02', 'j-shp-03', true],
    ['j-shp-03', 'j-shp-south', true],
    ['j-shp-south', 'shp-buffer', true],
    ['a8-top', 'shp-stage-01', true],
    ['a13-bot', 'shp-buffer', true],
  ];

  const edges: PlantEdge[] = rawEdges.map(([fromId, toId, bidirectional]) => {
    const from = nodeMap.get(fromId)!;
    const to = nodeMap.get(toId)!;
    return {
      id: crypto.randomUUID(),
      from: fromId,
      to: toId,
      bidirectional,
      isBlocked: false,
      distance: euclideanDistance(from.x, from.y, to.x, to.y),
    };
  });

  return {
    name: 'Layout Industrial RouteMind — Centro Logístico Integrado',
    width: 1600,
    height: 1000,
    svgUrl: `${import.meta.env.BASE_URL}images/warehouse_plant.svg`,
    nodes,
    edges,
  };
}
