-- ============================================================
-- Keep in Mind · Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Extensions (required for realtime + UUIDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- LISTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lists (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text UNIQUE,         -- original client-generated ID (string)
  name text NOT NULL,
  color text NOT NULL DEFAULT '#01696f',
  icon text NOT NULL DEFAULT 'user',
  position integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- TASKS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text UNIQUE,         -- original client-generated ID (string)
  list_client_id text,           -- client list ID reference
  title text NOT NULL,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'done', 'later')),
  due_date timestamptz,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_interval text CHECK (recurring_interval IN ('daily', 'weekly', 'monthly')),
  boomerang_days integer,
  subtasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  position integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_lists_user ON public.lists (user_id);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- Each user sees ONLY their own rows.
-- ------------------------------------------------------------
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Lists policy: select/insert/update/delete only own rows
CREATE POLICY "lists_select_own" ON public.lists
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lists_insert_own" ON public.lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lists_update_own" ON public.lists
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lists_delete_own" ON public.lists
  FOR DELETE USING (auth.uid() = user_id);

-- Tasks policy: select/insert/update/delete only own rows
CREATE POLICY "tasks_select_own" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert_own" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update_own" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_delete_own" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- REALTIME
-- Enable realtime for both tables so changes propagate
-- to other devices within seconds.
-- ------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;