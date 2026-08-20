import type { Prisma } from '@prisma/client';
import { prisma } from '@config/database';

export const AiModel = {
  record: (data: Prisma.AiGenerationCreateInput) => prisma.aiGeneration.create({ data }),

  listForUser: (userId: string, args: { skip: number; take: number }) =>
    prisma.aiGeneration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      ...args,
      select: {
        id: true,
        feature: true,
        model: true,
        purpose: true,
        tone: true,
        totalTokens: true,
        costUsd: true,
        latencyMs: true,
        success: true,
        errorMessage: true,
        createdAt: true,
      },
    }),

  count: (userId: string) => prisma.aiGeneration.count({ where: { userId } }),

  /** Spend and volume over a window — drives the AI usage widget. */
  usageSummary: (userId: string, from: Date, to: Date) =>
    prisma.aiGeneration.aggregate({
      where: { userId, createdAt: { gte: from, lte: to } },
      _sum: { totalTokens: true, costUsd: true, promptTokens: true, completionTokens: true },
      _count: { _all: true },
      _avg: { latencyMs: true },
    }),

  byFeature: (userId: string, from: Date, to: Date) =>
    prisma.aiGeneration.groupBy({
      by: ['feature'],
      where: { userId, createdAt: { gte: from, lte: to } },
      _sum: { totalTokens: true, costUsd: true },
      _count: { _all: true },
    }),
};

export default AiModel;
