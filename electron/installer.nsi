; Dungeon Delve per-user installer (no admin rights needed). Built natively on Linux with makensis.
Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
!define APP "Dungeon Delve"
!ifndef VERSION
  !define VERSION "2.2.0"
!endif
!ifndef SRC
  !define SRC "..\release\win-unpacked"
!endif
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\DungeonDelve"
Name "${APP}"
OutFile "..\release\DungeonDelve-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\${APP}"
InstallDirRegKey HKCU "Software\DungeonDelve" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
BrandingText "${APP} ${VERSION}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APP}"
VIAddVersionKey "FileDescription" "${APP} Setup"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "Anna"
VIAddVersionKey "LegalCopyright" "Made by Anna"
!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${APP}"
!define MUI_WELCOMEPAGE_TEXT "This will install ${APP}, a Dungeons & Dragons deck-builder, on your computer.$\r$\n$\r$\nNo internet connection or administrator rights are needed.$\r$\n$\r$\nClick Next to continue."
; "Play now" (checked by default) must NOT start the game from the installer's UI thread: CreateProcess on the freshly
; written, unsigned 170 MB exe blocks while Windows Defender scans it, and the installer window showed "Not responding".
; LaunchGame hands the launch to explorer.exe, which returns at once and starts the game itself.
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchGame
!define MUI_FINISHPAGE_NOREBOOTSUPPORT
!define MUI_FINISHPAGE_RUN_TEXT "Play ${APP} now"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
ShowInstDetails show
CRCCheck on   ; quick (well under a second for 87 MB) and shows its own progress box; keeps corrupted downloads from installing

Var Updated
Var ForceRun
Function .onInit
  ; electron-updater runs:  Setup.exe --updated /S [--force-run]   (same per-user folder, from the registry key above)
  ${GetParameters} $R0
  StrCpy $Updated 0
  StrCpy $ForceRun 0
  ClearErrors
  ${GetOptions} $R0 "--updated" $R1
  IfErrors +2
    StrCpy $Updated 1
  ClearErrors
  ${GetOptions} $R0 "--force-run" $R1
  IfErrors +2
    StrCpy $ForceRun 1
FunctionEnd

Function LaunchGame
  ; non-blocking: explorer.exe starts the game and returns immediately, so the Finish button closes the installer right away
  Exec '"$WINDIR\explorer.exe" "$INSTDIR\${APP}.exe"'
FunctionEnd

Function .onInstSuccess
  ; after a silent update (electron-updater: --updated /S [--force-run]) start the game again; no window, nothing to freeze
  IfSilent 0 done
    StrCmp $ForceRun 1 run
    StrCmp $Updated 1 run done
  run:
    Exec '"$INSTDIR\${APP}.exe"'
  done:
FunctionEnd

Section "Install"
  ; Everything in a Section runs on NSIS's worker thread, so the window keeps repainting; the progress bar ticks per file.
  SetDetailsPrint both
  DetailPrint "Closing the game if it is running..."
  StrCmp $Updated 1 0 +2
    Sleep 1200                     ; the updater just asked the game to quit: give it a moment to save and exit
  nsExec::Exec 'taskkill /IM "${APP}.exe" /T /F'   ; hidden console, returns in well under a second (exit 128 = nothing to close)
  Pop $0
  StrCmp $0 0 0 +2
    Sleep 500                      ; a copy was closed: let Windows release its files
  DetailPrint "Copying game files (Windows may scan them, this can take a minute)..."
  SetDetailsPrint listonly
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
  SetDetailsPrint both
  DetailPrint "Creating the uninstaller and shortcuts..."
  WriteUninstaller "$INSTDIR\Uninstall ${APP}.exe"
  StrCmp $Updated 1 shortcuts_done
    CreateShortCut "$DESKTOP\${APP}.lnk" "$INSTDIR\${APP}.exe"
    CreateDirectory "$SMPROGRAMS\${APP}"
    CreateShortCut "$SMPROGRAMS\${APP}\${APP}.lnk" "$INSTDIR\${APP}.exe"
    CreateShortCut "$SMPROGRAMS\${APP}\Uninstall ${APP}.lnk" "$INSTDIR\Uninstall ${APP}.exe"
  shortcuts_done:
  WriteRegStr HKCU "Software\DungeonDelve" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "Anna"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\${APP}.exe"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Uninstall ${APP}.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
  DetailPrint "Done."
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM "${APP}.exe" /F'
  Delete "$DESKTOP\${APP}.lnk"
  RMDir /r "$SMPROGRAMS\${APP}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNKEY}"
  DeleteRegKey HKCU "Software\DungeonDelve"
  ; saves and settings live in %APPDATA%\Dungeon Delve and are kept on purpose
SectionEnd
