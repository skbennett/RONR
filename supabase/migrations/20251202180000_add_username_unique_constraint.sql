-- Migration: add unique constraint to username in profiles table
-- Ensures usernames are unique across all users

alter table public.profiles
  add constraint profiles_username_unique unique (username);
