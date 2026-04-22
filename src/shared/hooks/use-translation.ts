import enLocale from '@/locales/en.json';
import esLocale from '@/locales/es.json';
import { useSyncExternalStore } from 'react';

// ── Types ──

export type Locale = 'en' | 'es';
export type TranslatorFn = (key: string, params?: Record<string, string>) => string;

// ── Locale map ──

const LOCALES: Record<Locale, Record<string, unknown>> = {
  en: enLocale,
  es: esLocale,
};

// ── Runtime locale store (module-level, shared across app) ──

let runtimeLocale: Locale = 'en';
const localeListeners = new Set<() => void>();

function normalizeLocale(locale: string | null | undefined): Locale {
  return locale === 'es' ? 'es' : 'en';
}

export function getRuntimeLocale(): Locale {
  return runtimeLocale;
}

export function setRuntimeLocale(locale: Locale): void {
  const normalized = normalizeLocale(locale);
  if (runtimeLocale === normalized) return;
  runtimeLocale = normalized;
  localeListeners.forEach((listener) => listener());
}

export function hydrateRuntimeLocale(locale: string | null | undefined): void {
  setRuntimeLocale(normalizeLocale(locale));
}

export function resetRuntimeLocale(): void {
  runtimeLocale = 'en';
  localeListeners.forEach((listener) => listener());
}

function subscribeRuntimeLocale(listener: () => void): () => void {
  localeListeners.add(listener);
  return () => {
    localeListeners.delete(listener);
  };
}

// ── Dot-notation resolver (pure function) ──

function resolvePath(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : undefined;
}

// ── Interpolation (pure function) ──

function interpolate(template: string, params?: Record<string, string>): string {
  if (!params) return template;
  return template.replace(/\$\{(\w+)\}/g, (match, key: string) => {
    return params[key] ?? match;
  });
}

// ── createTranslator: pure factory, no React dependency ──

export function createTranslator(locale: Locale): TranslatorFn {
  const currentLocale = LOCALES[locale];
  const fallbackLocale = LOCALES['en'];

  return (key: string, params?: Record<string, string>): string => {
    // 1. Try current locale
    const value = resolvePath(currentLocale, key);
    if (value !== undefined) {
      return interpolate(value, params);
    }

    // 2. Fallback to English
    if (locale !== 'en') {
      const fallback = resolvePath(fallbackLocale, key);
      if (fallback !== undefined) {
        return interpolate(fallback, params);
      }
    }

    // 3. Return raw key
    return key;
  };
}

// ── React hook (for component usage) ──
// Note: React context will be added later. Default to 'en' for now.
export function useTranslation(): TranslatorFn {
  const locale = useSyncExternalStore(
    subscribeRuntimeLocale,
    getRuntimeLocale,
    getRuntimeLocale,
  );
  return createTranslator(locale);
}
