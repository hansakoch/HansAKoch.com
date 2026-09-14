import { atsDomain, classifyAts } from '../ids.ts';

export type Method = 'mobile_web' | 'cf_browser' | 'vultr_vpn' | 'needs_you' | 'manual_packet' | 'unknown';

export function suggestMethod(url: string, atlasRow?: { last_good_method?: string; last_result?: string } | null): Method {
  const domain = atsDomain(url);
  const family = classifyAts(domain);
  if (atlasRow?.last_good_method && atlasRow.last_result === 'ok') {
    return atlasRow.last_good_method as Method;
  }
  if (family === 'linkedin' || family === 'workday') return 'needs_you';
  // Phone Safari can open these. Vultr/Browser Run are optional upgrades, not the core path.
  if (family === 'greenhouse' || family === 'lever' || family === 'ashby') return 'mobile_web';
  if (family === 'indeed') return 'mobile_web';
  return 'mobile_web';
}

export const PROBE_PERSONA = {
  label: 'probe',
  name: 'Joe Logan',
  email: 'joe.logan.probe@example.invalid',
  phone: '+1 000 555 0199',
  note: 'Throwaway probe only. Never Hans identity, never home IP cookies.',
};
