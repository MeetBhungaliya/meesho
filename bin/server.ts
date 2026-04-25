/*
|--------------------------------------------------------------------------
| HTTP server entrypoint
|--------------------------------------------------------------------------
|
| The "server.ts" file is the entrypoint for starting the AdonisJS HTTP
| server. Either you can run this file directly or use the "serve"
| command to run this file and monitor file changes
|
*/

await import('reflect-metadata')
import { readFileSync } from 'fs'
import { join } from 'path'
const { Ignitor, prettyPrintError } = await import('@adonisjs/core')
import { createServer } from 'node:https'

const privateKey = readFileSync(join(import.meta.dirname, '../private.key'), 'utf8')
const certificate = readFileSync(join(import.meta.dirname, '../cert.pem'), 'utf8')

/**
 * URL to the application root. AdonisJS need it to resolve
 * paths to file and directories for scaffolding commands
 */
const APP_ROOT = new URL('../', import.meta.url)

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')
    })
    app.listen('SIGTERM', () => app.terminate())
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
  })
  .httpServer()
  .start((handle) => {
    return createServer(
      {
        key: privateKey,
        cert: certificate,
      },
      handle
    )
  })
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })
