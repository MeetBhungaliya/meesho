import type { HttpContext } from '@adonisjs/core/http'
import { JobStateManager } from '#services/job_state_manager'

export default class JobsController {
  /**
   * GET /jobs/active?type=flexi-growth-offer|ad-launch
   * Returns all currently active (in-progress) jobs.
   */
  async active({ request, response }: HttpContext) {
    const typePrefix = request.qs().type as string | undefined
    const jobs = await JobStateManager.getActiveJobs(typePrefix)
    return response.ok({ data: jobs })
  }

  /**
   * GET /jobs/:channelName/state
   * Returns the full persisted state of a specific job.
   * channelName is URL-encoded, e.g. flexi-growth-offer:abc-123
   */
  async state({ params, response }: HttpContext) {
    const channelName = decodeURIComponent(params.channelName)
    const state = await JobStateManager.getJobState(channelName)

    if (!state) {
      return response.notFound({ message: 'Job not found or expired' })
    }

    return response.ok({ data: state })
  }
}
