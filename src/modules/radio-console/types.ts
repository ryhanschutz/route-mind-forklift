export type LogSeverity = 'info' | 'warning' | 'route' | 'block' | 'arrival' | 'congestion';

export interface IndustrialLog {
  id: string;
  timestamp: Date;
  message: string;
  type: LogSeverity;
  source?: string; // Ex: EMP-01, TORRE-CONTROLE, SISTEMA
}
