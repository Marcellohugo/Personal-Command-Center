-- Remove the unused credential column now that the app is local-only.
ALTER TABLE "User" DROP COLUMN "passwordHash";
