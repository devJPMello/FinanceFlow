-- Improve dashboard / list queries filtered by user + date range
CREATE INDEX IF NOT EXISTS "transactions_userId_date_idx" ON "transactions" ("userId", "date");
