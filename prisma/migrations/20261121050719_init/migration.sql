-- Trigram matching for fuzzy search (used by the GIN indexes below).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'SPEECH', 'TRANSCRIPTION', 'EMBEDDING', 'RERANKING', 'REALTIME');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('ACTIVE', 'BETA', 'ALPHA', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "Modality" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'PDF');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "labs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "country" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "docsUrl" TEXT,
    "apiBaseUrl" TEXT,
    "sdkPackage" TEXT,
    "isSubscription" BOOLEAN NOT NULL DEFAULT false,
    "hasFreeTier" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "models" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "family" TEXT,
    "labId" TEXT NOT NULL,
    "type" "ModelType" NOT NULL DEFAULT 'TEXT',
    "status" "ModelStatus" NOT NULL DEFAULT 'ACTIVE',
    "inputModalities" "Modality"[],
    "outputModalities" "Modality"[],
    "reasoning" BOOLEAN NOT NULL DEFAULT false,
    "toolCalling" BOOLEAN NOT NULL DEFAULT false,
    "structuredOutput" BOOLEAN NOT NULL DEFAULT false,
    "temperature" BOOLEAN NOT NULL DEFAULT false,
    "attachments" BOOLEAN NOT NULL DEFAULT false,
    "openWeights" BOOLEAN NOT NULL DEFAULT false,
    "contextWindow" INTEGER,
    "maxOutputTokens" INTEGER,
    "knowledgeCutoff" TEXT,
    "releaseDate" TIMESTAMP(3),
    "lastUpdated" TIMESTAMP(3),
    "inputPrice" DOUBLE PRECISION,
    "outputPrice" DOUBLE PRECISION,
    "priceIsOfficial" BOOLEAN NOT NULL DEFAULT false,
    "minInputPrice" DOUBLE PRECISION,
    "minOutputPrice" DOUBLE PRECISION,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "providerCount" INTEGER NOT NULL DEFAULT 0,
    "intelligenceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offerings" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerModelId" TEXT NOT NULL,
    "inputPrice" DOUBLE PRECISION,
    "outputPrice" DOUBLE PRECISION,
    "cacheReadPrice" DOUBLE PRECISION,
    "cacheWritePrice" DOUBLE PRECISION,
    "contextWindow" INTEGER,
    "maxOutputTokens" INTEGER,
    "deprecated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_snapshots" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "inputPrice" DOUBLE PRECISION,
    "outputPrice" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmarks" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "unit" TEXT NOT NULL,
    "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_scores" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "benchmarkId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_runs" (
    "id" TEXT NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "stats" JSONB,
    "error" TEXT,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "labs_slug_key" ON "labs"("slug");

-- CreateIndex
CREATE INDEX "labs_name_trgm_idx" ON "labs" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "providers_slug_key" ON "providers"("slug");

-- CreateIndex
CREATE INDEX "providers_name_trgm_idx" ON "providers" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "models_slug_key" ON "models"("slug");

-- CreateIndex
CREATE INDEX "models_labId_idx" ON "models"("labId");

-- CreateIndex
CREATE INDEX "models_type_status_idx" ON "models"("type", "status");

-- CreateIndex
CREATE INDEX "models_releaseDate_idx" ON "models"("releaseDate");

-- CreateIndex
CREATE INDEX "models_inputPrice_idx" ON "models"("inputPrice");

-- CreateIndex
CREATE INDEX "models_contextWindow_idx" ON "models"("contextWindow");

-- CreateIndex
CREATE INDEX "models_intelligenceScore_idx" ON "models"("intelligenceScore");

-- CreateIndex
CREATE INDEX "models_providerCount_idx" ON "models"("providerCount");

-- CreateIndex
CREATE INDEX "models_name_trgm_idx" ON "models" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "models_slug_trgm_idx" ON "models" USING GIN ("slug" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "offerings_modelId_idx" ON "offerings"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "offerings_providerId_providerModelId_key" ON "offerings"("providerId", "providerModelId");

-- CreateIndex
CREATE INDEX "price_snapshots_offeringId_capturedAt_idx" ON "price_snapshots"("offeringId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "benchmarks_slug_key" ON "benchmarks"("slug");

-- CreateIndex
CREATE INDEX "benchmark_scores_benchmarkId_score_idx" ON "benchmark_scores"("benchmarkId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_scores_modelId_benchmarkId_key" ON "benchmark_scores"("modelId", "benchmarkId");

-- CreateIndex
CREATE INDEX "ingestion_runs_startedAt_idx" ON "ingestion_runs"("startedAt");

-- AddForeignKey
ALTER TABLE "models" ADD CONSTRAINT "models_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_scores" ADD CONSTRAINT "benchmark_scores_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_scores" ADD CONSTRAINT "benchmark_scores_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "benchmarks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
