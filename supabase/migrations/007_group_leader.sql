-- Add GROUP_LEADER role
INSERT INTO roles (name, description)
VALUES ('GROUP_LEADER', 'Group leader — read-only access to reports for their assigned group')
ON CONFLICT (name) DO NOTHING;

-- Add group_number to users table (which group this user is responsible for)
ALTER TABLE users ADD COLUMN IF NOT EXISTS group_number INT;
