import { BinSystem } from './binsystem';
import { Council } from './council';

export type PodConfiguration = 'freestanding' | 'in_drawer' | 'under_sink' | 'none';

export interface User {
    id: string;
    email: string;
    council_id: string;
    bin_system_id: string;
    pod_configuration: PodConfiguration;
    points: number;
    created_at: number;
    updated_at: number;
}

export interface UserResolved {
    id: string;
    email: string;
    council: Council;
    bin_system: BinSystem;
    pod_configuration: PodConfiguration;
    points: number;
    created_at: number;
    updated_at: number;
}
