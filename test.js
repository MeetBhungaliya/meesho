import { chromium } from 'playwright'
import fs from 'fs'

const profile = '/Users/meet/Library/Application Support/Google/Chrome/Profile 1'

const context = await chromium.launchPersistentContext(
  '/Users/meet/Library/Application Support/Google/Chrome',
  {
    channel: 'chrome',
    headless: false,
    args: ['--profile-directory=Profile 1'],
  }
)

await page.goto('https://bot.sannysoft.com')
