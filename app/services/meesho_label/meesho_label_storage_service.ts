import env from '#start/env'
import drive from '@adonisjs/drive/services/main'
import { MeeshoPdfProcessor } from '#services/meesho_label/pdf/meesho_pdf_processor'

export class MeeshoLabelStorageService {
  private static get disk() {
    return drive.use(env.get('DRIVE_DISK'))
  }

  /**
   * S3 key structure:
   * meesho-labels/{userId}/{jobId}/raw/{accountId}/{requestId}.pdf
   */
  static getRawPdfKey(
    userId: number,
    jobId: string,
    accountId: number | string,
    requestId: string
  ): string {
    const sanitizedReqId = requestId.replace(/[^a-zA-Z0-9_-]/g, '_')
    return `meesho-labels/${userId}/${jobId}/raw/${accountId}/${sanitizedReqId}.pdf`
  }

  /**
   * S3 key structure:
   * meesho-labels/{userId}/{jobId}/processed/{accountId}/{documentId}.pdf
   */
  static getProcessedPdfKey(
    userId: number,
    jobId: string,
    accountId: number | string,
    documentId: number | string
  ): string {
    return `meesho-labels/${userId}/${jobId}/processed/${accountId}/${documentId}.pdf`
  }

  /**
   * S3 key structure:
   * meesho-labels/{userId}/{jobId}/final/meesho-labels-{jobId}.pdf
   */
  static getFinalPdfKey(userId: number, jobId: string): string {
    return `meesho-labels/${userId}/${jobId}/final/meesho-labels-${jobId}.pdf`
  }

  /**
   * Downloads a signed GCS label URL via HTTP stream/buffer and writes directly to S3.
   * Validates HTTP response status and %PDF magic bytes.
   * Never logs the signed URL to prevent credential leakage.
   */
  static async downloadAndStoreRawPdf(
    signedGcsUrl: string,
    destinationS3Key: string,
    timeoutMs = 60_000
  ): Promise<{ size: number; buffer: Buffer }> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let res: Response
    try {
      res = await fetch(signedGcsUrl, {
        method: 'GET',
        signal: controller.signal,
      })
    } catch (err: any) {
      clearTimeout(timer)
      throw new Error(`Failed to initiate download for label PDF: ${err.message}`)
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      throw new Error(`Label PDF download failed with HTTP status ${res.status}`)
    }

    const arrayBuf = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)

    if (!MeeshoPdfProcessor.validatePdfHeader(buffer)) {
      throw new Error('Downloaded file is not a valid PDF: Missing %PDF header')
    }

    await this.disk.put(destinationS3Key, buffer)

    return {
      size: buffer.length,
      buffer,
    }
  }

  /**
   * Stores a PDF buffer into S3.
   */
  static async putBuffer(key: string, buffer: Buffer): Promise<void> {
    await this.disk.put(key, buffer)
  }

  /**
   * Reads a file buffer from S3.
   */
  static async getBuffer(key: string): Promise<Buffer> {
    const bytes = await this.disk.getBytes(key)
    return Buffer.from(bytes)
  }

  /**
   * Checks if an S3 key exists.
   */
  static async exists(key: string): Promise<boolean> {
    return this.disk.exists(key)
  }

  /**
   * Generates a short-lived authenticated download URL.
   * Defaults to 5 minutes (300s). Never log this URL.
   */
  static async getSignedDownloadUrl(
    key: string,
    expiresInSeconds = 300,
    filename?: string
  ): Promise<string> {
    const contentDisposition = filename ? `attachment; filename="${filename}"` : 'attachment'

    let url: string
    try {
      url = await this.disk.getSignedUrl(key, {
        expiresIn: expiresInSeconds,
        contentType: 'application/pdf',
        contentDisposition,
      })
    } catch {
      try {
        url = await this.disk.getUrl(key)
      } catch {
        url = `/uploads/${key}`
      }
    }

    if (url.startsWith('/')) {
      const appUrl = env.get('APP_URL', 'http://127.0.0.1:8443')
      return `${appUrl.replace(/\/$/, '')}${url}`
    }

    return url
  }
}
