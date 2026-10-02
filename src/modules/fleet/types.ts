export type ForkliftStatus = 'idle' | 'moving' | 'arrived' | 'stuck' | 'charging';

export type ForkliftLoad = 'empty' | 'pallet_plc' | 'pallet_motors';

export interface Forklift {
  id: string;
  name: string;
  code: string; // Ex: EMP-01, AGV-04
  color: string;
  originId: string;
  destinationId: string;
  speed: number; // Velocidade operacional (5 a 25 km/h)
  battery: number; // 0 a 100%
  load: ForkliftLoad;
  path: string[] | null;
  pathVersion: number;
  status: ForkliftStatus;
  needsRecalc: boolean;
  headingAngle: number; // Ângulo angular em graus (0 a 360°)
  totalDistance: number; // Metros percorridos
  tripsCount: number;
}

export type TruckStatus = 'docked' | 'departing' | 'away' | 'arriving';

export interface DockTruck {
  id: string;
  dockId: string;
  dockName: string;
  palletsLoaded: number;
  maxPallets: number;
  status: TruckStatus;
  departuresCount: number;
}
