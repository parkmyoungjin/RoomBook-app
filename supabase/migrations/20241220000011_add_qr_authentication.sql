-- QR 코드 인증 시스템 추가
BEGIN;

-- 1. users 테이블에 QR 관련 필드 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS qr_token VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS qr_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS qr_last_used TIMESTAMPTZ;

-- 2. QR 로그인 세션 테이블 생성
CREATE TABLE IF NOT EXISTS qr_login_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    qr_token VARCHAR(255) NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. QR 토큰 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_qr_token ON users(qr_token);
CREATE INDEX IF NOT EXISTS idx_users_qr_expires ON users(qr_expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_sessions_token ON qr_login_sessions(qr_token);
CREATE INDEX IF NOT EXISTS idx_qr_sessions_user_active ON qr_login_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_qr_sessions_expires ON qr_login_sessions(expires_at);

-- 4. QR 토큰 생성 함수
CREATE OR REPLACE FUNCTION generate_qr_token_for_user(user_id UUID)
RETURNS TABLE (
    qr_token VARCHAR(255),
    expires_at TIMESTAMPTZ
) AS $$
DECLARE
    new_token VARCHAR(255);
    expiry_time TIMESTAMPTZ;
BEGIN
    -- 24시간 후 만료
    expiry_time := NOW() + INTERVAL '24 hours';
    
    -- 사용자ID + 현재시간 + 랜덤값으로 토큰 생성
    new_token := encode(
        digest(
            user_id::TEXT || 
            extract(epoch from NOW())::TEXT || 
            random()::TEXT, 
            'sha256'
        ), 
        'base64'
    );
    
    -- 특수문자 제거하고 URL 안전한 형태로 변환
    new_token := translate(new_token, '+/=', '-_');
    new_token := substring(new_token from 1 for 32);
    
    -- users 테이블에 토큰 업데이트
    UPDATE users SET 
        qr_token = new_token,
        qr_expires_at = expiry_time,
        updated_at = NOW()
    WHERE id = user_id;
    
    RETURN QUERY SELECT new_token, expiry_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. QR 토큰 검증 함수
CREATE OR REPLACE FUNCTION validate_qr_token(token VARCHAR(255))
RETURNS TABLE (
    user_id UUID,
    employee_id VARCHAR(50),
    name VARCHAR(100),
    department VARCHAR(100),
    role user_role,
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.employee_id,
        u.name,
        u.department,
        u.role,
        (u.qr_token = token AND u.qr_expires_at > NOW() AND u.is_active = true) as is_valid
    FROM users u
    WHERE u.qr_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. QR 토큰 사용 기록 함수
CREATE OR REPLACE FUNCTION record_qr_usage(
    token VARCHAR(255),
    device_info JSONB DEFAULT '{}',
    ip_address INET DEFAULT NULL,
    user_agent TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    target_user_id UUID;
    is_valid BOOLEAN;
BEGIN
    -- 토큰 유효성 검증
    SELECT user_id, is_valid 
    INTO target_user_id, is_valid
    FROM validate_qr_token(token);
    
    IF NOT is_valid THEN
        RETURN FALSE;
    END IF;
    
    -- 사용 기록 업데이트
    UPDATE users SET 
        qr_last_used = NOW(),
        updated_at = NOW()
    WHERE id = target_user_id;
    
    -- 세션 기록 생성
    INSERT INTO qr_login_sessions (
        user_id,
        qr_token,
        device_info,
        ip_address,
        user_agent,
        expires_at
    ) VALUES (
        target_user_id,
        token,
        device_info,
        ip_address,
        user_agent,
        NOW() + INTERVAL '24 hours'
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 만료된 QR 토큰 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_qr_tokens()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- 만료된 토큰 정리
    UPDATE users SET 
        qr_token = NULL,
        qr_expires_at = NULL,
        updated_at = NOW()
    WHERE qr_expires_at < NOW();
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    -- 만료된 세션 정리
    DELETE FROM qr_login_sessions 
    WHERE expires_at < NOW();
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RLS 정책 추가
-- QR 세션 테이블에 RLS 적용
ALTER TABLE qr_login_sessions ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 QR 세션만 볼 수 있음
CREATE POLICY "Users can view their own QR sessions"
    ON qr_login_sessions FOR SELECT
    USING (
        user_id = (
            SELECT id FROM users WHERE auth_id = auth.uid()
        )
    );

-- 관리자는 모든 QR 세션을 볼 수 있음
CREATE POLICY "Admins can view all QR sessions"
    ON qr_login_sessions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE auth_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 9. 트리거 추가 (updated_at 자동 업데이트)
CREATE TRIGGER update_qr_sessions_updated_at 
    BEFORE UPDATE ON qr_login_sessions
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 10. 기본 데이터 설정
-- 기존 사용자들에게 QR 토큰 생성 (선택사항)
-- INSERT INTO users (employee_id, name, department, role) VALUES 
-- ('QR001', 'QR 테스트 사용자', 'IT', 'employee')
-- ON CONFLICT (employee_id) DO NOTHING;

COMMIT;

-- 성공 메시지
DO $$
BEGIN
    RAISE NOTICE 'QR 인증 시스템이 성공적으로 추가되었습니다.';
    RAISE NOTICE '- users 테이블에 QR 토큰 필드 추가';
    RAISE NOTICE '- qr_login_sessions 테이블 생성';
    RAISE NOTICE '- QR 토큰 관련 함수들 생성';
    RAISE NOTICE '- RLS 정책 적용 완료';
END $$; 