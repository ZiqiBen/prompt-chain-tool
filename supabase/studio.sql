-- Apply to the same Supabase project as the public and admin apps.
-- Requires the existing Week 6/7 tables and public.is_superadmin().
begin;

grant insert, update, delete on public.prompt_chains, public.prompt_chain_steps to authenticated;
do $$
declare t text;
begin
  foreach t in array array['prompt_chains','prompt_chain_steps'] loop
    execute format('drop policy if exists "Studio superadmin writes" on public.%I',t);
    execute format('create policy "Studio superadmin writes" on public.%I for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin())',t);
  end loop;
end $$;

-- Normal profile editing must never let a member grant themselves this role.
create or replace function public.studio_protect_admin_role()
returns trigger language plpgsql set search_path=public as $$
begin
  if auth.role()='authenticated' and not public.is_superadmin() then
    if (tg_op='INSERT' and new.is_superadmin) or
       (tg_op='UPDATE' and new.is_superadmin is distinct from old.is_superadmin) then
      raise exception 'Only a superadmin can change admin access.' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists studio_protect_admin_role on public.profiles;
create trigger studio_protect_admin_role before insert or update on public.profiles
for each row execute function public.studio_protect_admin_role();

create table if not exists public.prompt_chain_runs (
  id uuid primary key default gen_random_uuid(),
  prompt_chain_id uuid references public.prompt_chains(id) on delete set null,
  chain_name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  input_text text not null,
  preferred_language text not null default 'Python',
  input_image_name text,
  steps_snapshot jsonb not null,
  status text not null default 'running' check (status in ('running','completed','failed')),
  output_text text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table if not exists public.prompt_chain_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.prompt_chain_runs(id) on delete cascade,
  step_id uuid references public.prompt_chain_steps(id) on delete set null,
  step_order integer not null,
  step_name text not null,
  model_key text not null,
  prompt_text text not null,
  output_text text not null,
  duration_ms integer not null,
  prompt_tokens integer,
  completion_tokens integer,
  created_at timestamptz not null default now(),
  unique(run_id,step_order)
);
create index if not exists studio_runs_chain_created on public.prompt_chain_runs(prompt_chain_id,created_at desc);
create index if not exists studio_run_steps_order on public.prompt_chain_run_steps(run_id,step_order);

do $$
declare t text;
begin
  foreach t in array array['prompt_chain_runs','prompt_chain_run_steps'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('grant select,insert,update on public.%I to authenticated',t);
    execute format('drop policy if exists "Studio superadmins only" on public.%I',t);
    execute format('create policy "Studio superadmins only" on public.%I for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin())',t);
  end loop;
end $$;

-- Ordering changes are serialized per chain and committed atomically.
-- Temporary positive offsets avoid the existing non-deferrable UNIQUE constraint.
create or replace function public.studio_reorder_steps(p_chain_id uuid,p_ids uuid[])
returns void language plpgsql security invoker set search_path=public as $$
declare n integer; shift_by integer;
begin
  if not public.is_superadmin() then raise exception 'Admin access required.' using errcode='42501'; end if;
  perform 1 from public.prompt_chains where id=p_chain_id for update;
  if not found then raise exception 'Chain not found.'; end if;
  select count(*),coalesce(max(step_order),0)+count(*)+1 into n,shift_by
    from public.prompt_chain_steps where prompt_chain_id=p_chain_id;
  if p_ids is null or cardinality(p_ids)<>n or
    (select count(distinct x) from unnest(p_ids) as x)<>n or
    exists(select 1 from unnest(p_ids) as x where not exists
      (select 1 from public.prompt_chain_steps s where s.id=x and s.prompt_chain_id=p_chain_id)) then
    raise exception 'Step order must contain every step exactly once.';
  end if;
  update public.prompt_chain_steps set step_order=step_order+shift_by where prompt_chain_id=p_chain_id;
  update public.prompt_chain_steps s set step_order=o.position::integer
    from unnest(p_ids) with ordinality as o(id,position) where s.id=o.id and s.prompt_chain_id=p_chain_id;
end $$;

create or replace function public.studio_save_step(p_chain_id uuid,p_step_id uuid,p_name text,p_prompt text,p_model_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare result uuid; next_order integer;
begin
  if not public.is_superadmin() then raise exception 'Admin access required.' using errcode='42501'; end if;
  if length(trim(p_name)) not between 1 and 100 or length(trim(p_prompt)) not between 1 and 12000 then
    raise exception 'A step needs a name and a prompt (up to 12,000 characters).';
  end if;
  perform 1 from public.prompt_chains where id=p_chain_id for update;
  if not found then raise exception 'Chain not found.'; end if;
  if p_model_id is not null and not exists(select 1 from public.llm_models where id=p_model_id and is_active and model_key like 'gemini-%') then
    raise exception 'Choose an active Gemini model.';
  end if;
  if p_step_id is null then
    if (select count(*) from public.prompt_chain_steps where prompt_chain_id=p_chain_id)>=20 then
      raise exception 'A chain can contain up to 20 steps.';
    end if;
    select coalesce(max(step_order),0)+1 into next_order from public.prompt_chain_steps where prompt_chain_id=p_chain_id;
    insert into public.prompt_chain_steps(prompt_chain_id,step_order,name,prompt_template,model_id)
      values(p_chain_id,next_order,trim(p_name),trim(p_prompt),p_model_id) returning id into result;
  else
    update public.prompt_chain_steps set name=trim(p_name),prompt_template=trim(p_prompt),model_id=p_model_id
      where id=p_step_id and prompt_chain_id=p_chain_id returning id into result;
    if result is null then raise exception 'Step not found in this chain.'; end if;
  end if;
  return result;
end $$;

create or replace function public.studio_move_step(p_chain_id uuid,p_step_id uuid,p_direction integer)
returns void language plpgsql security invoker set search_path=public as $$
declare ids uuid[]; old_pos integer; new_pos integer; swap_id uuid;
begin
  if not public.is_superadmin() then raise exception 'Admin access required.' using errcode='42501'; end if;
  if p_direction not in (-1,1) then raise exception 'Invalid move direction.'; end if;
  perform 1 from public.prompt_chains where id=p_chain_id for update;
  if not found then raise exception 'Chain not found.'; end if;
  select array_agg(id order by step_order) into ids from public.prompt_chain_steps where prompt_chain_id=p_chain_id;
  old_pos=array_position(ids,p_step_id);
  if old_pos is null then raise exception 'Step not found in this chain.'; end if;
  new_pos=old_pos+p_direction;
  if new_pos<1 or new_pos>cardinality(ids) then return; end if;
  swap_id=ids[new_pos]; ids[new_pos]=p_step_id; ids[old_pos]=swap_id;
  perform public.studio_reorder_steps(p_chain_id,ids);
end $$;

create or replace function public.studio_delete_step(p_chain_id uuid,p_step_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare ids uuid[];
begin
  if not public.is_superadmin() then raise exception 'Admin access required.' using errcode='42501'; end if;
  perform 1 from public.prompt_chains where id=p_chain_id for update;
  if not found then raise exception 'Chain not found.'; end if;
  delete from public.prompt_chain_steps where id=p_step_id and prompt_chain_id=p_chain_id;
  if not found then raise exception 'Step not found in this chain.'; end if;
  select coalesce(array_agg(id order by step_order),'{}'::uuid[]) into ids from public.prompt_chain_steps where prompt_chain_id=p_chain_id;
  perform public.studio_reorder_steps(p_chain_id,ids);
end $$;

revoke all on function public.studio_reorder_steps(uuid,uuid[]) from public;
revoke all on function public.studio_save_step(uuid,uuid,text,text,uuid) from public;
revoke all on function public.studio_move_step(uuid,uuid,integer) from public;
revoke all on function public.studio_delete_step(uuid,uuid) from public;
grant execute on function public.studio_reorder_steps(uuid,uuid[]) to authenticated;
grant execute on function public.studio_save_step(uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.studio_move_step(uuid,uuid,integer) to authenticated;
grant execute on function public.studio_delete_step(uuid,uuid) to authenticated;
commit;
