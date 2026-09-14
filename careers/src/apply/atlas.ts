import { atsDomain, classifyAts } from '../ids.ts';

export type Method = 'mobile_web' | 'needs_you' | 'manual_packet' | 'unknown';

/** Legacy atlas labels — always route to phone Safari after approve. */
const LEGACY_METHODS = new Set(['vultr_vpn', 'cf_browser']);

export function normalizeMethod(method?: string | null): Method {
  if (!method || method === 'unknown' || LEGACY_METHODS.has(method)) return 'mobile_web';
  if (method === 'needs_you' || method === 'manual_packet') return method as Method;
  return 'mobile_web';
}

export function suggestMethod(url: string, atlasRow?: { last_good_method?: string; last_result?: string } | null): Method {
  const domain = atsDomain(url);
  const family = classifyAts(domain);
  if (atlasRow?.last_good_method && atlasRow.last_result === 'ok') {
    return normalizeMethod(atlasRow.last_good_method);
  }
  // Core path: iPhone Safari. VPN/VNC/Browser Run are not used.
  if (family === 'linkedin' || family === 'workday' || family === 'indeed') return 'mobile_web';
  if (family === 'greenhouse' || family === 'lever' || family === 'ashby') return 'mobile_web';
  return 'mobile_web';
}

export const PROBE_PERSONA = {
  label: 'probe',
  name: 'Joe Logan',
  email: 'joe.logan.probe@example.invalid',
  phone: '+1 000 555 0199',
  note: 'Throwaway probe only. Never Hans identity, never home IP cookies.',
};
