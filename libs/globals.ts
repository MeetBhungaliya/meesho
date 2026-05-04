import env from '#start/env'
import drive from '@adonisjs/drive/services/main'

export const globals = {
  s3: () => drive.use(env.get('DRIVE_DISK')),

  sanitizeFileName(filename: string): string {
    const ext = filename.split('.').pop() || ''
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')

    const cleanName = nameWithoutExt
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/-+/g, '-')

    return `${cleanName}.${ext}`
  },
  getShippingImagePath(userId: number, filename: string): string {
    return `shipping-price/${userId}/${this.sanitizeFileName(filename)}`
  },
}
