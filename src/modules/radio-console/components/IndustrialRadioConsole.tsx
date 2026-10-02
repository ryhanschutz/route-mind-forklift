import { useState, useRef, useEffect } from 'react';
import { IndustrialLog, LogSeverity } from '../types';
import { Volume2, VolumeX, Trash2, Radio, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { isVoiceEnabled, setVoiceEnabled } from '../voice';

interface IndustrialRadioConsoleProps {
  logs: IndustrialLog[];
  onClearLogs?: () => void;
}

const severityBadgeStyles: Record<LogSeverity, { text: string; bg: string; border: string }> = {
  info: { text: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
  warning: { text: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-300' },
  route: { text: 'text-blue-900', bg: 'bg-blue-50', border: 'border-blue-200' },
  block: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300' },
  arrival: { text: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  congestion: { text: 'text-orange-800', bg: 'bg-orange-50', border: 'border-orange-300' },
};

export default function IndustrialRadioConsole({ logs, onClearLogs }: IndustrialRadioConsoleProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filter, setFilter] = useState<'all' | 'route' | 'block'>('all');
  const [voiceActive, setVoiceActive] = useState(isVoiceEnabled());
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggleVoice = () => {
    const next = !voiceActive;
    setVoiceActive(next);
    setVoiceEnabled(next);
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'route') return log.type === 'route' || log.type === 'arrival';
    if (filter === 'block') return log.type === 'block' || log.type === 'warning';
    return true;
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs]);

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="clean-panel px-3 py-1.5 rounded-md shadow-md border border-slate-200 flex items-center gap-2 text-xs font-bold text-[#051E4B] hover:bg-slate-50 transition-all bg-white/95"
      >
        <Radio className="w-3.5 h-3.5 text-[#F49E03] animate-pulse" />
        <span>Console de Rádio ({logs.length})</span>
        <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-1" />
      </button>
    );
  }

  return (
    <div className="clean-panel rounded-md overflow-hidden shadow-lg border border-slate-200 flex flex-col h-52 w-72 sm:w-80 bg-white/95 text-[#051E4B]">
      {/* Header */}
      <div className="bg-[#051E4B] px-3 py-2 flex items-center justify-between text-white select-none">
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-[#F49E03]" />
          <h3 className="text-xs font-bold tracking-wide uppercase text-white">Console Operacional</h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleVoice}
            title={voiceActive ? 'Silenciar Áudio' : 'Ativar Voz'}
            className={`p-1 rounded text-xs transition-colors ${
              voiceActive ? 'bg-[#F49E03] text-[#051E4B]' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {voiceActive ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
          </button>
          {onClearLogs && (
            <button
              onClick={onClearLogs}
              title="Limpar logs"
              className="p-1 rounded text-xs bg-slate-800 text-slate-400 hover:text-red-300"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(true)}
            title="Minimizar console"
            className="p-1 rounded text-xs bg-slate-800 text-slate-400 hover:text-white ml-0.5"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 px-2 py-0.5 gap-1 text-[10px] font-bold text-slate-600">
        <button
          onClick={() => setFilter('all')}
          className={`px-1.5 py-0.5 rounded ${filter === 'all' ? 'bg-[#051E4B] text-white' : 'hover:bg-slate-200'}`}
        >
          Todos ({logs.length})
        </button>
        <button
          onClick={() => setFilter('route')}
          className={`px-1.5 py-0.5 rounded ${filter === 'route' ? 'bg-[#051E4B] text-white' : 'hover:bg-slate-200'}`}
        >
          Rotas
        </button>
        <button
          onClick={() => setFilter('block')}
          className={`px-1.5 py-0.5 rounded ${filter === 'block' ? 'bg-red-700 text-white' : 'hover:bg-slate-200'}`}
        >
          Bloqueios
        </button>
      </div>

      {/* Logs Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[10px]">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 font-sans italic text-[11px]">
            Aguardando eventos...
          </div>
        ) : (
          filteredLogs.map((log) => {
            const style = severityBadgeStyles[log.type] || severityBadgeStyles.info;
            return (
              <div
                key={log.id}
                className={`p-1.5 rounded border ${style.bg} ${style.border} flex items-start gap-1.5 leading-tight`}
              >
                <span className="text-[9px] text-slate-400 font-bold shrink-0">
                  {log.timestamp.toLocaleTimeString('pt-BR')}
                </span>

                {log.source && (
                  <span className="px-1 py-0.2 rounded text-[8.5px] font-black uppercase tracking-wider bg-[#051E4B] text-[#F49E03] shrink-0">
                    {log.source}
                  </span>
                )}

                <div className={`flex-1 font-medium ${style.text}`}>
                  {log.type === 'block' && <AlertTriangle className="w-3 h-3 inline mr-1 text-red-600 mb-0.5" />}
                  {log.message}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
