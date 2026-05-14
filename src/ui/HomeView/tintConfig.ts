import { z } from 'zod';
import { parseData } from '../../game/data';
import raw from '../../../data/home-tints.json';

export type TimeOfDay = 'morning' | 'midday' | 'dusk' | 'night';
export type Weather = 'clear' | 'rain' | 'snow';

const TintEntrySchema = z.object({
  color: z.string(),
  opacity: z.number().min(0).max(1),
});

const WeatherMapSchema = z.object({
  clear: TintEntrySchema,
  rain: TintEntrySchema,
  snow: TintEntrySchema,
});

const ZoneSchema = z.object({
  top: z.number().min(0).max(1),
  left: z.number().min(0).max(1),
});

const PulseDotSchema = z.object({
  size: z.number().positive(),
  color: z.string(),
  minOpacity: z.number().min(0).max(1),
  maxOpacity: z.number().min(0).max(1),
  durationMs: z.number().positive(),
});

const HomeTintsSchema = z.object({
  tints: z.object({
    morning: WeatherMapSchema,
    midday: WeatherMapSchema,
    dusk: WeatherMapSchema,
    night: WeatherMapSchema,
  }),
  pulseZones: z.object({
    sales: ZoneSchema,
    service: ZoneSchema,
    bdc: ZoneSchema,
    office: ZoneSchema,
    lot: ZoneSchema,
  }),
  pulseDot: PulseDotSchema,
});

export type HomeTintsConfig = z.infer<typeof HomeTintsSchema>;

let _config: HomeTintsConfig | null = null;

export function loadHomeTints(): HomeTintsConfig {
  if (!_config) {
    _config = parseData(raw, HomeTintsSchema, 'home-tints');
  }
  return _config;
}

export function getTint(
  config: HomeTintsConfig,
  timeOfDay: TimeOfDay,
  weather: Weather
): { color: string; opacity: number } {
  return config.tints[timeOfDay][weather];
}
