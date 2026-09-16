import transmit from '@adonisjs/transmit/services/main'
import logger from '@adonisjs/core/services/logger'

export interface LabelJobEventPayload {
  [key: string]: unknown
  type: string
  jobId: string
  userId: number
  accountId?: number
  supplierName?: string
  requestId?: string
  progress?: number
  totalLabels?: number
  processedLabels?: number
  failedLabels?: number
  status?: string
  errorCode?: string
  errorMessage?: string
  downloadUrl?: string
  timestamp: string
}

export class MeeshoLabelEventBroadcaster {
  static async broadcast(
    userId: number,
    jobId: string,
    type: string,
    extra: Partial<LabelJobEventPayload> = {}
  ): Promise<void> {
    const payload: LabelJobEventPayload = {
      type,
      jobId,
      userId,
      timestamp: new Date().toISOString(),
      ...extra,
    }

    try {
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([_, v]) => v !== undefined)
      )
      // Broadcast to user-level label updates channel
      transmit.broadcast(`meesho-labels/${userId}`, cleanPayload as any)
      // Broadcast to specific job-level stream channel
      transmit.broadcast(`meesho-labels/job/${jobId}`, cleanPayload as any)
    } catch (err: any) {
      logger.warn({ error: err.message, jobId, type }, 'Failed to broadcast SSE label event')
    }
  }
}
