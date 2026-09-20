; ==========================================================================
; NEXUS — Custom NSIS Installer Script
; Wywoływany przez electron-builder przy budowaniu instalatora
; ==========================================================================

!include "LogicLib.nsh"

; ==========================================================================
; CUSTOM INIT — wywoływane na starcie instalatora
; Sprawdza czy NEXUS działa i zamyka go przed aktualizacją
; ==========================================================================
!macro customInit
  ; Pobierz listę procesów i sprawdź czy NEXUS.exe działa
  nsExec::ExecToStack 'cmd /C tasklist /FI "IMAGENAME eq NEXUS.exe" /NH /FO CSV'
  Pop $0   ; kod wyjścia
  Pop $1   ; output (stdout)

  ; Szukaj "NEXUS.exe" w outpucie
  ${StrContains} $2 "NEXUS.exe" $1
  ${If} $2 != ""
    ; NEXUS działa — zamknij go
    DetailPrint "Zamykanie uruchomionej instancji NEXUS..."
    nsExec::ExecToLog 'taskkill /F /IM NEXUS.exe'
    Sleep 1500
  ${EndIf}
!macroend

; ==========================================================================
; CUSTOM INSTALL — wywoływane po skopiowaniu plików
; Dodatkowe skróty + wpis do rejestru
; ==========================================================================
!macro customInstall
  ; ---- Skrót na pulpicie ----
  ; electron-builder już to robi (createDesktopShortcut: "always"),
  ; ale dla pewności tworzymy tu też — jeśli istnieje, zostanie nadpisany
  CreateShortCut "$DESKTOP\NEXUS.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0

  ; ---- Menu Start ----
  CreateDirectory "$SMPROGRAMS\NEXUS"
  CreateShortCut "$SMPROGRAMS\NEXUS\NEXUS.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  CreateShortCut "$SMPROGRAMS\NEXUS\Odinstaluj NEXUS.lnk" "$INSTDIR\Uninstall ${PRODUCT_NAME}.exe"

  ; ---- Wpis do rejestru (ułatwia późniejsze wykrycie instalacji) ----
  WriteRegStr HKCU "Software\NEXUS" "InstallPath" "$INSTDIR"
  WriteRegStr HKCU "Software\NEXUS" "Version" "${VERSION}"
  WriteRegStr HKCU "Software\NEXUS" "Executable" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
!macroend

; ==========================================================================
; CUSTOM UNINSTALL — wywoływane przy deinstalacji
; Sprząta po sobie: skróty + rejestr
; ==========================================================================
!macro customUnInstall
  ; Skrót z pulpitu
  Delete "$DESKTOP\NEXUS.lnk"

  ; Menu Start — usuń folder razem z zawartością
  Delete "$SMPROGRAMS\NEXUS\NEXUS.lnk"
  Delete "$SMPROGRAMS\NEXUS\Odinstaluj NEXUS.lnk"
  RMDir "$SMPROGRAMS\NEXUS"

  ; Rejestr
  DeleteRegKey HKCU "Software\NEXUS"
!macroend