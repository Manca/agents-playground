import { describe, it, expect } from 'vitest';
import { calculate, calculatorToolAnthropic, calculatorToolOpenAI } from './calculator.js';

// ---------------------------------------------------------------------------
// calculate() — pure arithmetic function
// ---------------------------------------------------------------------------

describe('calculate()', () => {
  describe('add', () => {
    it('adds two positive integers', () => {
      expect(calculate('add', 2, 3)).toBe(5);
    });

    it('adds negative numbers', () => {
      expect(calculate('add', -1, -4)).toBe(-5);
    });

    it('adds zero to a number', () => {
      expect(calculate('add', 42, 0)).toBe(42);
    });

    it('adds floats', () => {
      // Floating-point arithmetic — use approximate equality
      expect(calculate('add', 0.1, 0.2)).toBeCloseTo(0.3);
    });
  });

  describe('subtract', () => {
    it('subtracts two positive integers', () => {
      expect(calculate('subtract', 10, 4)).toBe(6);
    });

    it('produces a negative result when b > a', () => {
      expect(calculate('subtract', 3, 7)).toBe(-4);
    });

    it('subtracts zero from a number', () => {
      expect(calculate('subtract', 99, 0)).toBe(99);
    });
  });

  describe('multiply', () => {
    it('multiplies two positive integers', () => {
      expect(calculate('multiply', 6, 7)).toBe(42);
    });

    it('multiplying by zero yields zero', () => {
      expect(calculate('multiply', 12345, 0)).toBe(0);
    });

    it('multiplies negative numbers — negative × negative = positive', () => {
      expect(calculate('multiply', -3, -4)).toBe(12);
    });

    it('multiplies positive by negative', () => {
      expect(calculate('multiply', 5, -3)).toBe(-15);
    });
  });

  describe('divide', () => {
    it('divides evenly', () => {
      expect(calculate('divide', 10, 2)).toBe(5);
    });

    it('returns a float for non-even division', () => {
      expect(calculate('divide', 1, 3)).toBeCloseTo(0.3333, 4);
    });

    it('divides a negative numerator', () => {
      expect(calculate('divide', -9, 3)).toBe(-3);
    });

    it('divides by zero — JavaScript returns Infinity', () => {
      // This is a known edge case: the function does NOT guard against division
      // by zero and returns Infinity (positive or negative) or NaN for 0/0.
      expect(calculate('divide', 5, 0)).toBe(Infinity);
      expect(calculate('divide', -5, 0)).toBe(-Infinity);
      expect(calculate('divide', 0, 0)).toBeNaN();
    });
  });

  describe('unknown operation', () => {
    it('throws an error for an unsupported operation', () => {
      expect(() => calculate('modulo', 10, 3)).toThrowError('Unknown operation: modulo');
    });

    it('throws an error for an empty string operation', () => {
      expect(() => calculate('', 1, 2)).toThrowError('Unknown operation: ');
    });
  });
});

// ---------------------------------------------------------------------------
// Tool schema shapes — smoke-test that exports are well-formed
// ---------------------------------------------------------------------------

describe('calculatorToolOpenAI schema', () => {
  it('has type "function"', () => {
    expect(calculatorToolOpenAI.type).toBe('function');
  });

  it('has the correct function name', () => {
    expect(calculatorToolOpenAI.function.name).toBe('calculate');
  });

  it('lists all four required fields', () => {
    expect(calculatorToolOpenAI.function.parameters?.required).toEqual(
      expect.arrayContaining(['operation', 'a', 'b']),
    );
  });

  it('operation property has the four enum values', () => {
    const props = calculatorToolOpenAI.function.parameters?.properties as Record<string, { enum?: string[] }>;
    expect(props.operation.enum).toEqual(['add', 'subtract', 'multiply', 'divide']);
  });
});

describe('calculatorToolAnthropic schema', () => {
  it('has the correct name', () => {
    expect(calculatorToolAnthropic.name).toBe('calculate');
  });

  it('has an input_schema with type "object"', () => {
    expect(calculatorToolAnthropic.input_schema.type).toBe('object');
  });

  it('lists required fields', () => {
    expect(calculatorToolAnthropic.input_schema.required).toEqual(
      expect.arrayContaining(['operation', 'a', 'b']),
    );
  });
});
