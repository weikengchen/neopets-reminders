import { describe, expect, it } from 'vitest';
import { applyObservation } from '../../src/shared/generation.js';
import { validateContentMessage } from '../../src/shared/validation.js';
import { syntheticObservation } from '../../src/parsers/training.js';
import { ReminderStore } from '../../src/background/reminder-store.js';
import { createMemoryStorage } from '../helpers/memory-storage.js';
import { classifyTrainingUrl } from '../../src/shared/url-allowlist.js';

const NOW = 1_800_000_000_000;

/**
 * Browserless pipeline: supported URL + validated message → storage write.
 * Wrong query/host/malformed → no write.
 */
describe('content observation pipeline (synthetic)', () => {
  it('supported URL yields validated write', async () => {
    const url =
      'https://www.neopets.com/island/training.phtml?type=status';
    expect(classifyTrainingUrl(url)).toBe('mystery');

    const message = {
      type: 'TRAINING_OBSERVED',
      observations: [
        syntheticObservation({
          petName: 'Synth',
          school: 'mystery',
          observedAt: NOW,
          dueAt: NOW + 60_000,
          state: 'training',
        }),
      ],
    };

    const obs = validateContentMessage(message, url, NOW);
    expect(obs).toHaveLength(1);

    const store = new ReminderStore(createMemoryStorage());
    for (const o of obs!) {
      const result = applyObservation(undefined, o);
      if (result.action === 'upsert') {
        await store.upsertReminder(result.record);
      }
    }
    expect(await store.listReminders()).toHaveLength(1);
  });

  it('wrong query produces no validation', () => {
    const message = {
      type: 'TRAINING_OBSERVED',
      observations: [
        syntheticObservation({
          petName: 'Synth',
          school: 'mystery',
          observedAt: NOW,
          dueAt: NOW + 60_000,
          state: 'training',
        }),
      ],
    };
    expect(
      validateContentMessage(
        message,
        'https://www.neopets.com/island/training.phtml?type=courses',
        NOW,
      ),
    ).toBeNull();
  });

  it('malformed observation rejects whole message', () => {
    const message = {
      type: 'TRAINING_OBSERVED',
      observations: [
        {
          kind: 'training',
          petName: '',
          school: 'mystery',
          observedAt: NOW,
          dueAt: NOW + 1,
          state: 'training',
          parserVersion: 1,
        },
      ],
    };
    expect(
      validateContentMessage(
        message,
        'https://www.neopets.com/island/training.phtml?type=status',
        NOW,
      ),
    ).toBeNull();
  });
});
