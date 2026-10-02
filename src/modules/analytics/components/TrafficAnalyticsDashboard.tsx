import { useMemo } from 'react';
import { Forklift } from '../../fleet/types';
import { PlantTrafficReport } from '../../routing/traffic-analysis';
import { PlantEdge, PlantNode } from '../../plant-layout/types';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { Activity, AlertOctagon, BatteryCharging, CheckCircle2, Gauge, Zap } from 'lucide-react';

interface TrafficAnalyticsDashboardProps {
  report: PlantTrafficReport;
  vehicles: Forklift[];
  nodes: PlantNode[];
  edges: PlantEdge[];
}

export default function TrafficAnalyticsDashboard({
  report,
  vehicles,
  nodes,
}: TrafficAnalyticsDashboardProps) {
  // Dados para o gráfico de fluxo por zona
  const zoneDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      'Highway': 0,
      'Armazém Superior': 0,
      'Armazém Inferior': 0,
      'Picking': 0,
      'Expedição': 0,
      'Recebimento': 0,
      'Recarga': 0,
    };

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    vehicles.forEach((v) => {
      if (v.status === 'moving' && v.path) {
        v.path.forEach((nid) => {
          const n = nodeMap.get(nid);
          if (!n) return;
          if (n.zone === 'HIGHWAY') counts['Highway']++;
          else if (n.zone === 'STORAGE_UPPER') counts['Armazém Superior']++;
          else if (n.zone === 'STORAGE_LOWER') counts['Armazém Inferior']++;
          else if (n.zone === 'PICKING') counts['Picking']++;
          else if (n.zone === 'SHIPPING') counts['Expedição']++;
          else if (n.zone === 'RECEIVING') counts['Recebimento']++;
          else if (n.zone === 'CHARGING') counts['Recarga']++;
        });
      }
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [vehicles, nodes]);

  // Dados de frota
  const fleetStatusData = useMemo(() => {
    const moving = vehicles.filter((v) => v.status === 'moving').length;
    const idle = vehicles.filter((v) => v.status === 'idle').length;
    const arrived = vehicles.filter((v) => v.status === 'arrived').length;
    const stuck = vehicles.filter((v) => v.status === 'stuck').length;

    return [
      { name: 'Em Trânsito', value: moving, color: '#051E4B' },
      { name: 'Aguardando', value: idle, color: '#64748B' },
      { name: 'Chegou', value: arrived, color: '#16A34A' },
      { name: 'Bloqueado', value: stuck, color: '#DC2626' },
    ].filter((item) => item.value > 0);
  }, [vehicles]);

  const totalTrips = vehicles.reduce((sum, v) => sum + v.tripsCount, 0);
  const avgBattery = vehicles.length > 0 
    ? Math.round(vehicles.reduce((sum, v) => sum + v.battery, 0) / vehicles.length) 
    : 100;

  return (
    <div className="space-y-4 text-[#051E4B]">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Frota em Trânsito</span>
            <Activity className="w-4 h-4 text-[#051E4B]" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-[#051E4B]">{report.totalActiveVehicles}</span>
            <span className="text-[11px] text-slate-500 font-medium">/ {vehicles.length} empilhadeiras</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Gargalos / Vias Críticas</span>
            <AlertOctagon className={`w-4 h-4 ${report.criticalBottlenecks.length > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-xl font-extrabold ${report.criticalBottlenecks.length > 0 ? 'text-amber-600' : 'text-[#051E4B]'}`}>
              {report.criticalBottlenecks.length}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">alertas ativos</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ciclos Concluídos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-emerald-700">{totalTrips}</span>
            <span className="text-[11px] text-slate-500 font-medium">missões entregues</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bateria Média</span>
            <BatteryCharging className="w-4 h-4 text-[#F49E03]" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-[#051E4B]">{avgBattery}%</span>
            <span className="text-[11px] text-slate-500 font-medium">nível operacional</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Gráfico 1: Demanda de Tráfego por Zona Fabril */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-[#F49E03]" />
              <h4 className="text-xs font-bold text-[#051E4B] uppercase tracking-wide">Densidade de Tráfego por Zona</h4>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Contagem de Passagens</span>
          </div>

          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneDistribution} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748B' }} interval={0} />
                <YAxis tick={{ fontSize: 9, fill: '#64748B' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#051E4B', borderRadius: '6px', border: '1px solid #F49E03', color: '#FFF', fontSize: '11px' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {zoneDistribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.name === 'Highway' ? '#F49E03' : '#051E4B'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Status Operacional da Frota */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#051E4B]" />
              <h4 className="text-xs font-bold text-[#051E4B] uppercase tracking-wide">Disponibilidade da Frota</h4>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Tempo Real</span>
          </div>

          <div className="flex-1 flex items-center justify-between gap-2">
            <div className="h-32 w-32 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fleetStatusData.length > 0 ? fleetStatusData : [{ name: 'Sem Veículos', value: 1, color: '#E2E8F0' }]}
                    dataKey="value"
                    innerRadius={30}
                    outerRadius={48}
                    paddingAngle={3}
                  >
                    {(fleetStatusData.length > 0 ? fleetStatusData : [{ name: 'Sem Veículos', value: 1, color: '#E2E8F0' }]).map((entry, index) => (
                      <Cell key={`pie-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 space-y-1 text-xs">
              {fleetStatusData.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-0.5 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 font-medium text-[11px]">{item.name}</span>
                  </div>
                  <span className="font-bold text-[#051E4B] text-[11px]">{item.value} unid.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Gargalos Críticos em Destaque */}
      {report.criticalBottlenecks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertOctagon className="w-4 h-4 text-amber-700" />
            <span className="text-xs font-bold text-amber-900 uppercase">Alertas de Congestionamento / Conflito</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {report.criticalBottlenecks.map((b, idx) => (
              <div key={idx} className="bg-white/80 p-2 rounded border border-amber-300 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">{b.fromName}</span>
                  <span className="mx-1 text-slate-400">↔</span>
                  <span className="font-bold text-slate-800">{b.toName}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-600 text-white">
                  {b.level === 'critical' ? 'CRÍTICO' : 'ELEVADO'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
