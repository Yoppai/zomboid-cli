import React from 'react';
import { describe, it, expect, beforeEach } from 'bun:test';
import { Text } from 'ink';
import { render } from 'ink-testing-library';
import {
  useTranslation,
  setRuntimeLocale,
  resetRuntimeLocale,
} from '@/presentation/hooks/use-translation.ts';

function TranslationProbe() {
  const t = useTranslation();
  return <Text>{t('main_menu.create_server')}</Text>;
}

describe('useTranslation runtime locale', () => {
  beforeEach(() => {
    resetRuntimeLocale();
  });

  it('debe usar locale runtime en lugar de locale fijo', () => {
    setRuntimeLocale('es');
    const { lastFrame } = render(<TranslationProbe />);

    expect(lastFrame()).toContain('Crear Nuevo Servidor');
  });

  it('debe reaccionar a switch de locale ES/EN en runtime', async () => {
    const { lastFrame } = render(<TranslationProbe />);
    expect(lastFrame()).toContain('Create New Server');

    setRuntimeLocale('es');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lastFrame()).toContain('Crear Nuevo Servidor');

    setRuntimeLocale('en');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lastFrame()).toContain('Create New Server');
  });
});
