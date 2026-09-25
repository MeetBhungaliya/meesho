import { Job } from '@adonisjs/queue'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import MeeshoLabelJob from '#models/meesho_label_job'
import MeeshoLabelJobAccount from '#models/meesho_label_job_account'
import { MeeshoLabelApiService } from '#services/meesho_label/meesho_label_api_service'
import { MeeshoLabelEventBroadcaster } from '#services/meesho_label/meesho_label_event_broadcaster'
import MeeshoLabelDownloadJob from '#jobs/meesho_label/meesho_label_download_job'
import MeeshoLabelFinalizeJob from '#jobs/meesho_label/meesho_label_finalize_job'
import { LABEL_ERROR_CODES } from '#services/external_api/constants'

export interface MeeshoLabelPollJobPayload {
  jobId: string
  jobAccountId: number
  accountId: number
  userId: number
  attempt?: number
}

const MAX_POLL_ATTEMPTS = 60 // 60 attempts * 10s = 10 minutes maximum polling window

export default class MeeshoLabelPollJob extends Job<MeeshoLabelPollJobPayload> {
  async execute(): Promise<void> {
    const { jobId, jobAccountId, accountId, userId } = this.payload
    const attempt = this.payload.attempt || 1

    const jobAccount = await MeeshoLabelJobAccount.find(jobAccountId)
    if (!jobAccount) {
      logger.error({ jobAccountId, jobId }, 'MeeshoLabelPollJob: jobAccount record not found')
      return
    }

    // Idempotency check: if already completed, downloaded, or failed, exit immediately
    const terminalOrAdvancedStatuses = [
      'READY_FOR_DOWNLOAD',
      'DOWNLOADING',
      'DOWNLOADED',
      'PROCESSING',
      'PROCESSED',
      'FAILED',
    ]
    if (terminalOrAdvancedStatuses.includes(jobAccount.status)) {
      logger.info(
        { jobAccountId, status: jobAccount.status },
        'MeeshoLabelPollJob: account already past polling stage, skipping'
      )
      return
    }

    if (!jobAccount.meeshoRequestId) {
      logger.error({ jobAccountId }, 'MeeshoLabelPollJob: no meeshoRequestId found')
      jobAccount.status = 'FAILED'
      jobAccount.errorCode = LABEL_ERROR_CODES.MEESHO_REQUEST_ID_NOT_FOUND
      jobAccount.errorMessage = 'Missing Meesho request_id in database'
      jobAccount.completedAt = DateTime.now()
      await jobAccount.save()
      await this.checkJobFinalization(jobId, userId)
      return
    }

    try {
      const history = await MeeshoLabelApiService.fetchLabelDownloadHistory(String(accountId))
      const match = MeeshoLabelApiService.findRequestInHistory(history, jobAccount.meeshoRequestId)

      if (!match) {
        if (attempt >= MAX_POLL_ATTEMPTS) {
          logger.warn(
            { jobId, jobAccountId, requestId: jobAccount.meeshoRequestId },
            'MeeshoLabelPollJob: request_id not found after maximum polling attempts'
          )
          jobAccount.status = 'FAILED'
          jobAccount.errorCode = LABEL_ERROR_CODES.MEESHO_REQUEST_ID_NOT_FOUND
          jobAccount.errorMessage = `Request ${jobAccount.meeshoRequestId} not found in Meesho history after ${attempt} attempts`
          jobAccount.completedAt = DateTime.now()
          await jobAccount.save()

          await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'account_failed', {
            accountId,
            errorCode: jobAccount.errorCode,
            errorMessage: jobAccount.errorMessage,
            status: 'FAILED',
          })

          await this.checkJobFinalization(jobId, userId)
          return
        }

        // Re-dispatch delayed poll job and exit immediately without blocking
        await MeeshoLabelPollJob.dispatch({
          jobId,
          jobAccountId,
          accountId,
          userId,
          attempt: attempt + 1,
        }).in('10s')
        return
      }

      // Update progress in SQL
      jobAccount.totalSuborders = match.total_suborder_count || jobAccount.totalSuborders
      jobAccount.successfulSuborders =
        match.success_suborder_count || jobAccount.successfulSuborders
      jobAccount.progressPercent = match.progress_percent ?? jobAccount.progressPercent
      await jobAccount.save()

      logger.info(
        {
          jobId,
          jobAccountId,
          progress: jobAccount.progressPercent,
          status: match.status,
          attempt,
        },
        'Meesho label poll progress updated'
      )

      await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'progress_updated', {
        accountId,
        progress: jobAccount.progressPercent,
        totalLabels: jobAccount.totalSuborders,
        processedLabels: jobAccount.successfulSuborders,
        status: 'POLLING',
      })

      // Check for completion
      if ((jobAccount.progressPercent >= 100 || match.status === 'PROCESSED') && match.label_url) {
        jobAccount.status = 'READY_FOR_DOWNLOAD'
        await jobAccount.save()

        logger.info(
          { jobId, jobAccountId, requestId: jobAccount.meeshoRequestId },
          'Meesho label ready for download, dispatching download job'
        )

        await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'progress_updated', {
          accountId,
          progress: 100,
          totalLabels: jobAccount.totalSuborders,
          processedLabels: jobAccount.successfulSuborders,
          status: 'READY_FOR_DOWNLOAD',
        })

        await MeeshoLabelDownloadJob.dispatch({
          jobId,
          jobAccountId,
          accountId,
          userId,
          labelUrl: match.label_url,
        })
        return
      }

      // Check for explicit failure from Meesho
      if (match.status === 'FAILED' || match.status === 'ERROR') {
        try {
          logger.info(
            { jobId, jobAccountId, requestId: jobAccount.meeshoRequestId },
            'Calling Meesho updateLabelDownloadStatus for failed request'
          )
          await MeeshoLabelApiService.updateLabelDownloadStatus(
            String(accountId),
            jobAccount.meeshoRequestId,
            'POPUP_CLOSED'
          )
        } catch (statusErr: any) {
          logger.warn(
            {
              jobId,
              jobAccountId,
              requestId: jobAccount.meeshoRequestId,
              error: statusErr.message,
            },
            'Failed to update Meesho label download status on failure'
          )
        }

        jobAccount.status = 'FAILED'
        jobAccount.errorCode = LABEL_ERROR_CODES.MEESHO_LABEL_PROCESSING_FAILED
        jobAccount.errorMessage =
          match.error_message ||
          match.status_message ||
          'Meesho reported failure during label generation'
        jobAccount.completedAt = DateTime.now()
        await jobAccount.save()

        await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'account_failed', {
          accountId,
          errorCode: jobAccount.errorCode,
          errorMessage: jobAccount.errorMessage,
          status: 'FAILED',
        })

        await this.checkJobFinalization(jobId, userId)
        return
      }

      // Check max attempts
      if (attempt >= MAX_POLL_ATTEMPTS) {
        jobAccount.status = 'FAILED'
        jobAccount.errorCode = LABEL_ERROR_CODES.MEESHO_API_TIMEOUT
        jobAccount.errorMessage = `Polling timed out after ${attempt} attempts (${jobAccount.progressPercent}% complete)`
        jobAccount.completedAt = DateTime.now()
        await jobAccount.save()

        await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'account_failed', {
          accountId,
          errorCode: jobAccount.errorCode,
          errorMessage: jobAccount.errorMessage,
          status: 'FAILED',
        })

        await this.checkJobFinalization(jobId, userId)
        return
      }

      // Determine next delay — respect Meesho's hint but enforce a tighter floor (5s)
      const delayMs =
        history.polling_time_ms && history.polling_time_ms >= 5000 ? history.polling_time_ms : 5000

      // Enqueue next delayed job; worker exits immediately
      await MeeshoLabelPollJob.dispatch({
        jobId,
        jobAccountId,
        accountId,
        userId,
        attempt: attempt + 1,
      }).in(delayMs)
    } catch (err: any) {
      logger.error(
        { jobId, jobAccountId, error: err.message, attempt },
        'MeeshoLabelPollJob: error during history polling'
      )

      if (attempt >= MAX_POLL_ATTEMPTS) {
        jobAccount.status = 'FAILED'
        jobAccount.errorCode = LABEL_ERROR_CODES.MEESHO_API_TIMEOUT
        jobAccount.errorMessage = err.message || 'Error occurred while polling Meesho history'
        jobAccount.completedAt = DateTime.now()
        await jobAccount.save()

        await this.checkJobFinalization(jobId, userId)
        return
      }

      // Retry with backoff delay
      await MeeshoLabelPollJob.dispatch({
        jobId,
        jobAccountId,
        accountId,
        userId,
        attempt: attempt + 1,
      }).in('15s')
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
      'MeeshoLabelPollJob uncaught failure'
    )
  }
}
