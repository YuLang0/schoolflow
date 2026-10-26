import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultSettings, emptyData, type AppData, type Collection, type ListCollection, type Settings } from './types';

export interface DataStore {
  load(): Promise<AppData>;
  put<T extends { id: string }>(collection: Collection, item: T): Promise<void>;
  remove(collection: ListCollection, id: string): Promise<void>;
  replaceAll(data: AppData): Promise<void>;
}

const LISTS: ListCollection[] = ['timetable', 'assignments', 'exams', 'events', 'notices'];

function mergeSettings(s: Partial<Settings> | undefined): Settings {
  const base = defaultSettings();
  return { ...base, ...(s ?? {}), id: 'settings', periodTimes: s?.periodTimes?.length ? s.periodTimes : base.periodTimes };
}

/** 로컬 데모 모드: 계정(이메일)별로 localStorage에 저장 */
export class LocalStore implements DataStore {
  private key: string;
  constructor(userId: string) {
    this.key = `sf:data:${userId}`;
  }
  private read(): AppData {
    try {
      const raw = JSON.parse(localStorage.getItem(this.key) || 'null');
      if (!raw) return emptyData();
      const d = emptyData();
      for (const c of LISTS) if (Array.isArray(raw[c])) d[c] = raw[c];
      d.settings = mergeSettings(raw.settings);
      return d;
    } catch {
      return emptyData();
    }
  }
  private write(d: AppData) {
    localStorage.setItem(this.key, JSON.stringify(d));
  }
  async load() {
    return this.read();
  }
  async put<T extends { id: string }>(collection: Collection, item: T) {
    const d = this.read();
    if (collection === 'settings') d.settings = item as unknown as Settings;
    else {
      const list = d[collection] as { id: string }[];
      const i = list.findIndex((x) => x.id === item.id);
      if (i >= 0) list[i] = item;
      else list.push(item);
    }
    this.write(d);
  }
  async remove(collection: ListCollection, id: string) {
    const d = this.read();
    (d[collection] as { id: string }[]) = (d[collection] as { id: string }[]).filter((x) => x.id !== id);
    this.write(d);
  }
  async replaceAll(data: AppData) {
    this.write(data);
  }
}

const TABLE = 'schoolflow_items';

/** 계정 동기화 모드: Supabase schoolflow_items 테이블 (RLS로 본인 행만 접근) */
export class CloudStore implements DataStore {
  constructor(private sb: SupabaseClient, private userId: string) {}

  async load(): Promise<AppData> {
    const d = emptyData();
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await this.sb
        .from(TABLE)
        .select('collection,id,data')
        .order('collection')
        .order('id')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      for (const row of data ?? []) {
        if (row.collection === 'settings') d.settings = mergeSettings(row.data);
        else if ((LISTS as string[]).includes(row.collection)) (d[row.collection as ListCollection] as unknown[]).push(row.data);
      }
      if (!data || data.length < pageSize) break;
    }
    return d;
  }

  async put<T extends { id: string }>(collection: Collection, item: T) {
    const { error } = await this.sb
      .from(TABLE)
      .upsert({ user_id: this.userId, collection, id: item.id, data: item, updated_at: new Date().toISOString() });
    if (error) throw error;
  }

  async remove(collection: ListCollection, id: string) {
    const { error } = await this.sb.from(TABLE).delete().eq('user_id', this.userId).eq('collection', collection).eq('id', id);
    if (error) throw error;
  }

  async replaceAll(data: AppData) {
    const rows = [
      ...LISTS.flatMap((c) => (data[c] as { id: string }[]).map((item) => ({ user_id: this.userId, collection: c, id: item.id, data: item }))),
      { user_id: this.userId, collection: 'settings', id: 'settings', data: data.settings },
    ];
    // 새 데이터를 먼저 올린 뒤, 새 데이터에 없는 예전 행만 지웁니다 (중간에 실패해도 데이터가 비지 않도록)
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await this.sb.from(TABLE).upsert(rows.slice(i, i + 500));
      if (error) throw error;
    }
    const keep = new Set(rows.map((r) => `${r.collection}/${r.id}`));
    const { data: existing, error } = await this.sb.from(TABLE).select('collection,id');
    if (error) throw error;
    for (const c of LISTS) {
      const stale = (existing ?? []).filter((r) => r.collection === c && !keep.has(`${c}/${r.id}`)).map((r) => r.id);
      for (let i = 0; i < stale.length; i += 200) {
        const { error: delErr } = await this.sb.from(TABLE).delete().eq('user_id', this.userId).eq('collection', c).in('id', stale.slice(i, i + 200));
        if (delErr) throw delErr;
      }
    }
  }
}
