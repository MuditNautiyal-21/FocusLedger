import { Menu, app, shell, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import { getLogFilePath } from './logger';

export function createAppMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // ── File ──
    {
      label: 'File',
      submenu: [
        {
          label: 'Export Report',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu:export-report');
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    // ── Edit ──
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    // ── View ──
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(!app.isPackaged ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' as const },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    // ── Window ──
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    // ── Help ──
    {
      label: 'Help',
      submenu: [
        {
          label: 'About FocusLedger',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About FocusLedger',
              message: 'FocusLedger',
              detail: `Version ${app.getVersion()}\nAdvanced Time & Effort Logger\n\nTrack your productivity, classify your activities, and generate detailed reports.`,
              buttons: ['OK'],
            });
          },
        },
        {
          label: 'Open Logs Folder',
          click: () => {
            const logPath = getLogFilePath();
            shell.showItemInFolder(logPath);
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
