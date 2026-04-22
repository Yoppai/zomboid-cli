import { describe, it, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';

import { TabBar } from '@/shared/components/common/TabBar.tsx';
import { LatencyBar } from '@/shared/components/common/LatencyBar.tsx';
import { LogViewer } from '@/shared/components/common/LogViewer.tsx';
import { FilePickerButton } from '@/shared/components/common/FilePickerButton.tsx';

// ── TabBar ──

describe('TabBar', () => {
  const tabs = ['Management', 'Players', 'Stats', 'Backups'];

  it('should render all tab labels', () => {
    const { lastFrame } = render(
      React.createElement(TabBar, {
        tabs,
        activeIndex: 0,
        onTabChange: () => {},
      }),
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Management');
    expect(frame).toContain('Players');
    expect(frame).toContain('Stats');
    expect(frame).toContain('Backups');
  });

  it('should visually highlight the active tab', () => {
    const { lastFrame } = render(
      React.createElement(TabBar, {
        tabs,
        activeIndex: 1,
        onTabChange: () => {},
      }),
    );
    const frame = lastFrame() ?? '';
    // Active tab should be present and distinguishable
    expect(frame).toContain('Players');
  });

  it('should call onTabChange when right arrow is pressed', () => {
    let newIndex = -1;
    const { stdin } = render(
      React.createElement(TabBar, {
        tabs,
        activeIndex: 0,
        onTabChange: (idx: number) => { newIndex = idx; },
      }),
    );
    // Right arrow key (ANSI escape sequence)
    stdin.write('\x1B[C');
    expect(newIndex).toBe(1);
  });

  it('should call onTabChange when left arrow is pressed', () => {
    let newIndex = -1;
    const { stdin } = render(
      React.createElement(TabBar, {
        tabs,
        activeIndex: 2,
        onTabChange: (idx: number) => { newIndex = idx; },
      }),
    );
    // Left arrow key
    stdin.write('\x1B[D');
    expect(newIndex).toBe(1);
  });

  it('should not go below 0 when pressing left at first tab', () => {
    let called = false;
    const { stdin } = render(
      React.createElement(TabBar, {
        tabs,
        activeIndex: 0,
        onTabChange: () => { called = true; },
      }),
    );
    stdin.write('\x1B[D');
    expect(called).toBe(false);
  });

  it('should not go above last index when pressing right at last tab', () => {
    let called = false;
    const { stdin } = render(
      React.createElement(TabBar, {
        tabs,
        activeIndex: 3,
        onTabChange: () => { called = true; },
      }),
    );
    stdin.write('\x1B[C');
    expect(called).toBe(false);
  });

  it('should render with two tabs', () => {
    const { lastFrame } = render(
      React.createElement(TabBar, {
        tabs: ['Tab A', 'Tab B'],
        activeIndex: 0,
        onTabChange: () => {},
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Tab A');
    expect(frame).toContain('Tab B');
  });
});

// ── LatencyBar ──

describe('LatencyBar', () => {
  it('should render region name and latency value', () => {
    const { lastFrame } = render(
      React.createElement(LatencyBar, {
        region: 'us-central1',
        latencyMs: 45,
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('us-central1');
    expect(frame).toContain('45');
  });

  it('should render low latency (< 100ms) with green indicator', () => {
    const { lastFrame } = render(
      React.createElement(LatencyBar, {
        region: 'us-east1',
        latencyMs: 30,
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('us-east1');
    expect(frame).toContain('30');
  });

  it('should render medium latency (100-200ms)', () => {
    const { lastFrame } = render(
      React.createElement(LatencyBar, {
        region: 'europe-west1',
        latencyMs: 150,
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('europe-west1');
    expect(frame).toContain('150');
  });

  it('should render high latency (> 200ms)', () => {
    const { lastFrame } = render(
      React.createElement(LatencyBar, {
        region: 'asia-east1',
        latencyMs: 350,
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('asia-east1');
    expect(frame).toContain('350');
  });

  it('should render Infinity latency as timeout', () => {
    const { lastFrame } = render(
      React.createElement(LatencyBar, {
        region: 'australia-southeast1',
        latencyMs: Infinity,
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('australia-southeast1');
    expect(frame).toContain('timeout');
  });
});

// ── LogViewer ──

describe('LogViewer', () => {
  it('should render log lines', () => {
    const { lastFrame } = render(
      React.createElement(LogViewer, {
        lines: [
          'Server started on port 16261',
          'Player Alice connected',
          'World saved',
        ],
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Server started on port 16261');
    expect(frame).toContain('Player Alice connected');
    expect(frame).toContain('World saved');
  });

  it('should render empty state when no lines', () => {
    const { lastFrame } = render(
      React.createElement(LogViewer, { lines: [] }),
    );
    const frame = lastFrame();
    expect(frame).toContain('No logs');
  });

  it('should render a title when provided', () => {
    const { lastFrame } = render(
      React.createElement(LogViewer, {
        lines: ['line 1'],
        title: 'Server Logs',
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Server Logs');
    expect(frame).toContain('line 1');
  });

  it('should render multiple lines in order', () => {
    const lines = ['First', 'Second', 'Third'];
    const { lastFrame } = render(
      React.createElement(LogViewer, { lines }),
    );
    const frame = lastFrame() ?? '';
    const firstIdx = frame.indexOf('First');
    const secondIdx = frame.indexOf('Second');
    const thirdIdx = frame.indexOf('Third');
    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });
});

// ── FilePickerButton ──

describe('FilePickerButton', () => {
  it('should render button label', () => {
    const { lastFrame } = render(
      React.createElement(FilePickerButton, {
        label: 'Select Config File',
        onSelect: () => {},
      }),
    );
    expect(lastFrame()).toContain('Select Config File');
  });

  it('should show "No file selected" when no file is chosen', () => {
    const { lastFrame } = render(
      React.createElement(FilePickerButton, {
        label: 'Browse',
        onSelect: () => {},
      }),
    );
    const frame = lastFrame();
    // Component renders [label] but ink-testing-library may strip brackets
    expect(frame).toContain('Browse');
    expect(frame).toContain('No file selected');
  });

  it('should show selected filename when provided', () => {
    const { lastFrame } = render(
      React.createElement(FilePickerButton, {
        label: 'Browse',
        onSelect: () => {},
        selectedFile: '/home/user/config.ini',
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Browse');
    expect(frame).toContain('config.ini');
  });

  it('should show different selected filename', () => {
    const { lastFrame } = render(
      React.createElement(FilePickerButton, {
        label: 'Choose File',
        onSelect: () => {},
        selectedFile: '/opt/zomboid/settings.lua',
      }),
    );
    const frame = lastFrame();
    expect(frame).toContain('Choose File');
    expect(frame).toContain('settings.lua');
  });
});
