-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Anyone can register" ON users;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 1. 모든 인증된 사용자가 활성 사용자 목록을 볼 수 있음
CREATE POLICY "Authenticated users can view active users"
ON users FOR SELECT
USING (
    auth.role() = 'authenticated' 
    AND is_active = true
);

-- 2. 사용자는 자신의 정보만 수정 가능
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
USING (auth.uid()::uuid = auth_id);

-- 3. 관리자는 모든 사용자 정보 관리 가능
CREATE POLICY "Admins can manage all users"
ON users FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE auth_id = auth.uid()::uuid
        AND role = 'admin'
    )
);

-- 4. 트리거 함수 개선
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        auth_id,
        employee_id,
        name,
        email,
        department,
        role,
        is_active
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'employee_id', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'department', 'Not Specified'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'employee')::user_role,
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 