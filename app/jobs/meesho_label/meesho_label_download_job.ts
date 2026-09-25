import { Job } from '@adonisjs/queue'
import logger from '@adonisjs/core/services/logger'
import MeeshoLabelJobAccount from '#models/meesho_label_job_account'
import { MeeshoLabelStorageService } from '#services/meesho_label/meesho_label_storage_service'
import { MeeshoLabelApiService } from '#services/meesho_label/meesho_label_api_service'
import { MeeshoLabelEventBroadcaster } from '#services/meesho_label/meesho_label_event_broadcaster'
import MeeshoLabelProcessJob from '#jobs/meesho_label/meesho_label_process_job'
import MeeshoLabelFinalizeJob from '#jobs/meesho_label/meesho_label_finalize_job'
import { LABEL_ERROR_CODES } from '#services/external_api/constants'
import { DateTime } from 'luxon'

export interface MeeshoLabelDownloadJobPayload {
  jobId: string
  jobAccountId: number
  accountId: number
  userId: number
  labelUrl: string
}

export default class MeeshoLabelDownloadJob extends Job<MeeshoLabelDownloadJobPayload> {
  async execute(): Promise<void> {
    const { jobId, jobAccountId, accountId, userId, labelUrl } = this.payload

    const jobAccount = await MeeshoLabelJobAccount.find(jobAccountId)
    if (!jobAccount) {
      logger.error({ jobAccountId, jobId }, 'MeeshoLabelDownloadJob: jobAccount record not found')
      return
    }

    // Idempotency: if already DOWNLOADED or PROCESSING or PROCESSED, dispatch process or exit
    if (['DOWNLOADED', 'PROCESSING', 'PROCESSED'].includes(jobAccount.status)) {
      logger.info(
        { jobAccountId, status: jobAccount.status },
        'MeeshoLabelDownloadJob: already downloaded, proceeding to process'
      )
      if (jobAccount.status === 'DOWNLOADED') {
        await MeeshoLabelProcessJob.dispatch({ jobId, jobAccountId, accountId, userId })
      }
      return
    }

    jobAccount.status = 'DOWNLOADING'
    await jobAccount.save()

    await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'download_started', {
      accountId,
      status: 'DOWNLOADING',
    })

    const rawPdfKey = MeeshoLabelStorageService.getRawPdfKey(
      userId,
      jobId,
      accountId,
      jobAccount.meeshoRequestId || `req-${jobAccountId}`
    )

    try {
      // Check if file already exists in S3 (e.g. from prior interrupted attempt)
      const alreadyExists = await MeeshoLabelStorageService.exists(rawPdfKey)
      if (!alreadyExists) {
        logger.info(
          { jobId, jobAccountId, rawPdfKey },
          'Streaming label PDF from Meesho GCS to S3 storage'
        )
        await MeeshoLabelStorageService.downloadAndStoreRawPdf(labelUrl, rawPdfKey)
      } else {
        logger.info({ jobId, jobAccountId, rawPdfKey }, 'Raw PDF already exists in S3, reusing')
      }

      jobAccount.rawPdfS3Key = rawPdfKey
      jobAccount.status = 'DOWNLOADED'
      await jobAccount.save()

      // Notify Meesho backend flags after successful download
      if (jobAccount.meeshoRequestId) {
        try {
          logger.info(
            { jobId, jobAccountId, requestId: jobAccount.meeshoRequestId },
            'Updating Meesho group download backend flag'
          )
          await MeeshoLabelApiService.updateGroupDownloadBackendFlag(
            String(accountId),
            jobAccount.meeshoRequestId
          )
        } catch (flagErr: any) {
          logger.warn(
            { jobId, jobAccountId, error: flagErr.message },
            'Failed to update Meesho group download backend flag (continuing label processing)'
          )
        }

        try {
          logger.info(
            { jobId, jobAccountId, requestId: jobAccount.meeshoRequestId },
            'Updating Meesho label download status to POPUP_CLOSED'
          )
          await MeeshoLabelApiService.updateLabelDownloadStatus(
            String(accountId),
            jobAccount.meeshoRequestId,
            'POPUP_CLOSED'
          )
        } catch (statusErr: any) {
          logger.warn(
            { jobId, jobAccountId, error: statusErr.message },
            'Failed to update Meesho label download status (continuing label processing)'
          )
        }
      }

      // Proceed immediately to processing job
      await MeeshoLabelProcessJob.dispatch({
        jobId,
        jobAccountId,
        accountId,
        userId,
      })
    } catch (err: any) {
      logger.error(
        { jobId, jobAccountId, error: err.message },
        'MeeshoLabelDownloadJob: failed to download label PDF'
      )

      jobAccount.status = 'FAILED'
      jobAccount.errorCode = LABEL_ERROR_CODES.PDF_DOWNLOAD_FAILED
      jobAccount.errorMessage = err.message || 'Failed to download PDF from storage URL'
      jobAccount.completedAt = DateTime.now()
      await jobAccount.save()

      await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'account_failed', {
        accountId,
        errorCode: jobAccount.errorCode || undefined,
        errorMessage: jobAccount.errorMessage || undefined,
        status: 'FAILED',
      })

      // Check if all accounts for this job are completed or failed
      const accounts = await MeeshoLabelJobAccount.query().where('job_id', jobId)
      const allTerminal = accounts.every((acc) => ['PROCESSED', 'FAILED'].includes(acc.status))
      if (allTerminal) {
        await MeeshoLabelFinalizeJob.dispatch({ jobId, userId })
      }
    }
  }

  async failed(error: Error): Promise<void> {
    logger.error(
      { error: error.message, payload: this.payload },
      'MeeshoLabelDownloadJob uncaught failure'
    )
  }
}
