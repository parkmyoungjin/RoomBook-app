-- Meeting Room Booking System: Initial Schema Migration
-- This migration creates the core database schema for the MVP version

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('employee', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reservation_status AS ENUM ('confirmed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    role user_role DEFAULT 'employee',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create rooms table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    capacity INTEGER DEFAULT 1,
    location VARCHAR(255),
    amenities JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create reservations table
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    purpose TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status reservation_status DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    -- Powerful conflict constraint using PostgreSQL's GIST index
    -- Use btree_gist extension for UUID support in GIST index
    CONSTRAINT no_overlap EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status = 'confirmed')
);

-- Create indexes for performance optimization
CREATE INDEX idx_reservations_room_time ON reservations(room_id, start_time, end_time);
CREATE INDEX idx_reservations_user_status ON reservations(user_id, status);
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_users_department ON users(department);

-- Function to automatically update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to each table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- User Policies
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Anyone can register" ON users FOR INSERT WITH CHECK (role = 'employee');

-- Room Policies
CREATE POLICY "Anyone can view active rooms" ON rooms FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage rooms" ON rooms FOR ALL
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Reservation Policies (Secured)
CREATE POLICY "Users can view their own reservations" ON reservations FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users can create reservations for themselves" ON reservations FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update or cancel their own reservations" ON reservations FOR UPDATE
    USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all reservations" ON reservations FOR ALL
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Function for Public Reservation View
-- This function returns all details for the user's own reservations,
-- but only limited, non-sensitive data for other users' reservations.
CREATE OR REPLACE FUNCTION get_public_reservations(start_date timestamptz, end_date timestamptz)
RETURNS TABLE (
    id uuid,
    room_id uuid,
    user_id uuid,
    title text,
    purpose text,
    department text,
    start_time timestamptz,
    end_time timestamptz,
    is_mine boolean
)
LANGUAGE plpgsql
SECURITY DEFINER -- IMPORTANT: Runs with the definer's privileges to bypass RLS
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.room_id,
        r.user_id,
        CASE
            WHEN r.user_id = auth.uid() THEN r.title
            ELSE 'Booked'
        END AS title,
        CASE
            WHEN r.user_id = auth.uid() THEN r.purpose
            ELSE NULL
        END AS purpose,
        u.department,
        r.start_time,
        r.end_time,
        (r.user_id = auth.uid()) as is_mine
    FROM reservations r
    JOIN users u ON r.user_id = u.id
    WHERE
        r.status = 'confirmed' AND
        r.start_time < end_date AND
        r.end_time > start_date;
END;
$$;

-- Initial Data Seeding
-- Default rooms
INSERT INTO rooms (name, description, capacity, location, amenities) VALUES
('Room A', 'Main conference room', 10, '1st Floor', '{"projector": true, "whiteboard": true, "wifi": true}'),
('Room B', 'Small meeting room', 4, '2nd Floor', '{"tv": true, "whiteboard": true, "wifi": true}');

-- Admin account (in a real scenario, this would be created via Supabase Auth)
INSERT INTO users (employee_id, name, department, role) VALUES
('ADMIN001', 'Administrator', 'IT', 'admin'); 