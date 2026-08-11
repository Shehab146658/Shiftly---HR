-- Repeatable financial-services and performance data for the Shiftly preview.
-- Uses clearly marked demo references and never alters user-created records.

do $business_seed$
declare
  v_tenant uuid;
  v_employee uuid;
  v_branch uuid;
  v_request uuid;
  v_loan uuid;
  v_policy uuid;
  v_target uuid;
  v_installment uuid;
  v_i integer;
begin
  select id into v_tenant from public.tenants where slug='shiftly-demo';
  if v_tenant is null then raise notice 'Shiftly demo tenant does not exist; business seed skipped.'; return; end if;
  select id,branch_id into v_employee,v_branch from public.employees where tenant_id=v_tenant and status<>'terminated' and branch_id is not null order by employee_code limit 1;
  if v_employee is null then raise notice 'Shiftly demo employees do not exist; business seed skipped.'; return; end if;

  select id into v_request from public.loan_requests where tenant_id=v_tenant and purpose='Shiftly preview emergency advance' limit 1;
  if v_request is null then
    insert into public.loan_requests(tenant_id,employee_id,requested_amount,requested_installments,requested_start_month,purpose,status,approved_amount,approved_installments,approved_start_month,decision_note,decided_at)
    values(v_tenant,v_employee,9000,6,'2026-07-01','Shiftly preview emergency advance','approved',9000,6,'2026-07-01','Approved preview request',now()) returning id into v_request;
  end if;
  select id into v_loan from public.employee_loans where request_id=v_request;
  if v_loan is null then
    insert into public.employee_loans(tenant_id,employee_id,request_id,loan_number,approved_amount,installment_count,monthly_installment,start_month,currency_code,total_paid,remaining_balance,status,notes)
    values(v_tenant,v_employee,v_request,'LN-2026-DEMO-001',9000,6,1500,'2026-07-01','EGP',3000,6000,'active','Preview interest-free employee advance') returning id into v_loan;
    for v_i in 1..6 loop
      insert into public.loan_installments(tenant_id,loan_id,installment_number,due_date,original_due_date,amount,paid_amount,status,paid_at)
      values(v_tenant,v_loan,v_i,(date '2026-07-01'+((v_i-1)||' months')::interval)::date,(date '2026-07-01'+((v_i-1)||' months')::interval)::date,1500,case when v_i<=2 then 1500 else 0 end,case when v_i<=2 then 'paid'::public.loan_installment_status else 'scheduled'::public.loan_installment_status end,case when v_i<=2 then now() end)
      returning id into v_installment;
      if v_i<=2 then insert into public.loan_payments(tenant_id,loan_id,installment_id,amount,payment_date,method,reference,notes) values(v_tenant,v_loan,v_installment,1500,(date '2026-07-28'+((v_i-1)||' months')::interval)::date,'cash','DEMO-PAY-'||v_i,'Preview payment'); end if;
    end loop;
  end if;

  for v_i in 1..7 loop
    if not exists(select 1 from public.sales_entries where tenant_id=v_tenant and reference='DEMO-BRANCH-'||v_i) then
      insert into public.sales_entries(tenant_id,business_date,branch_id,amount,currency_code,reference,notes,status,submitted_at,reviewed_at)
      values(v_tenant,date '2026-08-01'+(v_i-1),v_branch,14000+(v_i*350),'EGP','DEMO-BRANCH-'||v_i,'Preview approved branch sale','approved',now(),now());
    end if;
  end loop;
  if not exists(select 1 from public.sales_entries where tenant_id=v_tenant and reference='DEMO-PENDING-1') then
    insert into public.sales_entries(tenant_id,business_date,branch_id,employee_id,amount,currency_code,reference,notes,status)
    values(v_tenant,'2026-08-08',v_branch,v_employee,8750,'EGP','DEMO-PENDING-1','Preview sale awaiting manager review','submitted');
  end if;

  insert into public.bonus_policies(tenant_id,code,name_en,name_ar,bonus_basis,tiers,effective_from)
  values(v_tenant,'DEMO-TIER','Preview branch incentive','حافز الفرع التجريبي','fixed_amount','[{"min_percentage":80,"value":500},{"min_percentage":100,"value":1000},{"min_percentage":120,"value":1500}]','2026-01-01')
  on conflict(tenant_id,code) do update set tiers=excluded.tiers returning id into v_policy;
  insert into public.sales_targets(tenant_id,code,name,period_start,period_end,scope_type,branch_id,target_amount,currency_code,bonus_policy_id)
  values(v_tenant,'AUG-2026-DEMO','August branch growth target','2026-08-01','2026-08-31','branch',v_branch,100000,'EGP',v_policy)
  on conflict(tenant_id,code) do update set target_amount=excluded.target_amount,bonus_policy_id=excluded.bonus_policy_id returning id into v_target;
  insert into public.bonus_results(tenant_id,target_id,employee_id,actual_sales,achievement_percentage,tier_value,bonus_amount,status,calculation_snapshot)
  select v_tenant,v_target,e.id,coalesce(sum(s.amount) filter(where s.employee_id=e.id),0),105.8,1000,1000,'calculated',jsonb_build_object('scope_actual_sales',105800,'seed','Shiftly preview')
  from public.employees e left join public.sales_entries s on s.employee_id=e.id and s.status='approved' and s.business_date between '2026-08-01' and '2026-08-31'
  where e.tenant_id=v_tenant and e.branch_id=v_branch and e.status<>'terminated'
  group by e.id
  on conflict(target_id,employee_id) do nothing;
end;
$business_seed$;
