import { prisma } from '../db/prisma';

export async function writeLog(input: {
  module: string;
  action: string;
  type: 'info' | 'success' | 'warning' | 'error';
  operator?: string;
  tokensUsed?: number;
}) {
  try {
    await prisma.operationLog.create({
      data: {
        module: input.module,
        action: input.action,
        type: input.type,
        operator: input.operator ?? 'system',
        tokensUsed: input.tokensUsed,
      },
    });
  } catch (error) {
    console.error('Failed to write operation log', error);
  }
}
