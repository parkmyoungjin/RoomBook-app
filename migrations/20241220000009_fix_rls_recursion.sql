-- RLS 재귀 문제 해결을 위한 마이그레이션
BEGIN;

-- 1. 기존 RLS 정책 모두 삭제
DROP POLICY IF EXISTS "authenticated_view_active_users" ON users;
DROP POLICY IF EXISTS "users_update_own_profile" ON users;
DROP POLICY IF EXISTS "authenticated_insert_users" ON users;
DROP POLICY IF EXISTS "admin_manage_all_users" ON users;
DROP POLICY IF EXISTS "authenticated_view_rooms" ON rooms;
DROP POLICY IF EXISTS "admin_manage_rooms" ON rooms;
DROP POLICY IF EXISTS "authenticated_view_reservations" ON reservations;
DROP POLICY IF EXISTS "users_manage_own_reservations" ON reservations;
DROP POLICY IF EXISTS "admin_manage_all_reservations" ON reservations;

-- 2. RLS 재활성화
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE reservations DISABLE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- 3. 관리자 확인을 위한 보안 함수 생성
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users u
        WHERE u.auth_id = auth.uid()
        AND u.role = 'admin'
        AND u.is_active = true
    );
END;
$$;

-- 4. 활성 사용자 확인을 위한 보안 함수 생성
CREATE OR REPLACE FUNCTION is_active_user()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users u
        WHERE u.auth_id = auth.uid()
        AND u.is_active = true
    );
END;
$$;

-- 5. 새로운 RLS 정책 설정

-- users 테이블 정책
-- 5.1. 인증된 사용자는 활성 사용자 목록을 볼 수 있음
CREATE POLICY "authenticated_view_active_users"
ON users FOR SELECT
TO authenticated
USING (is_active = true AND is_active_user());

-- 5.2. 사용자는 자신의 정보만 수정 가능
CREATE POLICY "users_update_own_profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = auth_id AND is_active_user())
WITH CHECK (auth.uid() = auth_id AND is_active_user());

-- 5.3. 인증된 사용자는 새 계정을 생성할 수 있음
CREATE POLICY "authenticated_insert_users"
ON users FOR INSERT
TO authenticated
WITH CHECK (is_active_user());

-- 5.4. 관리자는 모든 사용자 정보 관리 가능
CREATE POLICY "admin_manage_all_users"
ON users FOR ALL
TO authenticated
USING (is_admin());

-- rooms 테이블 정책
-- 5.5. 모든 인증된 사용자가 회의실 목록을 볼 수 있음
CREATE POLICY "authenticated_view_rooms"
ON rooms FOR SELECT
TO authenticated
USING (is_active_user());

-- 5.6. 관리자만 회의실 관리 가능
CREATE POLICY "admin_manage_rooms"
ON rooms FOR ALL
TO authenticated
USING (is_admin());

-- reservations 테이블 정책
-- 5.7. 인증된 사용자는 모든 예약을 볼 수 있음
CREATE POLICY "authenticated_view_reservations"
ON reservations FOR SELECT
TO authenticated
USING (is_active_user());

-- 5.8. 사용자는 자신의 예약만 관리 가능
CREATE POLICY "users_manage_own_reservations"
ON reservations FOR ALL
TO authenticated
USING (
    is_active_user() AND
    user_id IN (
        SELECT id FROM users WHERE auth_id = auth.uid()
    )
)
WITH CHECK (
    is_active_user() AND
    user_id IN (
        SELECT id FROM users WHERE auth_id = auth.uid()
    )
);

-- 5.9. 관리자는 모든 예약 관리 가능
CREATE POLICY "admin_manage_all_reservations"
ON reservations FOR ALL
TO authenticated
USING (is_admin());

COMMIT; 