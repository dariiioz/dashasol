import { useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { nameOf } from '../utils/entities';
import type { HassEntity } from '../types/homeAssistant';
/** Resolves the name shown to the user, from an entity or a bare entity id. */
export function useEntityName() { const labels = useAppStore(s => s.labels); return useCallback((entity?: HassEntity | string) => typeof entity === 'string' ? nameOf(labels, undefined, entity) : nameOf(labels, entity), [labels]); }
