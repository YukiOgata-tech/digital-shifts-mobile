import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1800;

function metaKey(key: string) {
  return `${key}.chunks`;
}

function chunkKey(key: string, index: number) {
  return `${key}.chunk.${index}`;
}

const nativeSecureStorage = {
  async getItem(key: string) {
    const countValue = await SecureStore.getItemAsync(metaKey(key));
    const count = Number(countValue);
    if (Number.isInteger(count) && count > 0) {
      const chunks = await Promise.all(
        Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index))),
      );
      if (chunks.every((chunk): chunk is string => chunk !== null)) return chunks.join('');
    }

    // AsyncStorageを使っていた開発版から、ログイン状態を一度だけ安全な保存領域へ移行する。
    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue) {
      await nativeSecureStorage.setItem(key, legacyValue);
      await AsyncStorage.removeItem(key);
      return legacyValue;
    }
    return null;
  },

  async setItem(key: string, value: string) {
    const previousCount = Number(await SecureStore.getItemAsync(metaKey(key))) || 0;
    const chunks = Array.from(
      { length: Math.ceil(value.length / CHUNK_SIZE) },
      (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    );
    await Promise.all(
      chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)),
    );
    await SecureStore.setItemAsync(metaKey(key), String(chunks.length));
    if (previousCount > chunks.length) {
      await Promise.all(
        Array.from({ length: previousCount - chunks.length }, (_, index) =>
          SecureStore.deleteItemAsync(chunkKey(key, chunks.length + index)),
        ),
      );
    }
  },

  async removeItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(metaKey(key))) || 0;
    await Promise.all([
      SecureStore.deleteItemAsync(metaKey(key)),
      ...Array.from({ length: count }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, index)),
      ),
      AsyncStorage.removeItem(key),
    ]);
  },
};

export const authStorage = Platform.OS === 'web' ? AsyncStorage : nativeSecureStorage;
