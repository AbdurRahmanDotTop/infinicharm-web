import { describe, it } from 'node:test';
import assert from 'node:assert';
import { cn } from '../../src/lib/utils/cn.ts';

describe('Design System Tokens & Utility Invariants', () => {
  it('combines class names and resolves tailwind conflicts using clsx + twMerge', () => {
    const result = cn('bg-primary text-white', 'p-4', undefined, false, 'text-accent');
    assert.ok(result.includes('bg-primary'));
    assert.ok(result.includes('p-4'));
    assert.ok(result.includes('text-accent'));
    assert.ok(!result.includes('text-white')); // Overridden by text-accent
  });

  it('handles empty and conditional values gracefully', () => {
    const result = cn('', null, undefined, false, 'rounded-md');
    assert.strictEqual(result, 'rounded-md');
  });
});

