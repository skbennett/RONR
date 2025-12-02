create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  username text not null,

  primary key (id)
);

alter table public.profiles enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

-- Create policies
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  with check (auth.uid() = id);

-- Create a function to automatically insert a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
declare
  username_value text;
begin
  -- Extract username from raw_user_meta_data
  username_value := new.raw_user_meta_data->>'username';
  
  -- Only insert if username exists
  if username_value is not null then
    insert into public.profiles (id, username)
    values (new.id, username_value);
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;

-- Create a trigger to call the function when a new user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
