import { APP_ID, APP_NAME, INSTALLER_FILE_NAME } from './constants'

export const PACKAGING = {
  appId: APP_ID,
  productName: APP_NAME,
  installerFileName: INSTALLER_FILE_NAME,
  requestedExecutionLevel: 'asInvoker',
  createStartMenuShortcut: true,
  perMachine: false,
  asar: true,
  winArch: 'x64',
  target: 'nsis',
  smartScreen: 'unsigned-installer-shows-smartscreen-more-info-run-anyway'
} as const
