-- 1. 기존 RLS 정책 초기화
BEGIN;

-- users 테이블의 모든 정책 삭제
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Anyone can register" ON users;
DROP POLICY IF EXISTS "Authenticated users can view active users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- reservations 테이블의 모든 정책 삭제
DROP POLICY IF EXISTS "Users can view all reservations" ON reservations;
DROP POLICY IF EXISTS "Users can manage their own reservations" ON reservations;
DROP POLICY IF EXISTS "Admins can manage all reservations" ON reservations;

-- rooms 테이블의 모든 정책 삭제
DROP POLICY IF EXISTS "Users can view all rooms" ON rooms;
DROP POLICY IF EXISTS "Admins can manage rooms" ON rooms;

-- 2. RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- 3. 새로운 RLS 정책 설정

-- users 테이블 정책
-- 3.1. 인증된 사용자는 활성 사용자 목록을 볼 수 있음
CREATE POLICY "view_active_users"
ON users FOR SELECT
USING (
    auth.role() = 'authenticated' 
    AND is_active = true
);

-- 3.2. 사용자는 자신의 정보만 수정 가능
CREATE POLICY "update_own_profile"
ON users FOR UPDATE
USING (auth.uid()::uuid = auth_id)
WITH CHECK (auth.uid()::uuid = auth_id);

-- 3.3. 관리자는 모든 사용자 정보 관리 가능
CREATE POLICY "admin_manage_users"
ON users FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE auth_id = auth.uid()::uuid
        AND role = 'admin'
    )
);

-- rooms 테이블 정책
-- 3.4. 모든 인증된 사용자가 회의실 목록을 볼 수 있음
CREATE POLICY "view_rooms"
ON rooms FOR SELECT
USING (auth.role() = 'authenticated');

-- 3.5. 관리자만 회의실 관리 가능
CREATE POLICY "admin_manage_rooms"
ON rooms FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE auth_id = auth.uid()::uuid
        AND role = 'admin'
    )
);

-- reservations 테이블 정책
-- 3.6. 인증된 사용자는 모든 예약을 볼 수 있음
CREATE POLICY "view_reservations"
ON reservations FOR SELECT
USING (auth.role() = 'authenticated');

-- 3.7. 사용자는 자신의 예약만 관리 가능
CREATE POLICY "manage_own_reservations"
ON reservations FOR ALL
USING (
    auth.uid()::uuid = (
        SELECT auth_id FROM users WHERE id = reservations.user_id
    )
);

-- 3.8. 관리자는 모든 예약 관리 가능
CREATE POLICY "admin_manage_reservations"
ON reservations FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE auth_id = auth.uid()::uuid
        AND role = 'admin'
    )
);

-- 4. 트리거 재설정
-- 4.1. auth.users에서 public.users로 자동 복사하는 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (auth_id, email, employee_id, name, department, role, is_active)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'employee_id', '0000000'),
    COALESCE(new.raw_user_meta_data->>'name', 'Unknown'),
    COALESCE(new.raw_user_meta_data->>'department', 'Unknown'),
    COALESCE(new.raw_user_meta_data->>'role', 'employee')::user_role,
    true
  )
  ON CONFLICT (auth_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    employee_id = COALESCE(new.raw_user_meta_data->>'employee_id', users.employee_id),
    name = COALESCE(new.raw_user_meta_data->>'name', users.name),
    department = COALESCE(new.raw_user_meta_data->>'department', users.department),
    role = COALESCE((new.raw_user_meta_data->>'role')::user_role, users.role);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2. 트리거가 이미 존재하면 삭제 후 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT; 