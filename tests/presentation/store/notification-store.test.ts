import { describe, it, expect, beforeEach } from 'bun:test';

// Production code that does NOT exist yet — guarantees RED
import {
  createNotificationStore,
  type NotificationStore,
  type NotificationType,
  type Notification,
} from '@/presentation/store/notification-store.ts';

describe('NotificationStore', () => {
  let store: NotificationStore;

  beforeEach(() => {
    store = createNotificationStore();
  });

  // ── Initial State ──

  describe('initial state', () => {
    it('should start with empty notifications', () => {
      const state = store.getState();
      expect(state.notifications).toEqual([]);
    });
  });

  // ── add ──

  describe('add', () => {
    it('should create a notification with a UUID id', () => {
      const id = store.getState().add('success', 'Server deployed');
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);

      const state = store.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0]!.id).toBe(id);
      expect(state.notifications[0]!.type).toBe('success');
      expect(state.notifications[0]!.message).toBe('Server deployed');
    });

    it('should set a timestamp on the notification', () => {
      const before = Date.now();
      store.getState().add('info', 'Loading...');
      const after = Date.now();

      const n = store.getState().notifications[0]!;
      expect(n.timestamp).toBeGreaterThanOrEqual(before);
      expect(n.timestamp).toBeLessThanOrEqual(after);
    });

    it('should support all notification types', () => {
      const types: NotificationType[] = ['success', 'error', 'info', 'warning'];
      for (const type of types) {
        store.getState().add(type, `msg-${type}`);
      }
      const state = store.getState();
      expect(state.notifications).toHaveLength(4);
      expect(state.notifications.map((n) => n.type)).toEqual(types);
    });

    it('should stack multiple notifications', () => {
      store.getState().add('success', 'first');
      store.getState().add('error', 'second');
      store.getState().add('warning', 'third');

      const state = store.getState();
      expect(state.notifications).toHaveLength(3);
      expect(state.notifications[0]!.message).toBe('first');
      expect(state.notifications[1]!.message).toBe('second');
      expect(state.notifications[2]!.message).toBe('third');
    });
  });

  // ── dismiss ──

  describe('dismiss', () => {
    it('should remove a notification by id', () => {
      const id1 = store.getState().add('success', 'first');
      const id2 = store.getState().add('error', 'second');

      store.getState().dismiss(id1);
      const state = store.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0]!.id).toBe(id2);
    });

    it('should be a no-op for unknown id', () => {
      store.getState().add('info', 'exists');
      store.getState().dismiss('non-existent-id');
      expect(store.getState().notifications).toHaveLength(1);
    });
  });

  // ── clear ──

  describe('clear', () => {
    it('should remove all notifications', () => {
      store.getState().add('success', 'one');
      store.getState().add('error', 'two');
      store.getState().add('warning', 'three');

      store.getState().clear();
      expect(store.getState().notifications).toEqual([]);
    });

    it('should be safe to call on empty state', () => {
      store.getState().clear();
      expect(store.getState().notifications).toEqual([]);
    });
  });
});
