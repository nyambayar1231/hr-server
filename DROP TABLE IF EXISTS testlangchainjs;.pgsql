DROP TABLE IF EXISTS testlangchainjs;

CREATE TABLE testlangchainjs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- 👈 auto-generate id
  content text,
  metadata jsonb,
  vector vector(3072)
);


#check vector type ->\d+ testlangchainjs
