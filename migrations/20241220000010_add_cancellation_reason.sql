-- Add cancellation_reason column to reservations table
ALTER TABLE reservations ADD COLUMN cancellation_reason TEXT;

-- Set default reason for existing cancelled reservations
UPDATE reservations 
SET cancellation_reason = '(이전 취소 기록)'
WHERE status = 'cancelled' AND cancellation_reason IS NULL; 