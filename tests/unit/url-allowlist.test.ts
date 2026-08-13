import { describe, expect, it } from 'vitest';
import {
  canonicalTrainingUrl,
  classifyTrainingUrl,
} from '../../src/shared/url-allowlist.js';

describe('url allowlist', () => {
  it('classifies exact status URLs', () => {
    expect(
      classifyTrainingUrl(
        'https://www.neopets.com/pirates/academy.phtml?type=status',
      ),
    ).toBe('pirate');
    expect(
      classifyTrainingUrl(
        'https://www.neopets.com/island/training.phtml?type=status',
      ),
    ).toBe('mystery');
    expect(
      classifyTrainingUrl(
        'https://www.neopets.com/island/fight_training.phtml?type=status',
      ),
    ).toBe('ninja');
  });

  it('rejects wrong host, scheme, path, or query', () => {
    expect(
      classifyTrainingUrl('http://www.neopets.com/pirates/academy.phtml?type=status'),
    ).toBeNull();
    expect(
      classifyTrainingUrl(
        'https://neopets.com/pirates/academy.phtml?type=status',
      ),
    ).toBeNull();
    expect(
      classifyTrainingUrl(
        'https://www.neopets.com/pirates/academy.phtml?type=courses',
      ),
    ).toBeNull();
    expect(
      classifyTrainingUrl('https://evil.example/pirates/academy.phtml?type=status'),
    ).toBeNull();
  });

  it('builds canonical URLs from school enum only', () => {
    expect(canonicalTrainingUrl('pirate')).toBe(
      'https://www.neopets.com/pirates/academy.phtml?type=status',
    );
    expect(canonicalTrainingUrl('mystery')).toBe(
      'https://www.neopets.com/island/training.phtml?type=status',
    );
    expect(canonicalTrainingUrl('ninja')).toBe(
      'https://www.neopets.com/island/fight_training.phtml?type=status',
    );
  });
});
