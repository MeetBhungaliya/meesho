import { Job } from '@adonisjs/queue'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import MeeshoLabelJob from '#models/meesho_label_job'
import MeeshoLabelJobAccount from '#models/meesho_label_job_account'
import { MeeshoLabelApiService } from '#services/meesho_label/meesho_label_api_service'
import { MeeshoLabelEventBroadcaster } from '#services/meesho_label/meesho_label_event_broadcaster'
import MeeshoLabelPollJob from '#jobs/meesho_label/meesho_label_poll_job'
import MeeshoLabelFinalizeJob from '#jobs/meesho_label/meesho_label_finalize_job'
import { LABEL_ERROR_CODES } from '#services/external_api/constants'

export interface MeeshoLabelStartJobPayload {
  jobId: string
  jobAccountId: number
  accountId: number
  userId: number
}

export default class MeeshoLabelStartJob extends Job<MeeshoLabelStartJobPayload> {
  async execute(): Promise<void> {
    const { jobId, jobAccountId, accountId, userId } = this.payload

    const jobAccount = await MeeshoLabelJobAccount.find(jobAccountId)
    if (!jobAccount) {
      logger.error({ jobAccountId, jobId }, 'MeeshoLabelStartJob: jobAccount record not found')
      return
    }

    // Idempotency check: only process if status is PENDING or REQUESTING
    if (!['PENDING', 'REQUESTING'].includes(jobAccount.status)) {
      logger.info(
        { jobAccountId, status: jobAccount.status },
        'MeeshoLabelStartJob: skipping already started account'
      )
      return
    }

    jobAccount.status = 'REQUESTING'
    jobAccount.attemptCount += 1
    await jobAccount.save()

    await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'account_started', {
      accountId,
      status: 'REQUESTING',
    })

    try {
      const result = await MeeshoLabelApiService.requestLabelDownload(String(accountId))

      jobAccount.supplierId = String(result.supplier.supplierId)
      jobAccount.identifier = result.supplier.identifier
      jobAccount.supplierName = result.supplier.name
      jobAccount.meeshoRequestId = result.requestId
      jobAccount.status = 'POLLING'
      jobAccount.requestedAt = DateTime.now()
      jobAccount.errorCode = null
      jobAccount.errorMessage = null
      await jobAccount.save()

      logger.info(
        {
          jobId,
          jobAccountId,
          accountId,
          requestId: result.requestId,
        },
        'Meesho label generation requested successfully'
      )

      await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'request_id_created', {
        accountId,
        requestId: result.requestId,
        supplierName: result.supplier.name,
        status: 'POLLING',
      })

      // Dispatch recursive polling job with 10s initial delay
      await MeeshoLabelPollJob.dispatch({
        jobId,
        jobAccountId,
        accountId,
        userId,
        attempt: 1,
      }).in('10s')
    } catch (err: any) {
      logger.error(
        { jobId, jobAccountId, accountId, error: err.message },
        'MeeshoLabelStartJob failed'
      )

      jobAccount.status = 'FAILED'
      jobAccount.errorCode = LABEL_ERROR_CODES.MEESHO_REQUEST_FAILED
      jobAccount.errorMessage = err.message || 'Failed to request label download from Meesho'
      jobAccount.completedAt = DateTime.now()
      await jobAccount.save()

      await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'account_failed', {
        accountId,
        errorCode: jobAccount.errorCode || undefined,
        errorMessage: jobAccount.errorMessage || undefined,
        status: 'FAILED',
      })

      // Check if all accounts for this job are completed or failed
      await this.checkJobFinalization(jobId, userId)
    }
  }

  private async checkJobFinalization(jobId: string, userId: number): Promise<void> {
    const parentJob = await MeeshoLabelJob.find(jobId)
    if (!parentJob) return

    const accounts = await MeeshoLabelJobAccount.query().where('job_id', jobId)
    const allTerminal = accounts.every((acc) => ['PROCESSED', 'FAILED'].includes(acc.status))

    if (allTerminal) {
      await MeeshoLabelFinalizeJob.dispatch({ jobId, userId })
    }
  }

  async failed(error: Error): Promise<void> {
    logger.error(
      { error: error.message, payload: this.payload },
      'MeeshoLabelStartJob uncaught error'
    )
  }
}
