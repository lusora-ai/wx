import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';

function resolveSqlitePath(url: string): string {
  const rawPath = url.replace(/^file:/, '');
  return resolve(process.cwd(), rawPath);
}

const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
const dbPath = resolveSqlitePath(databaseUrl);
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "Source" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "name" TEXT,
  "title" TEXT,
  "url" TEXT,
  "rawText" TEXT NOT NULL,
  "language" TEXT,
  "sourceAuthor" TEXT,
  "publishedAt" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "region" TEXT NOT NULL DEFAULT 'global',
  "contentHash" TEXT NOT NULL,
  "articleCount" INTEGER NOT NULL DEFAULT 0,
  "lastChecked" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "SourceItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT,
  "rawText" TEXT NOT NULL,
  "summary" TEXT,
  "publishedAt" DATETIME,
  "contentHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Topic" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceId" TEXT,
  "originalTitle" TEXT,
  "originalUrl" TEXT,
  "translatedTitle" TEXT,
  "title" TEXT NOT NULL,
  "angle" TEXT,
  "summary" TEXT NOT NULL,
  "rawContent" TEXT,
  "facts" TEXT NOT NULL,
  "uncertainClaims" TEXT,
  "suggestedTitles" TEXT,
  "targetAudiences" TEXT NOT NULL,
  "category" TEXT,
  "hotScore" INTEGER,
  "readingTime" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Topic_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Article" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "topicId" TEXT,
  "audience" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "markdown" TEXT NOT NULL,
  "html" TEXT,
  "cta" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "visualPlanJson" TEXT,
  "tokenUsage" INTEGER,
  "qualityScore" INTEGER,
  "reviewerFeedback" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Article_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ArticleVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "articleId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "markdown" TEXT NOT NULL,
  "html" TEXT,
  "changeType" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArticleVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ArticleImageSlot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "articleId" TEXT NOT NULL,
  "slotKey" TEXT NOT NULL,
  "paragraphIndex" INTEGER NOT NULL,
  "marker" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "promptZh" TEXT NOT NULL,
  "promptEn" TEXT,
  "negativePrompt" TEXT,
  "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
  "stylePreset" TEXT NOT NULL DEFAULT '公众号科技资讯插图',
  "altText" TEXT,
  "status" TEXT NOT NULL DEFAULT 'prompt_ready',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArticleImageSlot_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ReviewLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "articleId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "result" TEXT,
  "comment" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PublishTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "articleId" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'wechat',
  "mode" TEXT NOT NULL DEFAULT 'dry_run',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "title" TEXT,
  "outputMarkdown" TEXT,
  "outputHtml" TEXT,
  "packageJson" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "syncedVersion" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublishTask_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "OperationLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "operator" TEXT,
  "tokensUsed" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AppSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Source_contentHash_key" ON "Source"("contentHash");
CREATE UNIQUE INDEX IF NOT EXISTS "SourceItem_contentHash_key" ON "SourceItem"("contentHash");
CREATE UNIQUE INDEX IF NOT EXISTS "ArticleVersion_articleId_version_key" ON "ArticleVersion"("articleId", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "AppSetting_key_key" ON "AppSetting"("key");
`);

const sourceColumns = db.prepare(`PRAGMA table_info("Source")`).all() as { name: string }[];
if (!sourceColumns.some((column) => column.name === 'region')) {
  db.exec(`ALTER TABLE "Source" ADD COLUMN "region" TEXT NOT NULL DEFAULT 'global';`);
}

const sourceItemColumns = db.prepare(`PRAGMA table_info("SourceItem")`).all() as { name: string }[];
if (!sourceItemColumns.some((column) => column.name === 'qualityScore')) {
  db.exec(`ALTER TABLE "SourceItem" ADD COLUMN "qualityScore" INTEGER;`);
}
if (!sourceItemColumns.some((column) => column.name === 'qualityIssues')) {
  db.exec(`ALTER TABLE "SourceItem" ADD COLUMN "qualityIssues" TEXT;`);
}

const topicColumns = db.prepare(`PRAGMA table_info("Topic")`).all() as { name: string }[];
if (!topicColumns.some((column) => column.name === 'sourceItemId')) {
  db.exec(`ALTER TABLE "Topic" ADD COLUMN "sourceItemId" TEXT;`);
}

const articleColumns = db.prepare(`PRAGMA table_info("Article")`).all() as { name: string }[];
if (!articleColumns.some((column) => column.name === 'visualPlanJson')) {
  db.exec(`ALTER TABLE "Article" ADD COLUMN "visualPlanJson" TEXT;`);
}

const publishTaskColumns = db.prepare(`PRAGMA table_info("PublishTask")`).all() as { name: string }[];
if (!publishTaskColumns.some((column) => column.name === 'packageJson')) {
  db.exec(`ALTER TABLE "PublishTask" ADD COLUMN "packageJson" TEXT;`);
}

db.exec(`
CREATE TABLE IF NOT EXISTS "FetchTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceId" TEXT,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "total" INTEGER NOT NULL DEFAULT 0,
  "success" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "startedAt" DATETIME,
  "finishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

db.close();
execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'generate'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: databaseUrl },
});
console.log(`SQLite schema is ready at ${dbPath}`);
