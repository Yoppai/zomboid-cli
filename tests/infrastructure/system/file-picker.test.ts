import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { SystemFilePicker } from '@/infrastructure/system/file-picker.ts';

describe('SystemFilePicker', () => {
  describe('detectPlatform', () => {
    it('returns "powershell" on win32', () => {
      const picker = new SystemFilePicker({
        platform: 'win32',
        whichFn: async () => null,
      });
      expect(picker.detectPlatform()).toBe('powershell');
    });

    it('returns "osascript" on darwin', () => {
      const picker = new SystemFilePicker({
        platform: 'darwin',
        whichFn: async () => null,
      });
      expect(picker.detectPlatform()).toBe('osascript');
    });

    it('returns "zenity" on linux when zenity is available', () => {
      const picker = new SystemFilePicker({
        platform: 'linux',
        whichFn: async (cmd: string) => (cmd === 'zenity' ? '/usr/bin/zenity' : null),
      });
      expect(picker.detectPlatform()).toBe('zenity');
    });

    it('returns "kdialog" on linux when only kdialog is available', () => {
      const picker = new SystemFilePicker({
        platform: 'linux',
        whichFn: async (cmd: string) => (cmd === 'kdialog' ? '/usr/bin/kdialog' : null),
        // Must resolve zenity availability synchronously for detectPlatform
        zenityAvailable: false,
        kdialogAvailable: true,
      });
      expect(picker.detectPlatform()).toBe('kdialog');
    });

    it('returns "unsupported" on linux when neither zenity nor kdialog is available', () => {
      const picker = new SystemFilePicker({
        platform: 'linux',
        whichFn: async () => null,
        zenityAvailable: false,
        kdialogAvailable: false,
      });
      expect(picker.detectPlatform()).toBe('unsupported');
    });

    it('returns "unsupported" on unknown platforms', () => {
      const picker = new SystemFilePicker({
        platform: 'freebsd' as NodeJS.Platform,
        whichFn: async () => null,
      });
      expect(picker.detectPlatform()).toBe('unsupported');
    });
  });

  describe('pickFile', () => {
    it('spawns zenity with correct args on linux (zenity)', async () => {
      const spawnedCommands: string[][] = [];
      const picker = new SystemFilePicker({
        platform: 'linux',
        whichFn: async (cmd) => (cmd === 'zenity' ? '/usr/bin/zenity' : null),
        zenityAvailable: true,
        spawnFn: async (cmd: string, args: string[]) => {
          spawnedCommands.push([cmd, ...args]);
          return { stdout: '/home/user/test.ini\n', exitCode: 0 };
        },
      });

      const result = await picker.pickFile({ title: 'Select Config', filters: ['*.ini', '*.lua'] });
      expect(result).toBe('/home/user/test.ini');
      expect(spawnedCommands[0]![0]).toBe('zenity');
      expect(spawnedCommands[0]).toContain('--file-selection');
    });

    it('spawns kdialog with correct args on linux (kdialog)', async () => {
      const spawnedCommands: string[][] = [];
      const picker = new SystemFilePicker({
        platform: 'linux',
        whichFn: async (cmd) => (cmd === 'kdialog' ? '/usr/bin/kdialog' : null),
        zenityAvailable: false,
        kdialogAvailable: true,
        spawnFn: async (cmd: string, args: string[]) => {
          spawnedCommands.push([cmd, ...args]);
          return { stdout: '/home/user/settings.lua\n', exitCode: 0 };
        },
      });

      const result = await picker.pickFile({ filters: ['*.ini', '*.lua'] });
      expect(result).toBe('/home/user/settings.lua');
      expect(spawnedCommands[0]![0]).toBe('kdialog');
      expect(spawnedCommands[0]).toContain('--getopenfilename');
    });

    it('spawns osascript on darwin', async () => {
      const spawnedCommands: string[][] = [];
      const picker = new SystemFilePicker({
        platform: 'darwin',
        whichFn: async () => null,
        spawnFn: async (cmd: string, args: string[]) => {
          spawnedCommands.push([cmd, ...args]);
          return { stdout: '/Users/me/config.ini\n', exitCode: 0 };
        },
      });

      const result = await picker.pickFile({ title: 'Pick File' });
      expect(result).toBe('/Users/me/config.ini');
      expect(spawnedCommands[0]![0]).toBe('osascript');
    });

    it('spawns powershell on windows', async () => {
      const spawnedCommands: string[][] = [];
      const picker = new SystemFilePicker({
        platform: 'win32',
        whichFn: async () => null,
        spawnFn: async (cmd: string, args: string[]) => {
          spawnedCommands.push([cmd, ...args]);
          return { stdout: 'C:\\Users\\me\\server.ini\n', exitCode: 0 };
        },
      });

      const result = await picker.pickFile();
      expect(result).toBe('C:\\Users\\me\\server.ini');
      expect(spawnedCommands[0]![0]).toBe('powershell');
    });

    it('returns null when user cancels (non-zero exit code)', async () => {
      const picker = new SystemFilePicker({
        platform: 'linux',
        whichFn: async (cmd) => (cmd === 'zenity' ? '/usr/bin/zenity' : null),
        zenityAvailable: true,
        spawnFn: async () => {
          return { stdout: '', exitCode: 1 }; // user cancelled
        },
      });

      const result = await picker.pickFile();
      expect(result).toBeNull();
    });

    it('returns null when stdout is empty', async () => {
      const picker = new SystemFilePicker({
        platform: 'darwin',
        whichFn: async () => null,
        spawnFn: async () => {
          return { stdout: '\n', exitCode: 0 };
        },
      });

      const result = await picker.pickFile();
      expect(result).toBeNull();
    });

    it('returns null on unsupported platform', async () => {
      const picker = new SystemFilePicker({
        platform: 'freebsd' as NodeJS.Platform,
        whichFn: async () => null,
      });

      const result = await picker.pickFile();
      expect(result).toBeNull();
    });

    it('trims whitespace from stdout result', async () => {
      const picker = new SystemFilePicker({
        platform: 'win32',
        whichFn: async () => null,
        spawnFn: async () => {
          return { stdout: '  C:\\path\\to\\file.ini  \r\n', exitCode: 0 };
        },
      });

      const result = await picker.pickFile();
      expect(result).toBe('C:\\path\\to\\file.ini');
    });

    it('returns null when spawn throws an error', async () => {
      const picker = new SystemFilePicker({
        platform: 'linux',
        whichFn: async (cmd) => (cmd === 'zenity' ? '/usr/bin/zenity' : null),
        zenityAvailable: true,
        spawnFn: async () => {
          throw new Error('Command not found');
        },
      });

      const result = await picker.pickFile();
      expect(result).toBeNull();
    });

    // TRIANGULATE: zenity includes title and filter args
    it('passes title and filter to zenity arguments', async () => {
      const spawnedCommands: string[][] = [];
      const picker = new SystemFilePicker({
        platform: 'linux',
        whichFn: async (cmd) => (cmd === 'zenity' ? '/usr/bin/zenity' : null),
        zenityAvailable: true,
        spawnFn: async (cmd: string, args: string[]) => {
          spawnedCommands.push([cmd, ...args]);
          return { stdout: '/tmp/test.ini\n', exitCode: 0 };
        },
      });

      await picker.pickFile({ title: 'My Title', filters: ['*.ini', '*.lua'] });
      const args = spawnedCommands[0]!;
      // Should contain title and filter
      expect(args.some((a) => a.includes('My Title'))).toBe(true);
      expect(args.some((a) => a.includes('*.ini') || a.includes('.ini'))).toBe(true);
    });
  });
});
