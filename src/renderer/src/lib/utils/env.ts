export const isMac = navigator.userAgent.includes('Mac')

/** Alt on macOS, CommandOrControl (i.e. Ctrl) on Windows */
export const platformAlt = isMac ? 'Alt' : 'CommandOrControl'
