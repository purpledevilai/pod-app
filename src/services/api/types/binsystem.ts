export interface Bin {
    id: string;
    acceptsCardboard: boolean;
    acceptsContainers: boolean;
    acceptsFood: boolean;
    acceptsGarbage: boolean;
    acceptsGarden: boolean;
    acceptsGlass: boolean;
    acceptsSoftPlastics: boolean;
    appearance: string;
    extras: string[];
    type: string;
}

export interface BinSystem {
    id: string;
    bins: Bin[];
}