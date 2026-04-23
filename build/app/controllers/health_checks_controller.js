import { healthChecks } from '#start/health';
export default class HealthChecksController {
    async health({ response }) {
        const report = await healthChecks.run();
        if (report.isHealthy) {
            return response.ok(report);
        }
        return response.serviceUnavailable(report);
    }
}
//# sourceMappingURL=health_checks_controller.js.map