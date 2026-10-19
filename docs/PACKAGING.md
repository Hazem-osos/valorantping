# Packaging

- Tool: electron-builder NSIS
- Arch: Windows 10/11 x64
- File: `/Users/hazem/Desktop/valofile/dist/Riyadh-Ping-Optimizer-Setup.exe` (~82 MB NSIS x64)
- Execution level: `asInvoker` (no admin for diagnostics)
- Start Menu shortcut: yes
- Uninstall: Windows Apps list
- User data: `%APPDATA%\Riyadh Ping Optimizer`
- Signing: unsigned. SmartScreen **More info → Run anyway**. No bypass.

Probes after install still spawn `C:\Windows\System32\ping.exe`, `tracert.exe`, and `powercfg.exe` by absolute path, not from the asar.

Building this installer on macOS/Linux does **not** verify the Windows runtime. Test Setup.exe on the VALORANT PC.
