import { useRef, useState } from 'react';
import { PlantNode, NodeType } from '../types';
import { Forklift, ForkliftLoad } from '../../fleet/types';
import { EditorTool } from './PlantMapView';
import { assetUrl } from '@/lib/assets';
import { 
  Play, Square, Plus, Trash2, Download, Upload, Flame, MapPin, 
  RotateCcw, BatteryCharging, Package, Link2, Ban, ChevronRight, ChevronLeft,
  SlidersHorizontal, Send, Navigation
} from 'lucide-react';

export type AppMode = 'editor' | 'simulation';

interface PlantControlPanelProps {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  editorTool: EditorTool;
  setEditorTool: (tool: EditorTool) => void;
  pois: PlantNode[];
  nodeType: NodeType;
  setNodeType: (t: NodeType) => void;
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean | ((prev: boolean) => boolean)) => void;
  vehicles: Forklift[];
  simulationRunning: boolean;
  selectedNodes: string[];
  onAddVehicle: () => void;
  onRemoveVehicle: (id: string) => void;
  onUpdateVehicle: (id: string, field: keyof Forklift, value: Forklift[keyof Forklift]) => void;
  onDispatchVehicle: (vehicleId: string, destId?: string, load?: ForkliftLoad) => void;
  onStartSimulation: () => void;
  onStopSimulation: () => void;
  onResetPlant: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export default function PlantControlPanel({
  mode,
  setMode,
  editorTool,
  setEditorTool,
  pois,
  nodeType,
  setNodeType,
  showHeatmap,
  setShowHeatmap,
  vehicles,
  simulationRunning,
  selectedNodes,
  onAddVehicle,
  onRemoveVehicle,
  onUpdateVehicle,
  onDispatchVehicle,
  onStartSimulation,
  onStopSimulation,
  onResetPlant,
  onExport,
  onImport,
}: PlantControlPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const poiMap = new Map(pois.map((p) => [p.id, p]));

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="clean-panel px-3 py-2 rounded-md shadow-lg border border-slate-200 flex items-center gap-2 text-xs font-bold text-[#051E4B] hover:bg-slate-50 transition-all bg-white/95"
        title="Expandir Painel de Controle"
      >
        <ChevronLeft className="w-4 h-4 text-[#F49E03]" />
        <span>Painel de Controle</span>
      </button>
    );
  }

  return (
    <div className="clean-panel rounded-md p-3.5 w-80 max-h-[calc(100vh-5rem)] overflow-y-auto shadow-xl border border-slate-200 flex flex-col gap-3 text-[#051E4B]">
      {/* Header with Collapse Button */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#F49E03]" />
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#051E4B]">Painel de Controle</h2>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Minimizar painel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
        <button
          onClick={() => setMode('editor')}
          disabled={simulationRunning}
          className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
            mode === 'editor'
              ? 'bg-[#051E4B] text-white shadow-xs'
              : 'text-slate-600 hover:text-[#051E4B] disabled:opacity-50'
          }`}
        >
          Editor de Malha
        </button>
        <button
          onClick={() => setMode('simulation')}
          disabled={simulationRunning}
          className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
            mode === 'simulation'
              ? 'bg-[#051E4B] text-white shadow-xs'
              : 'text-slate-600 hover:text-[#051E4B] disabled:opacity-50'
          }`}
        >
          Simulação
        </button>
      </div>

      {/* Mode: Editor de Malha */}
      {mode === 'editor' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Ferramentas de Edição
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setEditorTool(nodeType === 'POI' ? 'add_poi' : 'add_junction')}
                className={`p-2 rounded-md border text-left flex flex-col gap-1 transition-all ${
                  editorTool === 'add_poi' || editorTool === 'add_junction'
                    ? 'bg-[#051E4B] text-white border-[#051E4B] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <MapPin className={`w-3.5 h-3.5 ${editorTool.startsWith('add_') ? 'text-[#F49E03]' : 'text-slate-500'}`} />
                  <span>1. Criar Ponto</span>
                </div>
                <span className="text-[10px] opacity-80">Clique no mapa</span>
              </button>

              <button
                onClick={() => setEditorTool('connect_nodes')}
                className={`p-2 rounded-md border text-left flex flex-col gap-1 transition-all ${
                  editorTool === 'connect_nodes'
                    ? 'bg-[#051E4B] text-white border-[#051E4B] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Link2 className={`w-3.5 h-3.5 ${editorTool === 'connect_nodes' ? 'text-[#F49E03]' : 'text-slate-500'}`} />
                  <span>2. Juntar Pontos</span>
                </div>
                <span className="text-[10px] opacity-80">Ligar Ponto A ao B</span>
              </button>
            </div>
          </div>

          {(editorTool === 'add_poi' || editorTool === 'add_junction') && (
            <div className="bg-slate-50 p-2 rounded-md border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Tipo do Ponto ao Clicar:</span>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => { setNodeType('POI'); setEditorTool('add_poi'); }}
                  className={`py-1 text-[11px] font-bold rounded border ${
                    nodeType === 'POI' ? 'bg-white text-[#051E4B] border-[#051E4B] shadow-2xs' : 'text-slate-600 border-transparent hover:bg-slate-200'
                  }`}
                >
                  POI (Operacional)
                </button>
                <button
                  onClick={() => { setNodeType('Junction'); setEditorTool('add_junction'); }}
                  className={`py-1 text-[11px] font-bold rounded border ${
                    nodeType === 'Junction' ? 'bg-white text-[#051E4B] border-[#051E4B] shadow-2xs' : 'text-slate-600 border-transparent hover:bg-slate-200'
                  }`}
                >
                  Junção (Cruzamento)
                </button>
              </div>
            </div>
          )}

          {editorTool === 'connect_nodes' && (
            <div className="bg-amber-50 p-2 rounded-md border border-amber-200 text-[11px] text-amber-900 leading-snug">
              {selectedNodes.length === 0 ? (
                <p className="font-semibold">👉 <strong>Passo 1:</strong> Clique no <strong>1º Ponto (Origem)</strong>.</p>
              ) : (
                <p className="font-semibold text-emerald-800">👉 <strong>Passo 2:</strong> Agora clique no <strong>2º Ponto (Destino)</strong> para ligar a via.</p>
              )}
            </div>
          )}

          <div className="p-2 rounded bg-blue-50/60 border border-blue-200 text-[10.5px] text-blue-900">
            💡 <strong>Dica:</strong> Você pode <strong>arrastar qualquer ponto</strong> com o mouse para reposicioná-lo na planta!
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setEditorTool('toggle_block')}
              className={`py-1.5 px-2 text-xs font-bold rounded border flex items-center justify-center gap-1 transition-all ${
                editorTool === 'toggle_block' ? 'bg-red-700 text-white border-red-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Ban className="w-3.5 h-3.5" /> Bloquear Via
            </button>
            <button
              onClick={() => setEditorTool('delete')}
              className={`py-1.5 px-2 text-xs font-bold rounded border flex items-center justify-center gap-1 transition-all ${
                editorTool === 'delete' ? 'bg-red-800 text-white border-red-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir Ponto/Via
            </button>
          </div>

          <div className="border-t border-slate-200 pt-2 flex gap-1.5">
            <button
              onClick={onExport}
              className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] rounded border border-slate-300 flex items-center justify-center gap-1"
            >
              <Download className="w-3 h-3 text-[#051E4B]" /> Exportar
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] rounded border border-slate-300 flex items-center justify-center gap-1"
            >
              <Upload className="w-3 h-3 text-[#051E4B]" /> Importar
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
              }}
            />
          </div>

          <button
            onClick={onResetPlant}
            className="w-full py-1 text-slate-600 hover:text-[#051E4B] font-bold text-[10.5px] flex items-center justify-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Restaurar Layout Padrão
          </button>
        </div>
      )}

      {/* Mode: Simulação */}
      {mode === 'simulation' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 rounded-md bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-1.5">
              <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-[#F49E03]' : 'text-slate-400'}`} />
              <span className="text-[11px] font-bold text-slate-700">Heatmap de Tráfego</span>
            </div>
            <button
              onClick={() => setShowHeatmap((prev) => !prev)}
              className={`px-2 py-0.5 text-[10px] font-extrabold rounded transition-all ${
                showHeatmap ? 'bg-[#F49E03] text-[#051E4B]' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {showHeatmap ? 'LIGADO' : 'DESLIGADO'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Frota de Empilhadeiras ({vehicles.length}/6)
            </span>
            {vehicles.length < 6 && (
              <button
                onClick={onAddVehicle}
                className="px-2 py-0.5 bg-[#051E4B] text-white hover:bg-[#0B2E6F] text-xs font-bold rounded flex items-center gap-1"
              >
                <Plus className="w-3 h-3 text-[#F49E03]" /> Adicionar
              </button>
            )}
          </div>

          {/* Vehicle List with Mission Dispatching */}
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {vehicles.map((v) => {
              const originPoi = poiMap.get(v.originId);
              const isMoving = v.status === 'moving';

              return (
                <div
                  key={v.id}
                  className={`p-2.5 rounded-md border space-y-2 text-xs transition-all ${
                    isMoving ? 'bg-blue-50/40 border-blue-200 shadow-xs' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <img src={assetUrl('images/forklift-topdown.png')} alt="Empilhadeira" className="w-4 h-4 object-contain" />
                      <span className="font-bold text-[#051E4B] text-[11px]">{v.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-0.5">
                        <BatteryCharging className="w-3 h-3 text-[#F49E03]" /> {v.battery}%
                      </span>
                      {!isMoving && (
                        <button
                          onClick={() => onRemoveVehicle(v.id)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Physical Origin Lock & Destination */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] bg-white p-1 rounded border border-slate-200">
                      <span className="font-semibold text-slate-500">📍 Posição Física:</span>
                      <span className="font-bold text-[#051E4B] truncate max-w-[140px]">{originPoi?.name || 'Ponto Operacional'}</span>
                    </div>

                    <div>
                      <label className="text-[8.5px] font-bold text-slate-400 uppercase block">Destino da Missão</label>
                      <select
                        disabled={isMoving}
                        value={v.destinationId}
                        onChange={(e) => onUpdateVehicle(v.id, 'destinationId', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[10.5px] font-medium text-slate-800 disabled:opacity-60"
                      >
                        <option value="">Selecione o destino...</option>
                        {pois.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Load Selection & Speed */}
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200">
                    <div className="flex items-center gap-1 text-slate-700 font-medium">
                      {v.load === 'pallet_plc' && <img src={assetUrl('images/pallet-plc-weg.png')} alt="PLC" className="w-3.5 h-3 object-contain" />}
                      {v.load === 'pallet_motors' && <img src={assetUrl('images/pallet-motors-weg.png')} alt="Motores" className="w-3.5 h-3 object-contain" />}
                      {v.load === 'empty' && <Package className="w-3 h-3 text-slate-400" />}
                      <select
                        disabled={isMoving}
                        value={v.load}
                        onChange={(e) => onUpdateVehicle(v.id, 'load', e.target.value as ForkliftLoad)}
                        className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[9.5px] font-bold text-[#051E4B]"
                      >
                        <option value="empty">Sem Carga (Vazia)</option>
                        <option value="pallet_plc">Palete PLC WEG</option>
                        <option value="pallet_motors">Palete Motores WEG</option>
                      </select>
                    </div>

                    {/* Single Vehicle Dispatch Button */}
                    {!isMoving && v.destinationId && (
                      <button
                        onClick={() => onDispatchVehicle(v.id)}
                        className="px-2 py-1 bg-[#051E4B] hover:bg-[#0B2E6F] text-white font-bold text-[9.5px] rounded flex items-center gap-1 shadow-2xs"
                      >
                        <Send className="w-2.5 h-2.5 text-[#F49E03]" /> Despachar
                      </button>
                    )}

                    {isMoving && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                        ● Em Rota
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="pt-1">
            {!simulationRunning ? (
              <button
                onClick={onStartSimulation}
                disabled={vehicles.length === 0 || vehicles.every((v) => !v.originId || !v.destinationId)}
                className="w-full py-2 bg-[#051E4B] hover:bg-[#0B2E6F] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-xs uppercase tracking-wider rounded-md shadow-sm flex items-center justify-center gap-1.5 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-[#F49E03] text-[#F49E03]" /> Iniciar Simulação Global
              </button>
            ) : (
              <button
                onClick={onStopSimulation}
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-md shadow-sm flex items-center justify-center gap-1.5 transition-all"
              >
                <Square className="w-3.5 h-3.5 fill-white" /> Parar / Resetar Tráfego
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
