import { getDef } from './bungieApi';
import type { DestinyInventoryItemDefinition, DestinyPlugSetDefinition } from '../types/bungie';

export function getInventoryItemDefinition(hash: number): Promise<DestinyInventoryItemDefinition | null> {
  return getDef<DestinyInventoryItemDefinition>('DestinyInventoryItemDefinition', hash);
}

export function getPlugSetDefinition(hash: number): Promise<DestinyPlugSetDefinition | null> {
  return getDef<DestinyPlugSetDefinition>('DestinyPlugSetDefinition', hash);
}
