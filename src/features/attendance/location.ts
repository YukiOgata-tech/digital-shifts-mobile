import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type AttendanceLocationEvidence = {
  status: 'ok' | 'denied' | 'unavailable' | 'not_supported';
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
};

export async function getAttendanceLocation(): Promise<AttendanceLocationEvidence> {
  if (Platform.OS === 'web') return { status: 'not_supported' };

  const currentPermission = await Location.getForegroundPermissionsAsync();
  const permission =
    currentPermission.status === 'granted'
      ? currentPermission
      : await Location.requestForegroundPermissionsAsync();

  if (permission.status !== 'granted') return { status: 'denied' };

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return { status: 'unavailable' };

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true,
    });
    return {
      status: 'ok',
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracyMeters: location.coords.accuracy ?? undefined,
    };
  } catch {
    return { status: 'unavailable' };
  }
}

export function calculateDistanceMeters(
  latitude: number,
  longitude: number,
  storeLatitude: number,
  storeLongitude: number,
) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(storeLatitude - latitude);
  const longitudeDelta = toRadians(storeLongitude - longitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitude)) *
      Math.cos(toRadians(storeLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
