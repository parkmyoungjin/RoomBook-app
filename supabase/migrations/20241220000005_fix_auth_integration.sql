-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recreate function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_employee_id TEXT;
    v_name TEXT;
    v_department TEXT;
BEGIN
    -- Extract metadata from auth user
    v_employee_id := SPLIT_PART(NEW.email, '@', 1);
    v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);
    v_department := COALESCE(NEW.raw_user_meta_data->>'department', 'Not Specified');

    -- Insert into users table
    INSERT INTO public.users (
        auth_id,
        employee_id,
        name,
        department,
        role
    ) VALUES (
        NEW.id,
        v_employee_id,
        v_name,
        v_department,
        'employee'
    );

    RETURN NEW;
EXCEPTION WHEN others THEN
    -- Log error details
    RAISE NOTICE 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Anyone can register" ON users;

-- New policies
CREATE POLICY "Users can view all users" 
    ON users FOR SELECT 
    USING (true);

CREATE POLICY "Users can update their own profile" 
    ON users FOR UPDATE 
    USING (auth.uid()::uuid = auth_id);

CREATE POLICY "Anyone can register" 
    ON users FOR INSERT 
    WITH CHECK (
        auth.uid()::uuid = auth_id 
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'employee_id' = employee_id
        )
    );

-- Enable Supabase Auth email confirmations
UPDATE auth.config
SET enable_signup = true,
    enable_confirmations = false,
    mailer_autoconfirm = true; 