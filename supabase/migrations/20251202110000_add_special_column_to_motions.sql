-- Add 'special' column to motions table
-- This column tracks whether a motion is marked as a special motion

ALTER TABLE "public"."motions" ADD COLUMN "special" boolean DEFAULT false NOT NULL;
