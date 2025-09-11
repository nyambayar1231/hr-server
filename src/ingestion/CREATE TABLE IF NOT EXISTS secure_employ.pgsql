CREATE TABLE IF NOT EXISTS secure_employees (
  id SERIAL PRIMARY KEY,
  employee_hash VARCHAR(64) NOT NULL, -- Hash of email for secure lookup  -- Public field
  employee_role VARCHAR(64) NOT NULL, -- Employee role for 
  
  encrypted_email TEXT NOT NULL,             -- Only user can see own email
  encrypted_salary TEXT NOT NULL,            -- Only user can see own salary

  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index separately in PostgreSQL
CREATE INDEX idx_employee_hash ON secure_employees(employee_hash);

DROP TABLE IF EXISTS secure_employees;
