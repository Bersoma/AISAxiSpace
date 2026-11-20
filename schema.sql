-- RoboParty 2026 schema. Run once in Supabase > SQL Editor.
create table students(id uuid primary key default gen_random_uuid(), student_code text unique, full_name text not null,
  grade int not null check (grade between 2 and 5), photo_url text, created_at timestamptz default now());
create table activities(id uuid primary key default gen_random_uuid(), name text unique not null, description text,
  category text, max_score numeric not null default 25 check (max_score>0), grades int[] not null default '{2,3,4,5}',
  active boolean not null default true, allow_attempts boolean not null default false);
create table staff(user_id uuid primary key references auth.users on delete cascade, role text not null check (role in ('admin','judge')));
create table judge_assignments(user_id uuid references auth.users on delete cascade, activity_id uuid references activities on delete cascade, primary key(user_id,activity_id));
create table scores(id uuid primary key default gen_random_uuid(), student_id uuid not null references students on delete cascade,
  activity_id uuid not null references activities on delete cascade, score numeric not null check (score>=0),
  entered_by uuid default auth.uid(), updated_at timestamptz default now(), unique(student_id,activity_id));
create index on scores(student_id); create index on scores(activity_id);
create table score_audit(id bigserial primary key, student_id uuid, activity_id uuid, old_score numeric, new_score numeric, action text, by_user uuid default auth.uid(), at timestamptz default now());
create table winners(id uuid primary key default gen_random_uuid(), category text not null, student_id uuid references students on delete set null,
  prize text check (prize in ('Drone','Basic Robotics Starter Kit')), published boolean not null default false);
create table announcements(id uuid primary key default gen_random_uuid(), title text not null, body text, published boolean default true, created_at timestamptz default now());
create table settings(key text primary key, value text);
insert into settings values ('venue',''),('age_range','');  -- flyer and invitation disagree: confirm, then edit here

create function is_admin() returns boolean language sql security definer stable as $$ select exists(select 1 from staff where user_id=auth.uid() and role='admin') $$;
create function can_score(a uuid) returns boolean language sql security definer stable as $$
  select is_admin() or exists(select 1 from judge_assignments j join staff s on s.user_id=j.user_id where j.user_id=auth.uid() and j.activity_id=a and s.role='judge') $$;

create function check_score() returns trigger language plpgsql as $$
declare a activities; g int; begin
  select * into a from activities where id=new.activity_id; select grade into g from students where id=new.student_id;
  if new.score>a.max_score then raise exception 'Score % exceeds maximum % for %',new.score,a.max_score,a.name; end if;
  if not (g = any(a.grades)) then raise exception 'Grade % not eligible for %',g,a.name; end if;
  new.updated_at=now(); return new; end $$;
create trigger t_check before insert or update on scores for each row execute function check_score();
create function audit_score() returns trigger language plpgsql security definer as $$ begin
  if tg_op='DELETE' then insert into score_audit(student_id,activity_id,old_score,action) values(old.student_id,old.activity_id,old.score,'delete'); return old;
  else insert into score_audit(student_id,activity_id,old_score,new_score,action) values(new.student_id,new.activity_id,case when tg_op='UPDATE' then old.score end,new.score,lower(tg_op)); return new; end if; end $$;
create trigger t_audit after insert or update or delete on scores for each row execute function audit_score();

-- Public read models: totals only, no raw scores, no student codes or photos. Ranks = standard competition ranking.
create view leaderboard as
select t.*, rank() over (partition by grade order by total desc) as grade_rank,
       rank() over (partition by division order by total desc) as division_rank
from (select s.id, s.full_name, s.grade, case when s.grade<=3 then 'Lower' else 'Upper' end as division,
        sum(c.score) as total, count(c.id) as activities_done
      from students s join scores c on c.student_id=s.id group by s.id) t;
create view public_stats as select (select count(*) from students) students, (select count(*) from activities where active) activities,
  (select count(*) from scores) scores, (select count(distinct grade) from students) grades;
create view public_winners as select w.id, w.category, w.prize, s.full_name, s.grade from winners w left join students s on s.id=w.student_id where w.published;
grant select on leaderboard, public_stats, public_winners to anon, authenticated;

alter table students enable row level security; alter table activities enable row level security; alter table scores enable row level security;
alter table staff enable row level security; alter table judge_assignments enable row level security; alter table score_audit enable row level security;
alter table winners enable row level security; alter table announcements enable row level security; alter table settings enable row level security;
create policy "staff read students" on students for select using (exists(select 1 from staff where user_id=auth.uid()));
create policy "admin students" on students for all using (is_admin()) with check (is_admin());
create policy "read active activities" on activities for select using (active or is_admin());
create policy "admin activities" on activities for all using (is_admin()) with check (is_admin());
create policy "read scores" on scores for select using (exists(select 1 from staff where user_id=auth.uid()) and can_score(activity_id));
create policy "write scores" on scores for insert with check (can_score(activity_id));
create policy "edit scores" on scores for update using (can_score(activity_id)) with check (can_score(activity_id));
create policy "admin delete scores" on scores for delete using (is_admin());
create policy "own staff row" on staff for select using (user_id=auth.uid() or is_admin());
create policy "admin staff" on staff for all using (is_admin()) with check (is_admin());
create policy "admin judges" on judge_assignments for all using (is_admin()) with check (is_admin());
create policy "own assignments" on judge_assignments for select using (user_id=auth.uid());
create policy "admin audit" on score_audit for select using (is_admin());
create policy "admin winners" on winners for all using (is_admin()) with check (is_admin());
create policy "read announcements" on announcements for select using (published or is_admin());
create policy "admin announcements" on announcements for all using (is_admin()) with check (is_admin());
create policy "read settings" on settings for select using (true);
create policy "admin settings" on settings for all using (is_admin()) with check (is_admin());

insert into activities(name,description,category) values
('Robot Target Challenge','Guide a robot to hit the target.','Robo Fun'),('Technology Quiz','Interactive technology questions.','Robo Fun'),
('Mystery Technology','Identify the mystery gadget.','Robo Fun'),('Robot Race','Race robots head to head.','Robo Fun'),
('Drone Flight','Fly a drone through fun challenges.','Activity Zone'),('Battle Bot','Control robots in friendly battles.','Activity Zone'),
('Robotics Race','Navigate robots through obstacle courses.','Activity Zone'),('Smart World - AI & IoT','See how AI and smart devices solve everyday problems.','Activity Zone');
