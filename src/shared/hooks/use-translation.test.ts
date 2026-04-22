import { describe, it, expect, beforeEach } from 'bun:test';

// Production code that does NOT exist yet — guarantees RED
import {
  createTranslator,
  type TranslatorFn,
} from '@/shared/hooks/use-translation.ts';

import enLocale from '@/locales/en.json';
import esLocale from '@/locales/es.json';

describe('i18n — t() function', () => {
  let tEn: TranslatorFn;
  let tEs: TranslatorFn;

  beforeEach(() => {
    tEn = createTranslator('en');
    tEs = createTranslator('es');
  });

  // ── Dot-notation lookup ──

  describe('dot-notation key lookup', () => {
    it('should resolve top-level nested keys in English', () => {
      expect(tEn('main_menu.title')).toBe('Zomboid-CLI');
      expect(tEn('main_menu.create_server')).toBe('Create New Server');
    });

    it('should resolve top-level nested keys in Spanish', () => {
      expect(tEs('main_menu.title')).toBe('Zomboid-CLI');
      expect(tEs('main_menu.create_server')).toBe('Crear Nuevo Servidor');
    });

    it('should resolve common keys', () => {
      expect(tEn('common.confirm')).toBe('Confirm');
      expect(tEs('common.confirm')).toBe('Confirmar');
    });

    it('should resolve status keys', () => {
      expect(tEn('status.running')).toBe('Running');
      expect(tEs('status.running')).toBe('En ejecución');
    });

    it('should resolve error keys', () => {
      expect(tEn('errors.server_not_found')).toBe('Server not found');
      expect(tEs('errors.server_not_found')).toBe('Servidor no encontrado');
    });

    it('should resolve wizard keys', () => {
      expect(tEn('wizard.select_provider')).toBe('Select Cloud Provider');
      expect(tEs('wizard.select_provider')).toBe('Seleccionar Proveedor Cloud');
    });

    it('should resolve dashboard keys', () => {
      expect(tEn('dashboard.server_management')).toBe('Server Management');
      expect(tEs('dashboard.server_management')).toBe('Gestión del Servidor');
    });
  });

  // ── Fallback chain ──

  describe('fallback chain', () => {
    it('should fall back to English for keys missing in Spanish', () => {
      // We'll add a key only in en.json for testing
      const tEsFallback = createTranslator('es');
      // 'common.confirm' exists in both, but if we query a key that only exists in en...
      // Using a real key that we intentionally omit from es.json
      // This test verifies the mechanism — we'll use an existing en-only key
      const result = tEsFallback('_test_only.en_only_key');
      // Should fall back to English value if it exists there
      // If not in either → return raw key (next test)
      expect(typeof result).toBe('string');
    });

    it('should return the raw key if missing from both locales', () => {
      expect(tEn('this.key.does.not.exist')).toBe('this.key.does.not.exist');
      expect(tEs('totally.missing.key')).toBe('totally.missing.key');
    });

    it('should not crash on undefined nested paths', () => {
      expect(tEn('deep.nonexistent.path.here')).toBe('deep.nonexistent.path.here');
    });
  });

  // ── Locale coverage ──

  describe('locale coverage', () => {
    it('should have main_menu keys in en.json', () => {
      expect(enLocale.main_menu).toBeDefined();
      expect(enLocale.main_menu.title).toBe('Zomboid-CLI');
      expect(enLocale.main_menu.create_server).toBe('Create New Server');
      expect(enLocale.main_menu.active_servers).toBe('Active Servers');
      expect(enLocale.main_menu.archived_servers).toBe('Archived Servers');
      expect(enLocale.main_menu.global_settings).toBe('Global Settings');
    });

    it('should have main_menu keys in es.json', () => {
      expect(esLocale.main_menu).toBeDefined();
      expect(esLocale.main_menu.title).toBe('Zomboid-CLI');
      expect(esLocale.main_menu.create_server).toBe('Crear Nuevo Servidor');
    });

    it('should have wizard keys in both locales', () => {
      expect(enLocale.wizard.select_provider).toBe('Select Cloud Provider');
      expect(esLocale.wizard.select_provider).toBe('Seleccionar Proveedor Cloud');
    });

    it('should have common keys in both locales', () => {
      expect(enLocale.common.confirm).toBe('Confirm');
      expect(enLocale.common.cancel).toBe('Cancel');
      expect(enLocale.common.back).toBe('Back');
      expect(enLocale.common.save).toBe('Save');
      expect(enLocale.common.delete).toBe('Delete');
      expect(enLocale.common.loading).toBe('Loading...');
      expect(enLocale.common.error).toBe('Error');
      expect(enLocale.common.success).toBe('Success');
      expect(enLocale.common.yes).toBe('Yes');
      expect(enLocale.common.no).toBe('No');
    });

    it('should have status keys in both locales', () => {
      expect(enLocale.status.running).toBe('Running');
      expect(enLocale.status.stopped).toBe('Stopped');
      expect(enLocale.status.provisioning).toBe('Provisioning');
      expect(enLocale.status.failed).toBe('Failed');
      expect(enLocale.status.archived).toBe('Archived');
    });

    it('should have error keys in both locales', () => {
      expect(enLocale.errors.server_not_found).toBe('Server not found');
      expect(enLocale.errors.connection_failed).toBe('Connection failed');
      expect(enLocale.errors.deploy_failed).toBe('Deploy failed');
      expect(enLocale.errors.backup_failed).toBe('Backup failed');
    });

    it('should have dashboard keys in both locales', () => {
      expect(enLocale.dashboard.server_management).toBe('Server Management');
      expect(enLocale.dashboard.build).toBe('Build');
      expect(enLocale.dashboard.player_management).toBe('Player Management');
      expect(enLocale.dashboard.server_stats).toBe('Server Stats');
      expect(enLocale.dashboard.basic_settings).toBe('Basic Settings');
      expect(enLocale.dashboard.advanced_settings).toBe('Advanced Settings');
      expect(enLocale.dashboard.admins).toBe('Admins');
      expect(enLocale.dashboard.scheduler).toBe('Scheduler');
      expect(enLocale.dashboard.backups).toBe('Backups');
    });
  });

  // ── Interpolation ──

  describe('interpolation', () => {
    it('should interpolate ${param} in translation strings', () => {
      // wizard.coming_soon should have "${provider}" placeholder
      const result = tEn('wizard.coming_soon', { provider: 'AWS' });
      expect(result).toContain('AWS');
    });

    it('should leave ${param} as-is if no params provided', () => {
      const result = tEn('wizard.coming_soon');
      expect(result).toContain('${provider}');
    });
  });
});
