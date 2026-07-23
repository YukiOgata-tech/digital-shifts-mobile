import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useSession } from '@/features/auth/session-provider';

import { fetchStaffContext } from './api';
import type { StaffProfile, StaffStore, StaffTenant } from './types';

type StaffContextValue = {
  profile: StaffProfile | null;
  tenants: StaffTenant[];
  stores: StaffStore[];
  activeTenant: StaffTenant | null;
  activeStore: StaffStore | null;
  isLoading: boolean;
  error: Error | null;
  setActiveTenantId: (tenantId: string) => void;
  setActiveStoreId: (storeId: string) => void;
  refresh: () => Promise<void>;
};

const StaffContext = createContext<StaffContextValue | null>(null);

export function StaffProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const userId = session?.user.id;
  const [preferredTenantId, setPreferredTenantId] = useState<string | null>(null);
  const [preferredStoreId, setPreferredStoreId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    void Promise.all([
      AsyncStorage.getItem(`staff:${userId}:tenant`),
      AsyncStorage.getItem(`staff:${userId}:store`),
    ]).then(([tenantId, storeId]) => {
      if (!active) return;
      setPreferredTenantId(tenantId);
      setPreferredStoreId(storeId);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const query = useQuery({
    queryKey: ['staff-context', userId],
    queryFn: () => fetchStaffContext(userId!),
    enabled: Boolean(userId),
  });

  const activeTenant = useMemo(() => {
    const tenants = query.data?.tenants ?? [];
    return tenants.find((tenant) => tenant.id === preferredTenantId) ?? tenants[0] ?? null;
  }, [preferredTenantId, query.data?.tenants]);

  const stores = useMemo(
    () =>
      (query.data?.stores ?? []).filter(
        (store) => !activeTenant || store.tenantId === activeTenant.id,
      ),
    [activeTenant, query.data?.stores],
  );

  const activeStore =
    stores.find((store) => store.id === preferredStoreId) ?? stores[0] ?? null;

  const setActiveTenantId = (tenantId: string) => {
    setPreferredTenantId(tenantId);
    setPreferredStoreId(null);
    if (userId) {
      void AsyncStorage.setItem(`staff:${userId}:tenant`, tenantId);
      void AsyncStorage.removeItem(`staff:${userId}:store`);
    }
  };

  const setActiveStoreId = (storeId: string) => {
    setPreferredStoreId(storeId);
    if (userId) void AsyncStorage.setItem(`staff:${userId}:store`, storeId);
  };

  return (
    <StaffContext.Provider
      value={{
        profile: query.data?.profile ?? null,
        tenants: query.data?.tenants ?? [],
        stores,
        activeTenant,
        activeStore,
        isLoading: query.isLoading,
        error: query.error,
        setActiveTenantId,
        setActiveStoreId,
        refresh: async () => {
          await query.refetch();
        },
      }}>
      {children}
    </StaffContext.Provider>
  );
}

export function useStaff() {
  const context = useContext(StaffContext);
  if (!context) throw new Error('useStaff must be used inside StaffProvider.');
  return context;
}
