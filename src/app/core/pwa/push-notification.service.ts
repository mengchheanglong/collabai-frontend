// src/app/core/pwa/push-notification.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../api/api-client.service';
import { ToastService } from '../toast/toast.service';

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface SubscribePushPayload {
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly api = inject(ApiClient);
  private readonly toast = inject(ToastService);

  readonly isSupported = signal<boolean>('serviceWorker' in navigator && 'PushManager' in window);
  readonly isSubscribed = signal<boolean>(false);
  readonly permission = signal<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  readonly isBusy = signal<boolean>(false);

  constructor() {
    if (this.isSupported()) {
      void this.checkSubscriptionState();
    }
  }

  async checkSubscriptionState(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const subscribed = !!sub;
      this.isSubscribed.set(subscribed);
      this.permission.set(Notification.permission);
      return subscribed;
    } catch (err) {
      console.warn('[PushNotification] Error checking subscription:', err);
      return false;
    }
  }

  async subscribe(): Promise<boolean> {
    if (!this.isSupported()) {
      this.toast.error('Web Push notifications are not supported by this browser.', 'Not Supported');
      return false;
    }

    this.isBusy.set(true);

    try {
      // 1. Request notification permission
      const perm = await Notification.requestPermission();
      this.permission.set(perm);

      if (perm !== 'granted') {
        this.toast.info('Notification permission was not granted.', 'Permission Required');
        return false;
      }

      // 2. Retrieve VAPID public key from backend
      const res = await firstValueFrom(
        this.api.get<{ publicKey: string }>('/notifications/push/public-key'),
      );
      const vapidPublicKey = res?.publicKey;

      if (!vapidPublicKey) {
        throw new Error('VAPID public key not returned by backend');
      }

      // 3. Register push subscription with browser
      const reg = await navigator.serviceWorker.ready;
      const convertedKey = this.urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });

      const subJson = subscription.toJSON();
      const p256dh = subJson.keys?.['p256dh'];
      const auth = subJson.keys?.['auth'];

      if (!subJson.endpoint || !p256dh || !auth) {
        throw new Error('Incomplete subscription payload from browser');
      }

      // 4. Send subscription to NestJS backend
      const payload: SubscribePushPayload = {
        endpoint: subJson.endpoint,
        keys: {
          p256dh,
          auth,
        },
        userAgent: navigator.userAgent,
      };

      await firstValueFrom(this.api.post('/notifications/push/subscribe', payload));

      this.isSubscribed.set(true);
      this.toast.success('Push notifications successfully enabled on this device!', 'Subscribed');
      return true;
    } catch (err: unknown) {
      console.error('[PushNotification] Subscribe failed:', err);
      const msg = err instanceof Error ? err.message : 'Could not enable push notifications';
      this.toast.error(msg, 'Subscription Failed');
      return false;
    } finally {
      this.isBusy.set(false);
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.isSupported()) return false;

    this.isBusy.set(true);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        // Notify backend to remove subscription
        try {
          await firstValueFrom(this.api.post('/notifications/push/unsubscribe', { endpoint }));
        } catch (backendErr) {
          console.warn('[PushNotification] Backend unsubscribe error:', backendErr);
        }
      }

      this.isSubscribed.set(false);
      this.toast.success('Push notifications have been disabled on this device.', 'Unsubscribed');
      return true;
    } catch (err) {
      console.error('[PushNotification] Unsubscribe failed:', err);
      this.toast.error('Failed to unsubscribe from notifications.', 'Error');
      return false;
    } finally {
      this.isBusy.set(false);
    }
  }

  async sendTestPush(): Promise<boolean> {
    this.isBusy.set(true);
    try {
      await firstValueFrom(this.api.post('/notifications/push/test', {}));
      this.toast.success('Test push notification sent! Check your system notifications.', 'Test Dispatched');
      return true;
    } catch (err) {
      console.error('[PushNotification] Test push failed:', err);
      this.toast.error('Failed to send test push notification.', 'Test Failed');
      return false;
    } finally {
      this.isBusy.set(false);
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
