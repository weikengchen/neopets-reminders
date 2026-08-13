import { describe, expect, it } from 'vitest';
import {
  buildTrainingReminderId,
  parseStoredState,
  SchemaVersionError,
  validateContentMessage,
  validateTrainingObservation,
} from '../../src/shared/validation.js';

const NOW = 1_700_000_000_000;

describe('buildTrainingReminderId', () => {
  it('normalizes NFKC, lowercases en-US, encodeURIComponent', () => {
    const id = buildTrainingReminderId('mystery', '  Fluffy  ');
    expect(id).toBe('training:mystery:fluffy');
  });

  it('caps length and rejects empty', () => {
    expect(buildTrainingReminderId('pirate', '')).toBeNull();
    expect(buildTrainingReminderId('pirate', 'x'.repeat(65))).toBeNull();
  });
});

describe('validateTrainingObservation', () => {
  it('accepts valid training observation', () => {
    const obs = validateTrainingObservation(
      {
        kind: 'training',
        petName: 'Aisha',
        school: 'ninja',
        observedAt: NOW,
        dueAt: NOW + 3_600_000,
        state: 'training',
        parserVersion: 1,
      },
      NOW,
      'ninja',
    );
    expect(obs?.petName).toBe('Aisha');
  });

  it('rejects school mismatch and huge dueAt', () => {
    expect(
      validateTrainingObservation(
        {
          kind: 'training',
          petName: 'Aisha',
          school: 'pirate',
          observedAt: NOW,
          dueAt: NOW + 3_600_000,
          state: 'training',
          parserVersion: 1,
        },
        NOW,
        'ninja',
      ),
    ).toBeNull();

    expect(
      validateTrainingObservation(
        {
          kind: 'training',
          petName: 'Aisha',
          school: 'ninja',
          observedAt: NOW,
          dueAt: NOW + 40 * 24 * 60 * 60 * 1000,
          state: 'training',
          parserVersion: 1,
        },
        NOW,
      ),
    ).toBeNull();
  });
});

describe('validateContentMessage', () => {
  it('requires allowlisted sender URL and matching school', () => {
    const msg = {
      type: 'TRAINING_OBSERVED',
      observations: [
        {
          kind: 'training',
          petName: 'Pet',
          school: 'mystery',
          observedAt: NOW,
          dueAt: NOW + 1000,
          state: 'training',
          parserVersion: 1,
        },
      ],
    };
    expect(
      validateContentMessage(
        msg,
        'https://www.neopets.com/island/training.phtml?type=status',
        NOW,
      ),
    ).toHaveLength(1);

    expect(
      validateContentMessage(
        msg,
        'https://www.neopets.com/pirates/academy.phtml?type=status',
        NOW,
      ),
    ).toBeNull();
  });
});

describe('parseStoredState', () => {
  it('merges defaults', () => {
    const s = parseStoredState(null);
    expect(s.schemaVersion).toBe(1);
    expect(s.settings.trainingEnabled).toBe(true);
  });

  it('throws on newer schema and does not invent data', () => {
    expect(() =>
      parseStoredState({ schemaVersion: 99, reminders: {}, settings: {} }),
    ).toThrow(SchemaVersionError);
  });
});
