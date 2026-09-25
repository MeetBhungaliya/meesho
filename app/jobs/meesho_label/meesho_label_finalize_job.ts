import { Job } from '@adonisjs/queue'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import { PDFDocument } from 'pdf-lib'
import MeeshoLabelJob from '#models/meesho_label_job'
import MeeshoLabelDocument from '#models/meesho_label_document'
import { MeeshoLabelStorageService } from '#services/meesho_label/meesho_label_storage_service'
import { MeeshoMerger } from '#services/meesho_label/pdf/meesho_merger'
import type { MergeableLabelItem } from '#services/meesho_label/pdf/meesho_merger'
import { MeeshoLabelEventBroadcaster } from '#services/meesho_label/meesho_label_event_broadcaster'
import { LABEL_ERROR_CODES } from '#services/external_api/constants'

export interface MeeshoLabelFinalizeJobPayload {
  jobId: string
  userId: number
}

export default class MeeshoLabelFinalizeJob extends Job<MeeshoLabelFinalizeJobPayload> {
  async execute(): Promise<void> {
    const { jobId, userId } = this.payload

    const job = await MeeshoLabelJob.find(jobId)
    if (!job) {
      logger.error({ jobId }, 'MeeshoLabelFinalizeJob: job not found')
      return
    }

    // Idempotency check: if already completed, exit
    if (['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(job.status)) {
      logger.info({ jobId, status: job.status }, 'MeeshoLabelFinalizeJob: job already finalized')
      return
    }

    job.status = 'PROCESSING'
    await job.save()

    await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'finalization_started', {
      status: 'PROCESSING',
    })

    try {
      // Query all successful documents for this job
      const documents = await MeeshoLabelDocument.query()
        .where('job_id', jobId)
        .where('status', 'PROCESSED')
        .orderBy('id', 'asc')

      const failedDocsCount = await MeeshoLabelDocument.query()
        .where('job_id', jobId)
        .where('status', 'FAILED')
        .count('* as total')

      const failedCount = Number(failedDocsCount[0]?.$extras?.total || 0)

      if (documents.length === 0) {
        logger.warn({ jobId }, 'MeeshoLabelFinalizeJob: no successfully processed labels found')
        job.status = 'FAILED'
        job.errorCode = LABEL_ERROR_CODES.PDF_MERGE_FAILED
        job.errorMessage = 'No valid labels could be extracted for this job'
        job.completedAt = DateTime.now()
        await job.save()

        await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'job_completed', {
          status: 'FAILED',
          errorCode: job.errorCode || undefined,
          errorMessage: job.errorMessage || undefined,
        })
        return
      }

      logger.info(
        { jobId, totalProcessed: documents.length, failedCount },
        'Starting PDF label merge and sort'
      )

      // Cache raw PDFs loaded from S3 so we only download each account's PDF once
      const pdfDocCache = new Map<string, PDFDocument>()
      const rawBufferCache = new Map<string, Buffer>()

      const mergeableItems: MergeableLabelItem[] = []

      for (const doc of documents) {
        if (!doc.rawPdfS3Key) continue

        let srcDoc = pdfDocCache.get(doc.rawPdfS3Key)
        let rawBuffer = rawBufferCache.get(doc.rawPdfS3Key)
        if (!srcDoc || !rawBuffer) {
          rawBuffer = await MeeshoLabelStorageService.getBuffer(doc.rawPdfS3Key)
          srcDoc = await PDFDocument.load(rawBuffer)
          pdfDocCache.set(doc.rawPdfS3Key, srcDoc)
          rawBufferCache.set(doc.rawPdfS3Key, rawBuffer)
        }

        mergeableItems.push({
          id: doc.id,
          sku: doc.sku || '',
          sourceOrder: doc.id,
          srcDoc,
          sourcePageIndex: doc.sourcePageNumber - 1,
          pdfBuffer: rawBuffer,
        })
      }

      // Merge labels deterministically sorted by SKU ascending + source order
      const { buffer: finalBuffer, pageCount } =
        await MeeshoMerger.mergeSortedLabels(mergeableItems)

      const finalPdfKey = MeeshoLabelStorageService.getFinalPdfKey(userId, jobId)
      logger.info(
        { jobId, finalPdfKey, pageCount, sizeBytes: finalBuffer.length },
        'Uploading final merged PDF to S3'
      )

      await MeeshoLabelStorageService.putBuffer(finalPdfKey, finalBuffer)

      // Determine final status: COMPLETED vs COMPLETED_WITH_ERRORS
      const finalStatus = failedCount > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED'

      job.status = finalStatus
      job.finalPdfS3Key = finalPdfKey
      job.finalPdfSize = finalBuffer.length
      job.totalLabels = documents.length + failedCount
      job.processedLabels = documents.length
      job.failedLabels = failedCount
      job.completedAt = DateTime.now()
      await job.save()

      // Clear document cache from memory
      pdfDocCache.clear()
      rawBufferCache.clear()

      // Generate presigned download URL for event
      let downloadUrl = ''
      try {
        downloadUrl = await MeeshoLabelStorageService.getSignedDownloadUrl(finalPdfKey, 600)
      } catch (_) {}

      logger.info(
        { jobId, finalStatus, totalLabels: job.totalLabels, processed: job.processedLabels },
        'Meesho label job finalized successfully'
      )

      await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'final_pdf_ready', {
        status: finalStatus,
        totalLabels: job.totalLabels,
        processedLabels: job.processedLabels,
        failedLabels: job.failedLabels,
        downloadUrl: downloadUrl || undefined,
      })

      await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'job_completed', {
        status: finalStatus,
        totalLabels: job.totalLabels,
        processedLabels: job.processedLabels,
        failedLabels: job.failedLabels,
        downloadUrl: downloadUrl || undefined,
      })
    } catch (err: any) {
      logger.error({ jobId, error: err.message }, 'MeeshoLabelFinalizeJob failed during merge')

      job.status = 'FAILED'
      job.errorCode = LABEL_ERROR_CODES.PDF_MERGE_FAILED
      job.errorMessage = err.message || 'Error occurred while generating final merged PDF'
      job.completedAt = DateTime.now()
      await job.save()

      await MeeshoLabelEventBroadcaster.broadcast(userId, jobId, 'job_completed', {
        status: 'FAILED',
        errorCode: job.errorCode || undefined,
        errorMessage: job.errorMessage || undefined,
      })
    }
  }

  async failed(error: Error): Promise<void> {
    logger.error(
      { error: error.message, payload: this.payload },
      'MeeshoLabelFinalizeJob uncaught failure'
    )
  }
}
