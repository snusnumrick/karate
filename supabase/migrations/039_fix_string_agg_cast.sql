-- Fix string_agg cast error for day_of_week enum
create or replace function public.get_main_page_schedule_summary()
    returns table (
                      days text,
                      time_range text,
                      age_range text,
                      duration text,
                      max_students integer,
                      min_age integer,
                      max_age integer
                  ) security definer
    set search_path = public
    language plpgsql
as $$
declare
    min_age_val integer;
    max_age_val integer;
    min_time_val time;
    max_time_val time;
    avg_duration_val integer;
    max_capacity_val integer;
    day_list text;
begin
    select
        min(p.min_age),
        max(p.max_age),
        min(cs.start_time),
        max(cs.start_time),
        round(avg(p.duration_minutes)),
        max(p.max_capacity),
        string_agg(distinct cs.day_of_week::text, ', ' order by cs.day_of_week::text)
    into min_age_val, max_age_val, min_time_val, max_time_val, avg_duration_val, max_capacity_val, day_list
    from classes c
             join programs p on p.id = c.program_id
             join class_schedules cs on cs.class_id = c.id
    where c.is_active = true;

    if min_age_val is null then
        return;
    end if;

    return query
        select
            day_list,
            case
                when min_time_val is null then null
                when min_time_val = max_time_val then to_char(min_time_val, 'FMHH12:MI AM')
                else to_char(min_time_val, 'FMHH12:MI AM') || ' - ' || to_char(max_time_val, 'FMHH12:MI AM')
                end as time_range,
            case
                when max_age_val is null or max_age_val >= 100 then concat(min_age_val, '+')
                else concat(min_age_val, '-', max_age_val)
                end as age_range,
            concat(coalesce(avg_duration_val, 60), ' minutes') as duration,
            coalesce(max_capacity_val, 20) as max_students,
            min_age_val as min_age,
            max_age_val as max_age;
end;
$$;
