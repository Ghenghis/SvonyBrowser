; Svony Browser Custom NSIS Installer Script
; Powered by Borg

!include "MUI2.nsh"

; Custom branding
!define MUI_WELCOMEPAGE_TITLE "Welcome to Svony Browser Setup"
!define MUI_WELCOMEPAGE_TEXT "Svony Browser - Powered by Borg$\r$\n$\r$\nEvony Analysis Suite with Flash Browser, Dual Panels, Traffic Viewer, Protocol Explorer, Combat Simulator, and AI Co-Pilot.$\r$\n$\r$\nClick Next to continue."

!define MUI_FINISHPAGE_TITLE "Svony Browser Installation Complete"
!define MUI_FINISHPAGE_TEXT "Svony Browser has been installed on your computer.$\r$\n$\r$\nClick Finish to close this wizard."

; Icon themes available in icons/ folder:
; - icons/autoevony/ - AutoEvony theme (gold/cyan)
; - icons/borg/ - Borg theme (green circuits)
; - icons/icon.ico - Default icon

!macro customHeader
  !system "echo Svony Browser - Powered by Borg"
!macroend

!macro customInit
  ; Custom initialization
!macroend

!macro customInstall
  ; Copy icon themes for user selection
  SetOutPath "$INSTDIR\icons\autoevony"
  File /r "icons\autoevony\*.*"
  
  SetOutPath "$INSTDIR\icons\borg"
  File /r "icons\borg\*.*"
  
  SetOutPath "$INSTDIR\icons\installer"
  File /r "icons\installer\*.*"
!macroend

!macro customUnInstall
  ; Clean up icon themes
  RMDir /r "$INSTDIR\icons\autoevony"
  RMDir /r "$INSTDIR\icons\borg"
  RMDir /r "$INSTDIR\icons\installer"
!macroend
