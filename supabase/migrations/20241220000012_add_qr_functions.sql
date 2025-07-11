-- QR 인증 시스템 함수들
BEGIN;

-- 1. QR 토큰 생성 함수
CREATE OR REPLACE FUNCTION generate_qr_token_for_user(user_id uuid)
RETURNS TABLE(qr_token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_token text;
    token_expires timestamptz;
BEGIN
    -- 24시간 후 만료되는 토큰 생성
    new_token := encode(gen_random_bytes(32), 'hex');
    token_expires := NOW() + INTERVAL '24 hours';
    
    -- 사용자 테이블에 토큰 업데이트
    UPDATE users 
    SET 
        qr_token = new_token,
        qr_expires_at = token_expires,
        updated_at = NOW()
    WHERE id = user_id;
    
    -- 토큰 정보 반환
    RETURN QUERY SELECT new_token, token_expires;
END;
$$;

-- 2. QR 토큰 검증 함수
CREATE OR REPLACE FUNCTION validate_qr_token(token text)
RETURNS TABLE(
    user_id uuid,
    employee_id text,
    name text,
    department text,
    role text,
    is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record users%ROWTYPE;
    token_valid boolean := false;
BEGIN
    -- 토큰으로 사용자 조회
    SELECT * INTO user_record
    FROM users u
    WHERE u.qr_token = token
    AND u.is_active = true;
    
    -- 사용자가 존재하고 토큰이 유효한지 확인
    IF FOUND THEN
        -- 토큰 만료 확인
        IF user_record.qr_expires_at > NOW() THEN
            token_valid := true;
        END IF;
    END IF;
    
    -- 결과 반환
    IF token_valid THEN
        RETURN QUERY SELECT 
            user_record.id,
            user_record.employee_id,
            user_record.name,
            user_record.department,
            user_record.role::text,
            token_valid;
    ELSE
        RETURN QUERY SELECT 
            NULL::uuid,
            NULL::text,
            NULL::text,
            NULL::text,
            NULL::text,
            false;
    END IF;
END;
$$;

-- 3. QR 로그인 세션 생성 함수
CREATE OR REPLACE FUNCTION create_qr_login_session(
    p_user_id uuid,
    p_qr_token text,
    p_device_info jsonb DEFAULT '{}',
    p_ip_address inet DEFAULT NULL,
    p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    session_id uuid;
    session_expires timestamptz;
BEGIN
    -- 세션 ID 생성
    session_id := gen_random_uuid();
    session_expires := NOW() + INTERVAL '7 days';
    
    -- QR 로그인 세션 생성
    INSERT INTO qr_login_sessions (
        id,
        user_id,
        qr_token,
        device_info,
        ip_address,
        user_agent,
        expires_at
    ) VALUES (
        session_id,
        p_user_id,
        p_qr_token,
        p_device_info,
        p_ip_address,
        p_user_agent,
        session_expires
    );
    
    -- 사용자 테이블의 QR 사용 시간 업데이트
    UPDATE users 
    SET 
        qr_last_used = NOW(),
        updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN session_id;
END;
$$;

-- 4. QR 로그인 세션 정리 함수 (만료된 세션 삭제)
CREATE OR REPLACE FUNCTION cleanup_expired_qr_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- 만료된 세션 삭제
    DELETE FROM qr_login_sessions 
    WHERE expires_at < NOW() OR is_active = false;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- 만료된 QR 토큰 정리
    UPDATE users 
    SET 
        qr_token = NULL,
        qr_expires_at = NULL,
        updated_at = NOW()
    WHERE qr_expires_at < NOW();
    
    RETURN deleted_count;
END;
$$;

-- 5. 사용자 QR 토큰 상태 조회 함수
CREATE OR REPLACE FUNCTION get_user_qr_status(p_user_id uuid)
RETURNS TABLE(
    has_active_token boolean,
    token_expires_at timestamptz,
    last_used_at timestamptz,
    active_sessions_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record users%ROWTYPE;
    sessions_count integer := 0;
    has_token boolean := false;
BEGIN
    -- 사용자 정보 조회
    SELECT * INTO user_record
    FROM users u
    WHERE u.id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::timestamptz, NULL::timestamptz, 0;
        RETURN;
    END IF;
    
    -- 활성 QR 토큰 확인
    IF user_record.qr_token IS NOT NULL AND user_record.qr_expires_at > NOW() THEN
        has_token := true;
    END IF;
    
    -- 활성 세션 수 계산
    SELECT COUNT(*) INTO sessions_count
    FROM qr_login_sessions 
    WHERE user_id = p_user_id 
    AND expires_at > NOW() 
    AND is_active = true;
    
    RETURN QUERY SELECT 
        has_token,
        user_record.qr_expires_at,
        user_record.qr_last_used,
        sessions_count;
END;
$$;

-- 6. QR 토큰 무효화 함수
CREATE OR REPLACE FUNCTION invalidate_user_qr_token(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 사용자의 QR 토큰 무효화
    UPDATE users 
    SET 
        qr_token = NULL,
        qr_expires_at = NULL,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- 해당 사용자의 모든 QR 로그인 세션 비활성화
    UPDATE qr_login_sessions 
    SET 
        is_active = false,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN true;
END;
$$;

-- 7. 정리 작업을 위한 크론 스케줄러 함수 (Supabase Edge Functions와 연동)
CREATE OR REPLACE FUNCTION schedule_qr_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 만료된 QR 세션 정리
    PERFORM cleanup_expired_qr_sessions();
    
    -- 로그 기록
    INSERT INTO qr_login_sessions (
        id,
        user_id,
        qr_token,
        device_info,
        is_active,
        expires_at
    ) VALUES (
        gen_random_uuid(),
        NULL,
        'CLEANUP_LOG',
        jsonb_build_object(
            'action', 'cleanup',
            'timestamp', NOW(),
            'type', 'scheduled'
        ),
        false,
        NOW() + INTERVAL '1 hour'
    );
END;
$$;

COMMIT; 