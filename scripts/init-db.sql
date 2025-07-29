-- PostgreSQL Database Initialization Script for YingYu
-- This script runs when the PostgreSQL container first starts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create additional indexes for performance (will be applied after Prisma migrations)
-- These are supplementary indexes beyond what Prisma generates

-- Note: The main schema and tables are created by Prisma migrations
-- This script only handles PostgreSQL-specific optimizations

-- Set up connection pooling settings
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Reload configuration
SELECT pg_reload_conf();