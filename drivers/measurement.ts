import { Operation } from './solis';

export interface Measurement {
    value: string;
    scale: number;
    operation: Operation;
    capability: string;
    computedValue: string | number;
}
