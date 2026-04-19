import { expect, test, describe } from 'bun:test';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

function getKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getKeys(obj[key], `${prefix}${key}.`));
    } else {
      keys.push(`${prefix}${key}`);
    }
  }
  return keys;
}

describe('i18n Completeness', () => {
  const enKeys = getKeys(en);
  const esKeys = getKeys(es);

  test('Spanish locale has all English keys', () => {
    const missingInEs = enKeys.filter(k => !esKeys.includes(k));
    expect(missingInEs).toEqual([]);
  });

  test('English locale has all Spanish keys', () => {
    const missingInEn = esKeys.filter(k => !enKeys.includes(k));
    expect(missingInEn).toEqual([]);
  });

  test('No empty values in English', () => {
    const emptyKeys = enKeys.filter(k => {
      const parts = k.split('.');
      let val: any = en;
      for (const p of parts) val = val[p];
      return val === '' || val === null;
    });
    expect(emptyKeys).toEqual([]);
  });

  test('No empty values in Spanish', () => {
    const emptyKeys = esKeys.filter(k => {
      const parts = k.split('.');
      let val: any = es;
      for (const p of parts) val = val[p];
      return val === '' || val === null;
    });
    expect(emptyKeys).toEqual([]);
  });
});
