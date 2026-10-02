import { useState, useCallback } from 'react';
import PlantMapView, { EditorTool } from '../modules/plant-layout/components/PlantMapView';
import PlantControlPanel from '../modules/plant-layout/components/PlantControlPanel';
import IndustrialRadioConsole from '../modules/radio-console/components/IndustrialRadioConsole';
import TrafficAnalyticsDashboard from '../modules/analytics/components/TrafficAnalyticsDashboard';
import { usePlantSimulation } from '../modules/fleet/hooks/usePlantSimulation';
import { NodeType } from '../modules/plant-layout/types';
import { BarChart3, X } from 'lucide-react';
import { assetUrl } from '@/lib/assets';

export default function IndustrialDashboard() {
  const sim = usePlantSimulation();
  const [nodeType, setNodeType] = useState<NodeType>('POI');
  const [editorTool, setEditorTool] = useState<EditorTool>('add_poi');
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<
    | { type: 'node'; id: string; x: number; y: number }
    | { type: 'edge'; id: string; x: number; y: number }
    | null
  >(null);

  const pois = sim.nodes.filter((n) => n.type === 'POI');

  // Manipulador de clique no mapa (Adicionar Ponto)
  const handleMapClick = useCallback((x: number, y: number) => {
    if (sim.mode === 'editor') {
      if (editorTool === 'add_poi') {
        sim.addNode(x, y, 'POI');
      } else if (editorTool === 'add_junction') {
        sim.addNode(x, y, 'Junction');
      }
    }
  }, [sim, editorTool]);

  // Manipulador de clique em nós (Conectar Pontos / Excluir)
  const handleNodeClick = useCallback((id: string) => {
    if (sim.mode === 'editor') {
      if (editorTool === 'connect_nodes') {
        sim.selectNodeForEdge(id);
      } else if (editorTool === 'delete') {
        sim.removeNode(id);
      } else {
        sim.selectNodeForEdge(id);
      }
    }
  }, [sim, editorTool]);

  const handleNodeRightClick = useCallback((id: string) => {
    const ev = window.event as MouseEvent | undefined;
    setContextMenu({ type: 'node', id, x: ev?.clientX ?? 200, y: ev?.clientY ?? 200 });
  }, []);

  // Manipulador de clique em vias (Bloquear / Excluir)
  const handleEdgeClick = useCallback((id: string) => {
    if (sim.mode === 'editor') {
      if (editorTool === 'delete') {
        sim.removeEdge(id);
      } else if (editorTool === 'toggle_block') {
        sim.toggleEdgeBlock(id);
      } else {
        const ev = window.event as MouseEvent | undefined;
        setContextMenu({ type: 'edge', id, x: ev?.clientX ?? 200, y: ev?.clientY ?? 200 });
      }
    } else if (sim.simulationRunning) {
      sim.toggleEdgeBlock(id);
    }
  }, [sim, editorTool]);

  const handleVehicleClick = useCallback((id: string) => {
    sim.setFocusedVehicleId((prev) => (prev === id ? null : id));
  }, [sim]);

  const contextNode = contextMenu?.type === 'node' ? sim.nodes.find((n) => n.id === contextMenu.id) : null;
  const contextEdge = contextMenu?.type === 'edge' ? sim.edges.find((e) => e.id === contextMenu.id) : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F1F5F9] font-sans select-none flex flex-col">
      {/* Clean White Top Bar (Emphasis on RouteMind Logo) */}
      <header className="z-20 relative bg-white px-5 py-2.5 border-b border-slate-200 flex items-center justify-center shadow-2xs">
        <div className="flex items-center gap-3">
          <img
            src={assetUrl('images/routemind-logo.png')}
            alt="RouteMind Fork-lift"
            className="h-9 sm:h-10 object-contain hover:opacity-95 transition-opacity"
          />
        </div>

        <div className="absolute right-5 flex items-center gap-2">
          {/* Botão para abrir indicadores e gráficos analíticos */}
          <button
            onClick={() => setShowAnalyticsModal(true)}
            className="px-3.5 py-1.5 bg-[#051E4B] hover:bg-[#0B2E6F] text-white font-bold text-xs rounded-md shadow-2xs flex items-center gap-1.5 transition-all"
          >
            <BarChart3 className="w-4 h-4 text-[#F49E03]" />
            <span>Indicadores de Tráfego</span>
          </button>
        </div>
      </header>

      {/* Main Map & Interactive Workspace */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        <PlantMapView
          nodes={sim.nodes}
          edges={sim.edges}
          mode={sim.mode}
          editorTool={editorTool}
          selectedNodes={sim.selectedNodes}
          vehicles={sim.vehicles}
          dockTrucks={sim.dockTrucks}
          simulationRunning={sim.simulationRunning}
          focusedVehicleId={sim.focusedVehicleId}
          showHeatmap={sim.showHeatmap}
          edgeTrafficMap={sim.trafficReport.edgeTraffic}
          pois={pois}
          onNodeDragEnd={sim.updateNodePosition}
          onMapClick={handleMapClick}
          onNodeClick={handleNodeClick}
          onNodeRightClick={handleNodeRightClick}
          onEdgeClick={handleEdgeClick}
          onVehicleClick={handleVehicleClick}
          onVehicleArrived={sim.onVehicleArrived}
          onRecalcNeeded={sim.recalculateVehicle}
          onChangeDestination={sim.changeVehicleDestination}
          onDispatchVehicle={sim.dispatchSingleVehicle}
        />

        {/* Retractable Right Control Panel */}
        <div className="absolute top-4 right-4 z-30">
          <PlantControlPanel
            mode={sim.mode}
            setMode={sim.setMode}
            editorTool={editorTool}
            setEditorTool={setEditorTool}
            pois={pois}
            nodeType={nodeType}
            setNodeType={setNodeType}
            showHeatmap={sim.showHeatmap}
            setShowHeatmap={sim.setShowHeatmap}
            vehicles={sim.vehicles}
            simulationRunning={sim.simulationRunning}
            selectedNodes={sim.selectedNodes}
            onAddVehicle={sim.addVehicle}
            onRemoveVehicle={sim.removeVehicle}
            onUpdateVehicle={sim.updateVehicle}
            onDispatchVehicle={sim.dispatchSingleVehicle}
            onStartSimulation={sim.startSimulation}
            onStopSimulation={sim.stopSimulation}
            onResetPlant={sim.resetPlantToDefault}
            onExport={sim.exportMap}
            onImport={sim.importMap}
          />
        </div>

        {/* Retractable Bottom-Left Radio Console */}
        <div className="absolute bottom-4 left-4 z-30">
          <IndustrialRadioConsole logs={sim.logs} onClearLogs={sim.clearLogs} />
        </div>
      </main>

      {/* Modal Analítico de Tráfego e Gargalos */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#F49E03]" />
                <div>
                  <h2 className="text-base font-extrabold text-[#051E4B]">Painel de Tráfego e Gargalos</h2>
                  <p className="text-xs text-slate-500">Mapeamento de fluxo e telemetria da planta</p>
                </div>
              </div>
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <TrafficAnalyticsDashboard
              report={sim.trafficReport}
              vehicles={sim.vehicles}
              nodes={sim.nodes}
              edges={sim.edges}
            />

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="px-4 py-2 bg-[#051E4B] text-white font-bold text-xs rounded-md hover:bg-[#0B2E6F] transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menus */}
      {contextMenu && contextNode && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 clean-panel rounded-md py-1.5 min-w-[200px] text-xs shadow-2xl border border-slate-300"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50">
              <label className="text-[9px] font-bold text-slate-400 uppercase">Nome do Ponto</label>
              <input
                type="text"
                defaultValue={contextNode.name}
                className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[#051E4B] font-bold text-xs w-full outline-none focus:border-[#F49E03]"
                onBlur={(e) => sim.updateNodeName(contextMenu.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    sim.updateNodeName(contextMenu.id, (e.target as HTMLInputElement).value);
                    setContextMenu(null);
                  }
                }}
                autoFocus
              />
            </div>
            <button
              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 font-medium"
              onClick={() => {
                sim.updateNodeType(contextMenu.id, contextNode.type === 'POI' ? 'Junction' : 'POI');
                setContextMenu(null);
              }}
            >
              Alternar para {contextNode.type === 'POI' ? 'Cruzamento/Junção' : 'Ponto de Interesse (POI)'}
            </button>
            <div className="border-t border-slate-200 my-1" />
            <button
              className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 font-bold"
              onClick={() => {
                sim.removeNode(contextMenu.id);
                setContextMenu(null);
              }}
            >
              🗑 Remover Ponto
            </button>
          </div>
        </>
      )}

      {contextMenu && contextEdge && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 clean-panel rounded-md py-1.5 min-w-[200px] text-xs shadow-2xl border border-slate-300"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 font-medium"
              onClick={() => {
                sim.toggleEdgeDirection(contextMenu.id);
                setContextMenu(null);
              }}
            >
              {contextEdge.bidirectional ? '→ Definir como Mão Única' : '↔ Definir como Bidirecional'}
            </button>
            <button
              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 font-medium"
              onClick={() => {
                sim.toggleEdgeBlock(contextMenu.id);
                setContextMenu(null);
              }}
            >
              {contextEdge.isBlocked ? '🟢 Desbloquear Via' : '🔴 Bloquear Via'}
            </button>
            <div className="border-t border-slate-200 my-1" />
            <button
              className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 font-bold"
              onClick={() => {
                sim.removeEdge(contextMenu.id);
                setContextMenu(null);
              }}
            >
              🗑 Remover Via
            </button>
          </div>
        </>
      )}
    </div>
  );
}
