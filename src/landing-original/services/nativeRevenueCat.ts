// UX-PLAY-1: native Android billing bridge. Platform detection uses the
// native_billing_platform Tauri command (never userAgent); every native
// command carries ownerUid/generation and responses are echo-validated.
import { invoke, isTauri } from '@tauri-apps/api/core';

export type NativeBillingSession = { ownerUid: string; generation: number };

const COMMANDS = [
  'configureOwner',
  'quote',
  'purchase',
  'customer',
  'restore',
  'balance',
  'logout',
] as const;

export type NativeBillingCommand = (typeof COMMANDS)[number];

let cachedAndroid: boolean | null = null;

export async function isNativeAndroid(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }
  if (cachedAndroid !== null) {
    return cachedAndroid;
  }
  const platform = await invoke<string>('native_billing_platform');
  if (platform !== 'android' && platform !== 'web') {
    throw new Error(
      `native_billing_platform returned unsupported platform "${String(platform)}"; refusing to guess the billing backend.`,
    );
  }
  const isAndroid = platform === 'android';
  cachedAndroid = isAndroid;
  return isAndroid;
}

function assertSession(session: unknown): NativeBillingSession {
  if (!session || typeof session !== 'object') {
    throw new Error('A native billing session object is required.');
  }
  const candidate = session as { ownerUid?: unknown; generation?: unknown };
  if (typeof candidate.ownerUid !== 'string' || candidate.ownerUid.length === 0) {
    throw new Error('A native billing session requires a non-blank ownerUid.');
  }
  if (
    typeof candidate.generation !== 'number' ||
    !Number.isSafeInteger(candidate.generation) ||
    candidate.generation < 0
  ) {
    throw new Error('A native billing session requires a safe non-negative generation.');
  }
  return { ownerUid: candidate.ownerUid, generation: candidate.generation };
}

function assertEcho(session: NativeBillingSession, response: unknown): Record<string, unknown> {
  if (!response || typeof response !== 'object') {
    throw new Error('The native billing plugin returned a non-object response.');
  }
  const echo = response as { ownerUid?: unknown; generation?: unknown };
  if (echo.ownerUid !== session.ownerUid) {
    throw new Error('The native billing response belongs to a different owner; refusing to use it.');
  }
  if (typeof echo.generation !== 'number' || echo.generation !== session.generation) {
    throw new Error('The native billing response carries a stale generation; refusing to use it.');
  }
  return response as Record<string, unknown>;
}

async function sendCommand(
  session: NativeBillingSession,
  command: NativeBillingCommand,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  if (!COMMANDS.includes(command)) {
    throw new Error(`"${command}" is not an allowed native billing command.`);
  }
  const payload = {
    ownerUid: session.ownerUid,
    generation: session.generation,
    ...extra,
  };
  const response: unknown = await invoke('native_billing', { command, payload });
  return assertEcho(session, response);
}

export function configureNativeOwner(
  session: NativeBillingSession,
  publicKey: string,
): Promise<Record<string, unknown>> {
  return sendCommand(assertSession(session), 'configureOwner', { publicKey });
}

export function quoteNativeOffer(
  session: NativeBillingSession,
  kind: string,
  mapping: {
    publicKey: string;
    offeringIdentifier: string;
    packageIdentifier: string;
    productIdentifier: string;
  },
): Promise<Record<string, unknown>> {
  return sendCommand(assertSession(session), 'quote', { kind, ...mapping });
}

export function purchaseNativeOffer(
  session: NativeBillingSession,
  quoteId: string,
): Promise<Record<string, unknown>> {
  if (typeof quoteId !== 'string' || quoteId.length === 0) {
    return Promise.reject(new Error('A native purchase requires a quote id.'));
  }
  return sendCommand(assertSession(session), 'purchase', { quoteId });
}

export function getNativeCustomer(
  session: NativeBillingSession,
  restore = false,
): Promise<Record<string, unknown>> {
  return sendCommand(assertSession(session), restore ? 'restore' : 'customer');
}

export function getNativeRocheBalance(session: NativeBillingSession): Promise<Record<string, unknown>> {
  return sendCommand(assertSession(session), 'balance');
}

export function logoutNativeOwner(session: NativeBillingSession): Promise<Record<string, unknown>> {
  return sendCommand(assertSession(session), 'logout');
}
