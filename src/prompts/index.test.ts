import { describe, it, expect } from 'vitest';
import { weatherPrompt } from './index.js';

describe('weatherPrompt()', () => {
  it('includes the city name in the output', () => {
    const result = weatherPrompt('Burlingame, CA');
    expect(result).toContain('Burlingame, CA');
  });

  it('starts with the expected instruction phrase', () => {
    const result = weatherPrompt('Tokyo');
    expect(result).toMatch(/^Check the current weather for Tokyo\./);
  });

  it('contains the "city:" formatting instruction', () => {
    const city = 'Seattle, WA';
    const result = weatherPrompt(city);
    // The prompt tells the model to begin with "<city>:"
    expect(result).toContain(`"${city}:"`);
  });

  it('mentions appending a one-line summary', () => {
    const result = weatherPrompt('Paris');
    expect(result).toMatch(/append/i);
  });

  it('includes all required condition keywords in the example', () => {
    const result = weatherPrompt('Miami, FL');
    // The prompt embeds an example that mentions each required field.
    // "condition" appears via words like "Foggy" in the example; the word
    // "humidity" and "wind" appear literally.  Temperature is expressed as
    // a °F value rather than the word "temp".
    expect(result).toMatch(/humidity/i);
    expect(result).toMatch(/wind/i);
    // The °F symbol is the canonical temperature indicator in the prompt
    expect(result).toContain('°F');
  });

  it('returns a non-empty string for any city input', () => {
    expect(weatherPrompt('').length).toBeGreaterThan(0);
  });

  it('returns different strings for different cities', () => {
    expect(weatherPrompt('London')).not.toBe(weatherPrompt('Sydney'));
  });

  it('handles city names with special characters', () => {
    // Should not throw and should embed the city as-is
    const city = "Côte d'Ivoire";
    expect(weatherPrompt(city)).toContain(city);
  });
});
