-- SchoolFlow v1.1 스키마
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다.
-- 모든 학교생활 데이터를 사용자별 한 테이블에 저장하고, RLS로 본인 데이터만 접근하게 합니다.

create table if not exists public.schoolflow_items (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null check (collection in ('timetable', 'assignments', 'exams', 'events', 'notices', 'settings')),
  id         text not null check (char_length(id) between 1 and 100),
  data       jsonb not null check (pg_column_size(data) < 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

alter table public.schoolflow_items enable row level security;

drop policy if exists "schoolflow_items_select_own" on public.schoolflow_items;
drop policy if exists "schoolflow_items_insert_own" on public.schoolflow_items;
drop policy if exists "schoolflow_items_update_own" on public.schoolflow_items;
drop policy if exists "schoolflow_items_delete_own" on public.schoolflow_items;

create policy "schoolflow_items_select_own" on public.schoolflow_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "schoolflow_items_insert_own" on public.schoolflow_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "schoolflow_items_update_own" on public.schoolflow_items
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "schoolflow_items_delete_own" on public.schoolflow_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 익명(로그인 안 한) 요청은 아예 접근 불가
revoke all on public.schoolflow_items from anon;
grant select, insert, update, delete on public.schoolflow_items to authenticated;
