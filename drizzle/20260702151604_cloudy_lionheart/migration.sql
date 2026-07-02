CREATE TABLE "uploaded_files" (
	"key" text PRIMARY KEY,
	"fileId" text NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
