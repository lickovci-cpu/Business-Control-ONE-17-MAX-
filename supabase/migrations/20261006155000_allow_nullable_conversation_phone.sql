-- Conversations can be created from email/web inquiries without a phone number.
-- Keep the existing (organization_id, phone) uniqueness for actual phone values;
-- PostgreSQL permits multiple NULLs in a UNIQUE constraint.
alter table public.conversations
  alter column phone drop not null;
