export interface Setting {
  readonly key: string;
  value: string;
}

export type SettingKey = 'locale' | 'backup_path' | 'theme';
