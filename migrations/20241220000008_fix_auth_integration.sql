-- 인증 통합 문제 해결을 위한 마이그레이션
BEGIN;

-- 1. users 테이블에 auth_id와 email 컬럼이 있는지 확인하고 없으면 추가
DO $$
BEGIN
    -- auth_id 컬럼 추가 (이미 있으면 무시)
    BEGIN
        ALTER TABLE users ADD COLUMN auth_id UUID UNIQUE;
        CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
    EXCEPTION
        WHEN duplicate_column THEN
            -- 컬럼이 이미 존재하면 무시
            NULL;
    END;
    
    -- email 컬럼 추가 (이미 있으면 무시)
    BEGIN
        ALTER TABLE users ADD COLUMN email VARCHAR(255);
    EXCEPTION
        WHEN duplicate_column THEN
            -- 컬럼이 이미 존재하면 무시
            NULL;
    END;
END
$$;

-- 2. 기존 RLS 정책 모두 삭제
DROP POLICY IF EXISTS "view_active_users" ON users;
DROP POLICY IF EXISTS "update_own_profile" ON users;
DROP POLICY IF EXISTS "admin_manage_users" ON users;
DROP POLICY IF EXISTS "view_rooms" ON rooms;
DROP POLICY IF EXISTS "admin_manage_rooms" ON rooms;
DROP POLICY IF EXISTS "view_reservations" ON reservations;
DROP POLICY IF EXISTS "manage_own_reservations" ON reservations;
DROP POLICY IF EXISTS "admin_manage_reservations" ON reservations;
DROP POLICY IF EXISTS "Authenticated users can view active users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- 3. RLS 비활성화 후 재활성화
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE reservations DISABLE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- 4. 새로운 RLS 정책 설정

-- users 테이블 정책
-- 4.1. 인증된 사용자는 활성 사용자 목록을 볼 수 있음
CREATE POLICY "authenticated_view_active_users"
ON users FOR SELECT
TO authenticated
USING (is_active = true);

-- 4.2. 사용자는 자신의 정보만 수정 가능
CREATE POLICY "users_update_own_profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);

-- 4.3. 인증된 사용자는 새 계정을 생성할 수 있음 (회원가입용)
CREATE POLICY "authenticated_insert_users"
ON users FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4.4. 관리자는 모든 사용자 정보 관리 가능
CREATE POLICY "admin_manage_all_users"
ON users FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users u
        WHERE u.auth_id = auth.uid()
        AND u.role = 'admin'
        AND u.is_active = true
    )
);

-- rooms 테이블 정책
-- 4.5. 모든 인증된 사용자가 회의실 목록을 볼 수 있음
CREATE POLICY "authenticated_view_rooms"
ON rooms FOR SELECT
TO authenticated
USING (true);

-- 4.6. 관리자만 회의실 관리 가능
CREATE POLICY "admin_manage_rooms"
ON rooms FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users u
        WHERE u.auth_id = auth.uid()
        AND u.role = 'admin'
        AND u.is_active = true
    )
);

-- reservations 테이블 정책
-- 4.7. 인증된 사용자는 모든 예약을 볼 수 있음
CREATE POLICY "authenticated_view_reservations"
ON reservations FOR SELECT
TO authenticated
USING (true);

-- 4.8. 사용자는 자신의 예약만 삽입/수정/삭제 가능
CREATE POLICY "users_manage_own_reservations"
ON reservations FOR ALL
TO authenticated
USING (
    user_id IN (
        SELECT id FROM users WHERE auth_id = auth.uid()
    )
)
WITH CHECK (
    user_id IN (
        SELECT id FROM users WHERE auth_id = auth.uid()
    )
);

-- 4.9. 관리자는 모든 예약 관리 가능
CREATE POLICY "admin_manage_all_reservations"
ON reservations FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users u
        WHERE u.auth_id = auth.uid()
        AND u.role = 'admin'
        AND u.is_active = true
    )
);

-- 5. 트리거 재설정
-- 5.1. auth.users에서 public.users로 자동 복사하는 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (auth_id, email, employee_id, name, department, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'employee_id', '0000000'),
    COALESCE(NEW.raw_user_meta_data->>'name', 'Unknown'),
    COALESCE(NEW.raw_user_meta_data->>'department', 'Unknown'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee'),
    true
  )
  ON CONFLICT (auth_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    employee_id = COALESCE(NEW.raw_user_meta_data->>'employee_id', users.employee_id),
    name = COALESCE(NEW.raw_user_meta_data->>'name', users.name),
    department = COALESCE(NEW.raw_user_meta_data->>'department', users.department),
    role = COALESCE((NEW.raw_user_meta_data->>'role')::user_role, users.role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.2. 트리거가 이미 존재하면 삭제 후 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
