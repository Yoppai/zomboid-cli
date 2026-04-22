// ── File Picker Options ──

export interface FilePickerOptions {
  readonly title?: string;
  readonly filters?: readonly string[];
  readonly initialDir?: string;
}

// ── File Picker Gateway Port ──

export interface IFilePickerGateway {
  /** Open native file picker dialog, returns selected file path or null if cancelled */
  pickFile(options?: FilePickerOptions): Promise<string | null>;

  /** Open native directory picker dialog, returns selected directory path or null if cancelled */
  pickDirectory(options?: FilePickerOptions): Promise<string | null>;

  /** Detect which file picker is available on current platform */
  detectPlatform(): 'zenity' | 'kdialog' | 'osascript' | 'powershell' | 'unsupported';
}
