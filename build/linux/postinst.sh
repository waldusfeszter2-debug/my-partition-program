#!/bin/bash
set -e

APP_DIR="/opt/NEXUS"

# 1. Poprawne uprawnienia dla piaskownicy (chrome-sandbox)
if [ -f "$APP_DIR/chrome-sandbox" ]; then
    chown root:root "$APP_DIR/chrome-sandbox"
    chmod 4755 "$APP_DIR/chrome-sandbox"
    echo "Uprawnienia chrome-sandbox zostały naprawione."
else
    echo "Ostrzeżenie: nie znaleziono pliku chrome-sandbox w $APP_DIR"
fi

# 2. Profil AppArmor dla nowszych wersji Ubuntu (24.04+)
# Ten profil pozwala aplikacji na używanie przestrzeni nazw użytkownika.
if command -v apparmor_parser &>/dev/null; then
    PROFILE_NAME="nexus-browser"
    PROFILE_PATH="/etc/apparmor.d/$PROFILE_NAME"

    # Sprawdź, czy jądro systemu wspiera wymaganą składnię
    if apparmor_parser --skip-kernel-load --debug /dev/stdin <<< "abi <abi/4.0>, include <tunables/global> profile test /bin/true flags=(unconfined) { userns, }" 2>/dev/null; then
        cat > "$PROFILE_PATH" <<EOF
abi <abi/4.0>,
include <tunables/global>

profile nexus-browser "$APP_DIR/nexus" flags=(unconfined) {
  userns,
  include if exists <local/nexus-browser>
}
EOF
        apparmor_parser --replace --write-cache --skip-read-cache "$PROFILE_PATH"
        echo "Profil AppArmor dla NEXUS został zainstalowany."
    else
        echo "Informacja: Twój system nie wymaga profilu AppArmor (starsza wersja Ubuntu)."
    fi
else
    echo "Informacja: AppArmor nie jest zainstalowany. Pomijam."
fi

exit 0