// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { callHomeAssistantService } from './useHomeAssistant';

it('rejects a command when no Home Assistant client exists', async () => {
  await expect(callHomeAssistantService('cover', 'open_cover', {}, { entity_id: 'cover.salon' })).rejects.toThrow('déconnecté');
});
