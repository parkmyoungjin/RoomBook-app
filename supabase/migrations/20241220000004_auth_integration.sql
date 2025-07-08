-- Add auth_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id);
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_key ON users(auth_id);

-- Update RLS policies
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Anyone can register" ON users;

-- New policies that use auth_id
CREATE POLICY "Users can update their own profile" ON users 
    FOR UPDATE USING (auth.uid()::uuid = auth_id);

CREATE POLICY "Anyone can register" ON users 
    FOR INSERT WITH CHECK (
        auth.uid()::uuid = auth_id 
        AND role = 'employee'
    );

-- Function to handle user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (auth_id, employee_id, name, department, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'employee_id', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'department', 'Not Specified'),
        'employee'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user record
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user(); 