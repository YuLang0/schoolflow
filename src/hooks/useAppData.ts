import { useCallback, useEffect, useRef, useState } from 'react';
import { authErrorMessage } from '../lib/authErrors';
import { CloudStore, LocalStore, type DataStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import type { AppData, AppUser, ListCollection, Settings } from '../lib/types';

type Item<C extends ListCollection> = AppData[C][number];

export interface DataApi {
  data: AppData | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  reload: () => Promise<void>;
  upsert: <C extends ListCollection>(collection: C, item: Item<C>) => Promise<boolean>;
  remove: (collection: ListCollection, id: string) => Promise<boolean>;
  saveSettings: (s: Settings) => Promise<boolean>;
  replaceAll: (d: AppData) => Promise<boolean>;
  clearError: () => void;
}

function storeFor(user: AppUser): DataStore {
  // 테스트 모드는 서버에 저장하지 않고 이 브라우저에만 저장
  if (user.test) return new LocalStore(user.email);
  return supabase ? new CloudStore(supabase, user.id) : new LocalStore(user.email);
}

/**
 * 화면에는 먼저 반영(낙관적 업데이트)하고 저장합니다.
 * 저장에 실패하면 서버(또는 로컬)의 실제 데이터를 다시 불러와 화면과 저장소가 어긋나지 않게 합니다.
 */
export function useAppData(user: AppUser): DataApi {
  const store = useRef<DataStore>(storeFor(user));
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await store.current.load());
      setError(null);
    } catch (e) {
      setError(`데이터를 불러오지 못했습니다. ${authErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    store.current = storeFor(user);
    void reload();
  }, [user.id, user.email, reload]); // 이름만 바뀐 경우에는 다시 불러오지 않음

  const run = useCallback(
    async (optimistic: (d: AppData) => AppData, op: () => Promise<void>) => {
      setData((d) => (d ? optimistic(d) : d));
      setPending((n) => n + 1);
      try {
        await op();
        return true;
      } catch (e) {
        setError(`저장하지 못했습니다. ${authErrorMessage(e)}`);
        try {
          setData(await store.current.load());
        } catch {
          /* 다시 불러오기도 실패하면 화면 그대로 둠 */
        }
        return false;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [],
  );

  const upsert = useCallback(
    <C extends ListCollection>(collection: C, item: Item<C>) =>
      run(
        (d) => {
          const list = d[collection] as { id: string }[];
          const exists = list.some((x) => x.id === item.id);
          return { ...d, [collection]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] };
        },
        () => store.current.put(collection, item),
      ),
    [run],
  );

  const remove = useCallback(
    (collection: ListCollection, id: string) =>
      run(
        (d) => ({ ...d, [collection]: (d[collection] as { id: string }[]).filter((x) => x.id !== id) }),
        () => store.current.remove(collection, id),
      ),
    [run],
  );

  const saveSettings = useCallback(
    (s: Settings) => run((d) => ({ ...d, settings: s }), () => store.current.put('settings', s)),
    [run],
  );

  const replaceAll = useCallback((d: AppData) => run(() => d, () => store.current.replaceAll(d)), [run]);

  return { data, loading, error, saving: pending > 0, reload, upsert, remove, saveSettings, replaceAll, clearError: () => setError(null) };
}
