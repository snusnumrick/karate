-- Atomic RPC for recording one-on-one session usage.
-- Ensures quantity decrement and usage insertion happen in one transaction.

CREATE OR REPLACE FUNCTION public.record_individual_session_usage(
    p_session_purchase_id uuid,
    p_student_id uuid,
    p_usage_date date,
    p_admin_user_id uuid,
    p_notes text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_family_id uuid;
    v_quantity_remaining integer;
    v_new_balance integer := 0;
BEGIN
    SELECT family_id, quantity_remaining
    INTO v_family_id, v_quantity_remaining
    FROM one_on_one_sessions
    WHERE id = p_session_purchase_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session purchase % not found', p_session_purchase_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_quantity_remaining <= 0 THEN
        RAISE EXCEPTION 'Selected session has no remaining quantity'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE one_on_one_sessions
    SET quantity_remaining = quantity_remaining - 1,
        updated_at = NOW()
    WHERE id = p_session_purchase_id;

    INSERT INTO one_on_one_session_usage (
        session_purchase_id,
        student_id,
        usage_date,
        notes,
        recorded_by
    ) VALUES (
        p_session_purchase_id,
        p_student_id,
        p_usage_date,
        p_notes,
        p_admin_user_id
    );

    IF v_family_id IS NOT NULL THEN
        SELECT total_remaining_sessions
        INTO v_new_balance
        FROM family_one_on_one_balance
        WHERE family_id = v_family_id;
    END IF;

    RETURN COALESCE(v_new_balance, 0);
END;
$$;
