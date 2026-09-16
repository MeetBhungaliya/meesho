import { Job } from '@adonisjs/queue'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import MeeshoLabelJobAccount from '#models/meesho_label_job_account'
import MeeshoLabelDocument from '#models/meesho_label_document'
import MeeshoLabelJob from '#models/meesho_label_job'
import { MeeshoLabelStorageService } from '#services/meesho_label/meesho_label_storage_service'
import { MeeshoPdfProcessor } from '#services/meesho_label/pdf/meesho_pdf_processor'
import { MeeshoLabelEventBroadcaster } from '#services/meesho_label/meesho_label_event_broadcaster'
import MeeshoLabelFinalizeJob from '#jobs/meesho_label/meesho_label_finalize_job'
import { LABEL_ERROR_CODES } from '#services/external_api/constants'

export interface MeeshoLabelProcessJobPayload {
  jobId: string
  jobAccountId: number
  accountId: number
  userId: number
}

export default class MeeshoLabelProcessJob extends Job<MeeshoLabelProcessJobPayload> {
  async execute(): Promise<void> {
    const { jobId, jobAccountId, accountId, userId } = this.payload

    const jobAccount = await MeeshoLabelJobAccount.find(jobAccountId)
    if (!jobAccount) {
      logger.error({ jobAccountId, jobId }, 'MeeshoLabelProcessJob: jobAccount not found')
      return
    }

    if (jobAccount.status === 'PROCESSED') {
      logger.info({ jobAccountId }, 'MeeshoLabelProcessJob: account already processed, skipping')
      return
    }

    jobAccount.status = 'PROCESSING'
    await jobAccount.save()

    await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'processing_started', {
      accountId,
      status: 'PROCESSING',
    })

    if (!jobAccount.rawPdfS3Key) {
      jobAccount.status = 'FAILED'
      jobAccount.errorCode = LABEL_ERROR_CODES.PDF_DOWNLOAD_FAILED
      jobAccount.errorMessage = 'Raw PDF S3 key missing'
      jobAccount.completedAt = DateTime.now()
      await jobAccount.save()
      await this.checkJobFinalization(jobId, userId)
      return
    }

    try {
      logger.info({ jobId, jobAccountId, key: jobAccount.rawPdfS3Key }, 'Reading raw PDF from S3')
      const rawBuffer = await MeeshoLabelStorageService.getBuffer(jobAccount.rawPdfS3Key)

      const processed = await MeeshoPdfProcessor.processRawPdf(rawBuffer)
      logger.info(
        { jobId, jobAccountId, pageCount: processed.pageCount },
        'Raw PDF extracted and parsed'
      )

      // Clean up any previously created documents for this job account if retrying
      await MeeshoLabelDocument.query().where('job_account_id', jobAccountId).delete()

      // Save each page document in database
      const docsToInsert = processed.pages.map((p) => ({
        jobId,
        jobAccountId,
        accountId,
        sku: p.metadata.sku || null,
        orderId: p.metadata.orderId || null,
        subOrderId: p.metadata.subOrderId || null,
        awb: p.metadata.awb || null,
        quantity: p.metadata.quantity || 1,
        size: p.metadata.size || null,
        color: p.metadata.color || null,
        sourcePageNumber: p.pageNumber,
        status: (p.error ? 'FAILED' : 'PROCESSED') as 'PROCESSED' | 'FAILED',
        errorCode: p.error ? LABEL_ERROR_CODES.SKU_NOT_FOUND : null,
        errorMessage: p.error || null,
        rawPdfS3Key: jobAccount.rawPdfS3Key,
      }))

      await MeeshoLabelDocument.createMany(docsToInsert)

      jobAccount.status = 'PROCESSED'
      jobAccount.completedAt = DateTime.now()
      await jobAccount.save()

      // Update parent job counters in SQL
      await this.syncJobCounters(jobId)

      await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'account_completed', {
        accountId,
        supplierName: jobAccount.supplierName || undefined,
        totalLabels: processed.pageCount,
        processedLabels: docsToInsert.filter((d) => d.status === 'PROCESSED').length,
        failedLabels: docsToInsert.filter((d) => d.status === 'FAILED').length,
        status: 'PROCESSED',
      })

      // Check if all accounts have reached a terminal state
      await this.checkJobFinalization(jobId, userId)
    } catch (err: any) {
      logger.error(
        { jobId, jobAccountId, error: err.message },
        'MeeshoLabelProcessJob: processing failed'
      )

      jobAccount.status = 'FAILED'
      jobAccount.errorCode = LABEL_ERROR_CODES.PDF_TEMPLATE_NOT_RECOGNIZED
      jobAccount.errorMessage = err.message || 'Failed to parse and process PDF'
      jobAccount.completedAt = DateTime.now()
      await jobAccount.save()

      await this.syncJobCounters(jobId)

      await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'account_failed', {
        accountId,
        errorCode: jobAccount.errorCode || undefined,
        errorMessage: jobAccount.errorMessage || undefined,
        status: 'FAILED',
      })

      await this.checkJobFinalization(jobId, userId)
    }
  }

  private async syncJobCounters(jobId: string): Promise<void> {
    const parentJob = await MeeshoLabelJob.find(jobId)
    if (!parentJob) return

    const accounts = await MeeshoLabelJobAccount.query().where('job_id', jobId)
    const completedAccounts = accounts.filter((a) => a.status === 'PROCESSED').length
    const failedAccounts = accounts.filter((a) => a.status === 'FAILED').length

    const docs = await MeeshoLabelDocument.query().where('job_id', jobId)
    const totalLabels = docs.length
    const processedLabels = docs.filter((d) => d.status === 'PROCESSED').length
    const failedLabels = docs.filter((d) => d.status === 'FAILED').length

    parentJob.completedAccounts = completedAccounts
    parentJob.failedAccounts = failedAccounts
    parentJob.totalLabels = totalLabels
    parentJob.processedLabels = processedLabels
    parentJob.failedLabels = failedLabels
    await parentJob.save()
  }

  private async checkJobFinalization(jobId: string, userId: number): Promise<void> {
    const parentJob = await MeeshoLabelJob.find(jobId)
    if (!parentJob) return

    const accounts = await MeeshoLabelJobAccount.query().where('job_id', jobId)
    const allTerminal = accounts.every((acc) => ['PROCESSED', 'FAILED'].includes(acc.status))

    if (allTerminal) {
      logger.info({ jobId }, 'All accounts have reached terminal state, dispatching finalization')
      await MeeshoLabelFinalizeJob.dispatch({ jobId, userId })
    }
  }

  async failed(error: Error): Promise<void> {
    logger.error(
      { error: error.message, payload: this.payload },
      'MeeshoLabelProcessJob uncaught failure'
    )
  }
}
