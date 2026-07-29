const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'] as const;
/** Home Assistant gives the wind bearing in degrees; a wall display needs a direction someone can read out loud. */
export const cardinal = (bearing: unknown) => { const degrees = Number(bearing); return Number.isFinite(degrees) ? points[Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16] : undefined; };
/** The number alone means nothing to most people: the level is what tells you to put a hat on. */
export const uvLevel = (value: number | undefined) => value === undefined ? undefined : value < 3 ? { label: 'Faible', tone: 'low' } : value < 6 ? { label: 'Modéré', tone: 'moderate' } : value < 8 ? { label: 'Élevé', tone: 'high' } : value < 11 ? { label: 'Très élevé', tone: 'very-high' } : { label: 'Extrême', tone: 'extreme' };
