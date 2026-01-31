-- Create licenses table for Church Projector
-- Run this in your Supabase SQL Editor for project: ejqzexdkoqbvgmjtbbwd

create table if not exists public.licenses (
  id uuid default gen_random_uuid() primary key,
  license_key text not null unique,
  email text not null,
  status text not null check (status in ('active', 'expired', 'cancelled', 'demo')),
  device_id text, -- Used to lock to a single device
  current_period_end timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.licenses enable row level security;

-- Policy: Allow Application (Anon) to check license status
-- Warning: This allows reading. For better security, use a PostgreSQL Function (RPC) instead.
create policy "Enable read access for all users"
on public.licenses for select
using (true);

-- Policy: Only Service Role (Admin) can insert/update
-- (Implicitly denied for Anon)
