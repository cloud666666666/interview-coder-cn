import { app, ipcMain, net } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { AvailableUpdate } from '../shared/update'

/**
 * A new release is announced inside the main window only. A native dialog or
 * a system notification is drawn outside content protection, so one popping
 * up mid-interview would show on the shared screen.
 *
 * Windows downloads and installs it through electron-updater once the user
 * asks. The macOS build has no Apple signature, only a self-signed one, and
 * updating it through Squirrel.Mac has never been tried, so there the check
 * only reads the Latest release and points to its page. Both follow Latest
 * alone: a pre-release is never offered.
 */

const REPO = 'cloud666666666/interview-coder-cn'
// The app is often left running for days, on macOS especially
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let update: AvailableUpdate | null = null

function releaseUrl(version: string): string {
  return `https://github.com/${REPO}/releases/tag/v${version}`
}

function setUpdate(next: AvailableUpdate): void {
  update = next
  const mainWindow = global.mainWindow
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', update)
  }
}

/** Positive when `a` is the later of two dotted versions */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff) return diff
  }
  return 0
}

/**
 * electron-updater downloads it from the Latest release on every Windows
 * check, and the macOS check does too, so its download count on the release
 * page counts the checks of both. macOS never reads it (it describes the
 * Windows installer), only where its link redirects.
 */
const LATEST_ASSET_URL = `https://github.com/${REPO}/releases/latest/download/latest.yml`
const ASSET_URL = /\/releases\/download\/([^/?#]+)\/[^/?#]+$/
const TAG_URL = /\/releases\/tag\/([^/?#]+)$/

/**
 * The Latest release's page (`…/releases/tag/v3.2.2`), from where
 * `releases/latest/download/<asset>` redirects (`…/releases/download/v3.2.2/<asset>`),
 * which skips drafts and pre-releases. GitHub redirects there whether the
 * release has the asset or not. Not the REST API: without a token it allows
 * 60 requests an hour per IP, and a proxy exit shared by many users runs out
 * of them. Electron's `net` goes through the system proxy, which GitHub often
 * needs from China. A renamed repository first redirects to its new
 * `releases/latest/download/<asset>`.
 *
 * The redirects are then followed to the file itself, so the check counts as
 * a download; whether that part fails does not change the result.
 */
function getLatestReleaseUrl(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    // net.fetch would follow the redirects without telling where they led
    const request = net.request({ url: LATEST_ASSET_URL, redirect: 'manual' })
    const timer = setTimeout(() => request.abort(), 15_000)
    let hops = 0
    request.on('redirect', (_status, _method, redirectUrl) => {
      if (ASSET_URL.test(redirectUrl)) {
        resolve(redirectUrl.replace(ASSET_URL, '/releases/tag/$1'))
      }
      if (++hops < 5) {
        request.followRedirect()
      } else {
        resolve(null)
        request.abort()
      }
    })
    // The file, a 404 page if the release lacks it, or with no redirect at all
    // an error page (nothing released). Read to the end, then the check is done.
    request.on('response', (response) => {
      resolve(null)
      response.on('data', () => {})
      response.on('end', () => clearTimeout(timer))
      response.on('error', () => clearTimeout(timer))
    })
    request.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    request.on('abort', () => {
      clearTimeout(timer)
      reject(new Error('Timed out'))
    })
    request.end()
  })
}

/** A failure stays silent: the next check tries again */
async function checkLatestRelease(): Promise<void> {
  try {
    const url = await getLatestReleaseUrl()
    const tag = url && TAG_URL.exec(url)?.[1]
    if (!url || !tag) return
    const version = decodeURIComponent(tag).replace(/^v/, '')
    if (compareVersions(version, app.getVersion()) <= 0) return
    setUpdate({ version, url, installable: false, phase: 'available' })
  } catch (err) {
    console.error('Update check failed:', err)
  }
}

function initInstaller(): void {
  autoUpdater.autoDownload = false

  autoUpdater.on('update-available', (info) => {
    setUpdate({
      version: info.version,
      url: releaseUrl(info.version),
      installable: true,
      phase: 'available'
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.floor(progress.percent)
    if (update?.phase === 'downloading' && update.percent !== percent) {
      setUpdate({ ...update, percent })
    }
  })

  autoUpdater.on('update-downloaded', () => {
    if (update) setUpdate({ ...update, phase: 'downloaded' })
  })

  // Failed checks land here too (offline, GitHub unreachable); they stay silent
  autoUpdater.on('error', (error) => {
    console.error('Auto update error:', error)
  })
}

function checkForUpdate(): void {
  // A download under way or done is not started over
  if (update?.phase === 'downloading' || update?.phase === 'downloaded') return
  if (process.platform === 'darwin') {
    void checkLatestRelease()
  } else {
    autoUpdater.checkForUpdates().catch((err) => console.error('Update check failed:', err))
  }
}

export function initAutoUpdater(): void {
  if (process.platform !== 'darwin') {
    try {
      initInstaller()
    } catch (e) {
      console.error('Failed to initialize auto-updater:', e)
      return
    }
  }
  checkForUpdate()
  setInterval(checkForUpdate, CHECK_INTERVAL_MS)
}

ipcMain.handle('update:get-status', () => update)

ipcMain.handle('update:download', () => {
  if (!update?.installable || (update.phase !== 'available' && update.phase !== 'failed')) return
  setUpdate({ ...update, phase: 'downloading', percent: 0, error: undefined })
  autoUpdater.downloadUpdate().catch((err) => {
    console.error('Update download failed:', err)
    if (update) {
      setUpdate({
        ...update,
        phase: 'failed',
        error: err instanceof Error ? err.message : String(err)
      })
    }
  })
})

ipcMain.handle('update:install', () => {
  if (update?.phase !== 'downloaded') return
  // Not silent, so the installer shows its progress; the app reopens after it
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
})
