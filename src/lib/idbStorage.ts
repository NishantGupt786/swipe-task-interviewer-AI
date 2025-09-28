import { get, set, del } from "idb-keyval"
import type { PersistStorage, StorageValue } from "zustand/middleware"

export function createIndexedDBStorage<T>(name: string): PersistStorage<T> {
  return {
    getItem: async (key: string): Promise<StorageValue<T> | null> => {
      const value = await get<string>(`${name}-${key}`)
      if (!value) return null
      try {
        return JSON.parse(value) as StorageValue<T>
      } catch {
        return null
      }
    },
    setItem: async (key: string, value: StorageValue<T>): Promise<void> => {
      await set(`${name}-${key}`, JSON.stringify(value))
    },
    removeItem: async (key: string): Promise<void> => {
      await del(`${name}-${key}`)
    },
  }
}
