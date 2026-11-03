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
; In-game updates (electron-updater runs: Setup.exe --updated --force-run) skip Welcome, Directory and Finish: the player sees
; only the progress page, which closes by itself, and then the game starts again (.onInstSuccess). A fresh install shows every page.
Var Updated
Var ForceRun
!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipOnUpdate
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipOnUpdate
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipOnUpdate
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
ShowInstDetails show
CRCCheck on   ; quick (well under a second for 87 MB) and shows its own progress box; keeps corrupted downloads from installing

Function SkipOnUpdate
  StrCmp $Updated 1 0 +2
    Abort                          ; Abort in a page's pre function skips that page
FunctionEnd

; Update log, shared with the game (main.js writes the same file): %APPDATA%\Dungeon Delve\update.log. Updates only.
!define UPDATE_LOG "$APPDATA\${APP}\update.log"
!macro Log MSG
  Push `${MSG}`
  Call WriteLog
!macroend
Function WriteLog
  Exch $0
  StrCmp $Updated 1 0 wl_done
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5
  Push $6
  Push $7
  ${GetTime} "" "L" $1 $2 $3 $4 $5 $6 $7
  CreateDirectory "$APPDATA\${APP}"
  ClearErrors
  FileOpen $4 "${UPDATE_LOG}" a
  IfErrors wl_pop
  FileSeek $4 0 END
  FileWrite $4 "$3-$2-$1 $5:$6:$7 [installer ${VERSION}] $0$\r$\n"
  FileClose $4
  wl_pop:
  Pop $7
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  wl_done:
  Pop $0
FunctionEnd

Function .onInit
  ; electron-updater runs:  Setup.exe --updated [/S] [--force-run]   (same per-user folder, from the registry key above)
  ;   "Restart to update" in the game: --updated --force-run (progress window, then the game starts again)
  ;   "installs when you quit":        --updated /S          (silent, the game stays closed)
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
  StrCmp $Updated 1 0 +2
    SetAutoClose true              ; update: the progress page closes by itself when the copy is done
  !insertmacro Log "start: $R0"
FunctionEnd

Function LaunchGame
  ; non-blocking: explorer.exe starts the game and returns immediately, so the Finish button closes the installer right away
  Exec '"$WINDIR\explorer.exe" "$INSTDIR\${APP}.exe"'
FunctionEnd

Function .onInstSuccess
  ; restart the game only when it asked for it (--force-run). Started through explorer.exe, exactly like "Play now" and a
  ; desktop shortcut: a direct Exec from the installer blocks while Windows Defender scans the new exe (see LaunchGame).
  ; A quit-time update (--updated /S, no --force-run) leaves the game closed: the player had just quit it.
  StrCmp $Updated 1 0 done
  StrCmp $ForceRun 1 0 nolaunch
    !insertmacro Log "done, starting $INSTDIR\${APP}.exe through explorer"
    Call LaunchGame
    Goto done
  nolaunch:
    !insertmacro Log "done, no --force-run: game left closed"
  done:
FunctionEnd

Function .onInstFailed
  !insertmacro Log "install FAILED"
FunctionEnd

Section "Install"
  ; Everything in a Section runs on NSIS's worker thread, so the window keeps repainting; the progress bar ticks per file.
  SetDetailsPrint both
  DetailPrint "Closing the game if it is running..."
  ; Update: the game just quit itself. Wait (up to 5 s) until no copy of it is left before force-closing anything.
  ; No /T on taskkill: this installer is a child process of the game that started it, so a tree kill could close the installer itself.
  StrCmp $Updated 1 0 kill
    StrCpy $2 0
    wait_exit:
      nsExec::Exec `cmd /c tasklist /NH /FI "IMAGENAME eq ${APP}.exe" | find /I "${APP}.exe"`
      Pop $0
      StrCmp $0 0 0 kill             ; find exits 1: the game is gone
      IntOp $2 $2 + 1
      IntCmp $2 20 kill
      Sleep 250
      Goto wait_exit
  kill:
  nsExec::Exec 'taskkill /IM "${APP}.exe" /F'   ; hidden console, returns in well under a second (exit 128 = nothing to close)
  Pop $0
  !insertmacro Log "old game: waited $2 x 250 ms, taskkill exit $0"
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
