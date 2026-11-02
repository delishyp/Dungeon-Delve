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
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP}.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Play ${APP} now"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

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

Function .onInstSuccess
  ; after a silent update, start the game again
  IfSilent 0 done
    StrCmp $ForceRun 1 run
    StrCmp $Updated 1 run done
  run:
    Exec '"$INSTDIR\${APP}.exe"'
  done:
FunctionEnd

Section "Install"
  ; let the old game finish quitting (the updater quits it), then make sure no copy is still running
  Sleep 1200
  nsExec::Exec 'taskkill /IM "${APP}.exe" /F'
  Sleep 400
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
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
