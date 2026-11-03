-- Run in SQL Editor after studio.sql. Every fixture and change is rolled back.
begin;
select set_config('studio.test_admin',(select id::text from public.profiles where is_superadmin limit 1),true);
select set_config('studio.test_member',(select id::text from public.profiles where not is_superadmin limit 1),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('studio.test_admin'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare c uuid; a uuid; b uuid; rejected boolean=false; orders integer[];
begin
 if not public.is_superadmin() then raise exception 'No test superadmin was found.'; end if;
 insert into public.prompt_chains(name) values('Studio rollback-only test') returning id into c;
 update public.prompt_chains set description='CRUD check' where id=c;
 a=public.studio_save_step(c,null,'One','Read {{input}}.',null);
 b=public.studio_save_step(c,null,'Two','Use {{previous_output}}.',null);
 perform public.studio_save_step(c,a,'One edited','Analyze {{input}}.',null);
 if not exists(select 1 from public.prompt_chain_steps where id=a and name='One edited') then raise exception 'Step update failed'; end if;
 perform public.studio_move_step(c,b,-1);
 if not exists(select 1 from public.prompt_chain_steps where id=b and step_order=1) then raise exception 'Move failed'; end if;
 begin perform public.studio_reorder_steps(c,array[a,a]); exception when others then rejected=true; end;
 if not rejected then raise exception 'Duplicate reorder accepted'; end if;
 select array_agg(step_order order by step_order) into orders from public.prompt_chain_steps where prompt_chain_id=c;
 if orders<>array[1,2] then raise exception 'Order was corrupted after rejection'; end if;
 perform public.studio_delete_step(c,b);
 if not exists(select 1 from public.prompt_chain_steps where id=a and step_order=1) then raise exception 'Delete did not compact order'; end if;
 delete from public.prompt_chains where id=c;
 if exists(select 1 from public.prompt_chain_steps where prompt_chain_id=c) then raise exception 'Chain delete did not cascade'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('studio.test_member'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare rejected boolean=false;
begin
 if public.is_superadmin() then raise exception 'Test member unexpectedly has admin access'; end if;
 if exists(select 1 from public.prompt_chains) then raise exception 'Member can read chains'; end if;
 begin update public.profiles set is_superadmin=true where id=auth.uid(); exception when insufficient_privilege then rejected=true; end;
 if not rejected then raise exception 'Member could change admin role'; end if;
 rejected=false;
 begin insert into public.prompt_chains(name) values('Should be denied'); exception when insufficient_privilege then rejected=true; end;
 if not rejected then raise exception 'Member could create a chain'; end if;
end $$;
reset role;
rollback;
select 'PASS: chain/step CRUD, atomic reorder, rollback safety, member isolation, and role protection' as result;
