export const weatherPrompt = (city: string) =>
  `Check the current weather for ${city}. ` +
  `Append a concise one-line summary starting with the city name — e.g. "San Francisco, CA: Foggy, 58°F, feels like 55°F, humidity 85%, wind 12 mph." ` +
  `Always begin with "${city}:" followed by the conditions.`;
