import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BACKGROUND_NOISE_CHECK_TASK = 'BACKGROUND_NOISE_CHECK_TASK';
const SERVER_URL = 'https://quitezone-backend.onrender.com';
const HIGH_NOISE_THRESHOLD = 70;
const NEARBY_RADIUS_KM = 0.5;
const NOTIF_COOLDOWN_MS = 5 * 60 * 1000;

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

TaskManager.defineTask(BACKGROUND_NOISE_CHECK_TASK, async () => {
  try {
    const lastLocationStr = await AsyncStorage.getItem('lastLocation');
    if (!lastLocationStr) return BackgroundFetch.BackgroundFetchResult.NoData;

    const lastLocation = JSON.parse(lastLocationStr);
    const { latitude, longitude } = lastLocation.coords;

    const lastNotifStr = await AsyncStorage.getItem('lastBgNotifTime');
    const lastNotifTime = lastNotifStr ? parseInt(lastNotifStr) : 0;
    if (Date.now() - lastNotifTime < NOTIF_COOLDOWN_MS) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${SERVER_URL}/api/heatmap`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return BackgroundFetch.BackgroundFetchResult.Failed;

    const data = await response.json();
    if (!data.success || !data.points || data.points.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const nearbyHighNoise = data.points.filter((point: any) => {
      const dist = getDistanceKm(latitude, longitude, point.location.lat, point.location.lng);
      const pointTime = point.updatedAt || point.timestamp;
      const isRecent = !pointTime || new Date(pointTime).getTime() > fiveMinutesAgo;
      return dist <= NEARBY_RADIUS_KM && point.noiseLevel >= HIGH_NOISE_THRESHOLD && isRecent;
    });

    if (nearbyHighNoise.length > 0) {
      const maxNoise = Math.max(...nearbyHighNoise.map((p: any) => p.noiseLevel));

      await AsyncStorage.setItem('lastBgNotifTime', String(Date.now()));

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ تنبيه: ضجيج مرتفع في منطقتك!',
          body: `رصدنا ضوضاء بمستوى ${maxNoise} dB على بعد أقل من 500 متر منك`,
          data: { type: 'BACKGROUND_NOISE_ALERT', noiseLevel: maxNoise },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: { channelId: 'noise_alerts' } as any,
      });

      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('Background noise check error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundNoiseCheck(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOISE_CHECK_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_NOISE_CHECK_TASK, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('✅ Background noise check registered');
    }
  } catch (error) {
    console.error('Background fetch registration error:', error);
  }
}
