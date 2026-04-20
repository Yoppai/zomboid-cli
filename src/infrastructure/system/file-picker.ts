import type {
  IFilePickerGateway,
  FilePickerOptions,
} from '@/domain/repositories/i-file-picker-gateway.ts';

// ── Spawn result type ──

interface SpawnResult {
  readonly stdout: string;
  readonly exitCode: number;
}

// ── Injectable options for testability ──

export interface FilePickerDeps {
  /** Override process.platform for testing */
  platform?: NodeJS.Platform;
  /** Check if a command exists on PATH */
  whichFn?: (cmd: string) => Promise<string | null>;
  /** Spawn a command and capture output */
  spawnFn?: (cmd: string, args: string[]) => Promise<SpawnResult>;
  /** Pre-resolved availability flags for synchronous detectPlatform */
  zenityAvailable?: boolean;
  kdialogAvailable?: boolean;
}

// ── Default implementations ──

async function defaultWhich(cmd: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(['which', cmd], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const text = await new Response(proc.stdout).text();
    const code = await proc.exited;
    return code === 0 ? text.trim() : null;
  } catch {
    return null;
  }
}

async function defaultSpawn(
  cmd: string,
  args: string[],
): Promise<SpawnResult> {
  const proc = Bun.spawn([cmd, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  return { stdout, exitCode };
}

// ── System File Picker ──

/**
 * Multi-platform native file picker that implements IFilePickerGateway.
 *
 * - Linux: zenity or kdialog
 * - macOS: osascript (AppleScript)
 * - Windows: PowerShell OpenFileDialog
 * - Fallback: returns null (unsupported)
 */
export class SystemFilePicker implements IFilePickerGateway {
  private readonly platform: NodeJS.Platform;
  private readonly whichFn: (cmd: string) => Promise<string | null>;
  private readonly spawnFn: (cmd: string, args: string[]) => Promise<SpawnResult>;
  private readonly zenityAvailable: boolean | undefined;
  private readonly kdialogAvailable: boolean | undefined;

  constructor(deps?: FilePickerDeps) {
    this.platform = deps?.platform ?? process.platform;
    this.whichFn = deps?.whichFn ?? defaultWhich;
    this.spawnFn = deps?.spawnFn ?? defaultSpawn;
    this.zenityAvailable = deps?.zenityAvailable;
    this.kdialogAvailable = deps?.kdialogAvailable;
  }

  /**
   * Detect which file picker is available on the current platform.
   * Returns synchronously using pre-resolved availability flags.
   */
  detectPlatform(): 'zenity' | 'kdialog' | 'osascript' | 'powershell' | 'unsupported' {
    switch (this.platform) {
      case 'win32':
        return 'powershell';
      case 'darwin':
        return 'osascript';
      case 'linux': {
        if (this.zenityAvailable === true) return 'zenity';
        if (this.zenityAvailable === false && this.kdialogAvailable === true) return 'kdialog';
        if (this.zenityAvailable === false && this.kdialogAvailable === false) return 'unsupported';
        // Default: assume zenity (will be checked at runtime in pickFile)
        return 'zenity';
      }
      default:
        return 'unsupported';
    }
  }

  /**
   * Open native file picker dialog.
   * Returns selected file path or null if cancelled / unsupported.
   */
  async pickFile(options?: FilePickerOptions): Promise<string | null> {
    const pickerType = this.detectPlatform();

    if (pickerType === 'unsupported') {
      return null;
    }

    try {
      let result: SpawnResult;

      switch (pickerType) {
        case 'zenity':
          result = await this.spawnZenity(options);
          break;
        case 'kdialog':
          result = await this.spawnKdialog(options);
          break;
        case 'osascript':
          result = await this.spawnOsascript(options);
          break;
        case 'powershell':
          result = await this.spawnPowershell(options);
          break;
      }

      if (result.exitCode !== 0) {
        return null;
      }

      const path = result.stdout.trim();
      return path.length > 0 ? path : null;
    } catch {
      return null;
    }
  }

  /**
   * Open native directory picker dialog.
   * Returns selected directory path or null if cancelled / unsupported.
   */
  async pickDirectory(options?: FilePickerOptions): Promise<string | null> {
    const pickerType = this.detectPlatform();

    if (pickerType === 'unsupported') {
      return null;
    }

    try {
      let result: SpawnResult;

      switch (pickerType) {
        case 'zenity':
          result = await this.spawnZenityDirectory(options);
          break;
        case 'kdialog':
          result = await this.spawnKdialogDirectory(options);
          break;
        case 'osascript':
          result = await this.spawnOsascriptDirectory(options);
          break;
        case 'powershell':
          result = await this.spawnPowershellDirectory(options);
          break;
      }

      if (result.exitCode !== 0) {
        return null;
      }

      const selectedPath = result.stdout.trim();
      return selectedPath.length > 0 ? selectedPath : null;
    } catch {
      return null;
    }
  }

  // ── Platform-specific spawn helpers ──

  private async spawnZenity(options?: FilePickerOptions): Promise<SpawnResult> {
    const args = ['--file-selection'];

    if (options?.title) {
      args.push(`--title=${options.title}`);
    }

    if (options?.filters && options.filters.length > 0) {
      const filterStr = options.filters.join(' ');
      args.push(`--file-filter=Config files | ${filterStr}`);
    }

    if (options?.initialDir) {
      args.push(`--filename=${options.initialDir}/`);
    }

    return this.spawnFn('zenity', args);
  }

  private async spawnZenityDirectory(options?: FilePickerOptions): Promise<SpawnResult> {
    const args = ['--file-selection', '--directory'];

    if (options?.title) {
      args.push(`--title=${options.title}`);
    }

    if (options?.initialDir) {
      args.push(`--filename=${options.initialDir}/`);
    }

    return this.spawnFn('zenity', args);
  }

  private async spawnKdialog(options?: FilePickerOptions): Promise<SpawnResult> {
    const args = ['--getopenfilename'];

    if (options?.initialDir) {
      args.push(options.initialDir);
    } else {
      args.push('.');
    }

    if (options?.filters && options.filters.length > 0) {
      args.push(options.filters.join(' '));
    }

    if (options?.title) {
      args.push('--title', options.title);
    }

    return this.spawnFn('kdialog', args);
  }

  private async spawnKdialogDirectory(options?: FilePickerOptions): Promise<SpawnResult> {
    const args = ['--getexistingdirectory'];

    if (options?.initialDir) {
      args.push(options.initialDir);
    } else {
      args.push('.');
    }

    if (options?.title) {
      args.push('--title', options.title);
    }

    return this.spawnFn('kdialog', args);
  }

  private async spawnOsascript(options?: FilePickerOptions): Promise<SpawnResult> {
    const typeList = options?.filters
      ? options.filters
          .map((f) => f.replace('*.', ''))
          .map((ext) => `"${ext}"`)
          .join(', ')
      : '"ini", "lua"';

    const prompt = options?.title ?? 'Select a file';

    const script = `POSIX path of (choose file with prompt "${prompt}" of type {${typeList}})`;
    return this.spawnFn('osascript', ['-e', script]);
  }

  private async spawnOsascriptDirectory(options?: FilePickerOptions): Promise<SpawnResult> {
    const prompt = options?.title ?? 'Select a folder';
    const script = `POSIX path of (choose folder with prompt "${prompt}")`;
    return this.spawnFn('osascript', ['-e', script]);
  }

  private async spawnPowershell(options?: FilePickerOptions): Promise<SpawnResult> {
    const filterStr = options?.filters
      ? options.filters.map((f) => f.replace('*.', '')).join(';*.')
      : 'ini;*.lua';

    const title = options?.title ?? 'Select Config File';

    const script = [
      'Add-Type -AssemblyName System.Windows.Forms;',
      '$d = New-Object System.Windows.Forms.OpenFileDialog;',
      `$d.Title = '${title}';`,
      `$d.Filter = 'Config files|*.${filterStr}|All files|*.*';`,
      options?.initialDir ? `$d.InitialDirectory = '${options.initialDir}';` : '',
      'if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $d.FileName }',
    ].join(' ');

    return this.spawnFn('powershell', ['-NoProfile', '-Command', script]);
  }

  private async spawnPowershellDirectory(options?: FilePickerOptions): Promise<SpawnResult> {
    const title = options?.title ?? 'Select Backup Folder';

    const script = [
      'Add-Type -AssemblyName System.Windows.Forms;',
      '$d = New-Object System.Windows.Forms.FolderBrowserDialog;',
      `$d.Description = '${title}';`,
      options?.initialDir ? `$d.SelectedPath = '${options.initialDir}';` : '',
      'if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $d.SelectedPath }',
    ].join(' ');

    return this.spawnFn('powershell', ['-NoProfile', '-Command', script]);
  }
}
