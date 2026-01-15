; Custom NSIS installer script for Svony Browser

!macro customInit
  ; Custom initialization
!macroend

!macro customInstall
  ; Create flashver directory in installation
  CreateDirectory "$INSTDIR\resources\flashver"
  
  ; Create data directory
  CreateDirectory "$INSTDIR\resources\data"
  
  ; Create config directory
  CreateDirectory "$INSTDIR\resources\config"
!macroend

!macro customUnInstall
  ; Clean up custom directories
  RMDir /r "$INSTDIR\resources\flashver"
  RMDir /r "$INSTDIR\resources\data"
  RMDir /r "$INSTDIR\resources\config"
!macroend
