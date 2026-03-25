; FocusLedger NSIS Custom Installer Script
; Registers the native messaging host for Chrome and Edge during installation

!macro customInstall
  ; ── Register Native Messaging Host for Chrome ──
  ; Create the manifest directory
  CreateDirectory "$APPDATA\FocusLedger\native-messaging"

  ; Write the native messaging host manifest
  FileOpen $0 "$APPDATA\FocusLedger\native-messaging\com.focusledger.bridge.json" w
  FileWrite $0 '{$\r$\n'
  FileWrite $0 '  "name": "com.focusledger.bridge",$\r$\n'
  FileWrite $0 '  "description": "FocusLedger Native Messaging Host",$\r$\n'
  FileWrite $0 '  "path": "$APPDATA\\FocusLedger\\focusledger-host.bat",$\r$\n'
  FileWrite $0 '  "type": "stdio",$\r$\n'
  FileWrite $0 '  "allowed_origins": ["chrome-extension://*/"]$\r$\n'
  FileWrite $0 '}$\r$\n'
  FileClose $0

  ; Write the .bat wrapper that launches the Node.js native host
  FileOpen $0 "$APPDATA\FocusLedger\focusledger-host.bat" w
  FileWrite $0 '@echo off$\r$\n'
  FileWrite $0 '"node" "$INSTDIR\resources\native-host.js" %*$\r$\n'
  FileClose $0

  ; Register with Chrome
  WriteRegStr HKCU "Software\Google\Chrome\NativeMessagingHosts\com.focusledger.bridge" "" "$APPDATA\FocusLedger\native-messaging\com.focusledger.bridge.json"

  ; Register with Edge
  WriteRegStr HKCU "Software\Microsoft\Edge\NativeMessagingHosts\com.focusledger.bridge" "" "$APPDATA\FocusLedger\native-messaging\com.focusledger.bridge.json"

!macroend

!macro customUnInstall
  ; ── Clean up native messaging host registration ──
  DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\com.focusledger.bridge"
  DeleteRegKey HKCU "Software\Microsoft\Edge\NativeMessagingHosts\com.focusledger.bridge"

  ; Remove manifest and bat
  Delete "$APPDATA\FocusLedger\native-messaging\com.focusledger.bridge.json"
  Delete "$APPDATA\FocusLedger\focusledger-host.bat"
  RMDir "$APPDATA\FocusLedger\native-messaging"
!macroend
