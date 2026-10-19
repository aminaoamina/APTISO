-- AI service database: its own role, with rights only on its own database.
-- Run once as the PostgreSQL superuser (see apps/ai/README.md), with :ai_password set.
CREATE ROLE aptiso_ai LOGIN PASSWORD :'ai_password';
CREATE DATABASE aptiso_ai OWNER aptiso_ai;
REVOKE ALL ON DATABASE aptiso_ai FROM PUBLIC;
-- The business database stays closed to the AI role.
REVOKE CONNECT ON DATABASE aptiso FROM PUBLIC;
\connect aptiso_ai
CREATE EXTENSION IF NOT EXISTS vector;
