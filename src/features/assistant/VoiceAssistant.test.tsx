// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HassEntity } from '../../types/homeAssistant';
const { callService } = vi.hoisted(() => ({ callService: vi.fn().mockResolvedValue([]) }));
vi.mock('../../hooks/useHomeAssistant', () => ({ getHomeAssistantClient: () => ({ callService }), useHomeAssistant: () => undefined }));
const { useAppStore } = await import('../../stores/appStore');
const { VoiceAssistant } = await import('./VoiceAssistant');
const entity = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({ entity_id, state, attributes, last_changed: '', last_updated: '' });
const answers = (...bodies: unknown[]) => { const fetcher = vi.fn(); bodies.forEach(body => fetcher.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body } as Response)); vi.stubGlobal('fetch', fetcher); return fetcher; };
const toolCall = (name: string, args: Record<string, unknown>) => ({ choices: [{ message: { content: null, tool_calls: [{ id: 'call-1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] });
const said = (content: string) => ({ choices: [{ message: { content } }] });
const house = (assistant: Record<string, unknown> = { apiKey: 'sk-or-v1-test', model: 'deepseek/deepseek-chat', voice: false }) => useAppStore.setState({ configured: true, demo: false, entities: { 'cover.volet_salon': entity('cover.volet_salon', 'open', { current_position: 70 }) }, dashboard: { temperatureEntities: [], climateEntities: [], coverEntities: [{ entityId: 'cover.volet_salon', enabled: true, order: 0 }], mediaEntities: [], updateEntities: [] }, mapping: {}, labels: { 'cover.volet_salon': 'Volet du salon' }, assistant });
const open = () => fireEvent.click(screen.getByRole('button', { name: /Parler à la maison/ }));
/** The answer is revealed word by word, so it lives in one span per word: read the whole block rather than a single node. */
const spoken = (text: string) => waitFor(() => expect(document.querySelector('.assistant-answer')?.textContent?.trim()).toBe(text));
const write = (question: string) => { fireEvent.change(screen.getByLabelText('Écrire une demande'), { target: { value: question } }); fireEvent.click(screen.getByRole('button', { name: 'Envoyer' })); };
/** Vitest runs without globals here, so React Testing Library never registers its own automatic cleanup. */
afterEach(() => { cleanup(); vi.unstubAllGlobals(); callService.mockClear(); });
describe('voice assistant', () => {
  it('turns a spoken request into a Home Assistant service call and says what it did', async () => {
    house(); answers(toolCall('set_cover_position', { entity_id: 'cover.volet_salon', position: 0 }), said('C’est fermé.'));
    render(<VoiceAssistant />); open(); write('ferme le volet du salon');
    await waitFor(() => expect(callService).toHaveBeenCalledWith('cover', 'close_cover', {}, { entity_id: 'cover.volet_salon' }));
    await spoken('C’est fermé.');
  });
  it('sends the state of the selected equipment so a question can be answered without acting', async () => {
    house(); const fetcher = answers(said('Le volet du salon est ouvert aux trois quarts.'));
    render(<VoiceAssistant />); open(); write('où en est le volet ?');
    await spoken('Le volet du salon est ouvert aux trois quarts.');
    const body = JSON.parse(String((fetcher.mock.calls[0]![1] as RequestInit).body)) as { messages: { role: string; content: string }[] };
    expect(body.messages[0]!.content).toContain('- cover.volet_salon « Volet du salon » : ouvert à 70 %');
    expect(callService).not.toHaveBeenCalled();
  });
  it('refuses an invented entity instead of forwarding it to the house', async () => {
    house(); answers(toolCall('set_cover_position', { entity_id: 'cover.garage', position: 0 }), said('Le volet du garage n’est pas disponible ici.'));
    render(<VoiceAssistant />); open(); write('ferme le volet du garage');
    await spoken('Le volet du garage n’est pas disponible ici.');
    expect(callService).not.toHaveBeenCalled();
  });
  it('sends the household to the settings rather than a dead microphone when no key is stored', () => {
    house({}); render(<VoiceAssistant />); open();
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir les Réglages/ }));
    expect(useAppStore.getState().activePage).toBe('settings');
  });
});
