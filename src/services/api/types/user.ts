import { BinSystem } from './binsystem';
import { Council } from './council';

export interface User {
    id: string;
    email: string;
    council_id: string;
    bin_system_id: string;
    points: number;
    created_at: number;
    updated_at: number;
}

export interface UserResolved {
    id: string;
    email: string;
    council: Council;
    bin_system: BinSystem;
    points: number;
    created_at: number;
    updated_at: number;
}
