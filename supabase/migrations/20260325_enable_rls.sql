-- Enable Row Level Security on all public tables
-- Server uses service_role key which bypasses RLS
-- No policies = deny all direct access by default

ALTER TABLE IF EXISTS watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS portfolio_history ENABLE ROW LEVEL SECURITY;
