#!/usr/bin/env bash
# ==============================================================================
#  SalaryBot Management Script (Sanaei 3x-ui Style CLI Panel - Pure English)
#  GitHub Repository: https://github.com/meh732/salarybot.git
#  One-Line Command : bash <(curl -Ls https://raw.githubusercontent.com/meh732/salarybot/main/install.sh)
#  Management CLI   : salarybot
# ==============================================================================

red='\033[0;31m'
green='\033[0;32m'
yellow='\033[0;33m'
blue='\033[0;34m'
purple='\033[0;35m'
cyan='\033[0;36m'
plain='\033[0m'

REPO_URL="https://github.com/meh732/salarybot.git"
RAW_INSTALL_URL="https://raw.githubusercontent.com/meh732/salarybot/main/install.sh"
INSTALL_DIR="/usr/local/salarybot"
SERVICE_NAME="salarybot"
CLI_PATH="/usr/bin/salarybot"
DEFAULT_PORT="3000"

# Check root privilege
[[ $EUID -ne 0 ]] && echo -e "${red}[ERROR]${plain} Please run this script as root (sudo -i)!\n" && exit 1

# Detect OS
if [[ -f /etc/redhat-release ]]; then
    release="centos"
elif cat /etc/issue | grep -Eqi "debian"; then
    release="debian"
elif cat /etc/issue | grep -Eqi "ubuntu"; then
    release="ubuntu"
elif cat /etc/issue | grep -Eqi "centos|red hat|redhat"; then
    release="centos"
elif cat /proc/version | grep -Eqi "debian"; then
    release="debian"
elif cat /proc/version | grep -Eqi "ubuntu"; then
    release="ubuntu"
else
    release="ubuntu"
fi

check_status() {
    if [[ ! -f "/etc/systemd/system/${SERVICE_NAME}.service" ]]; then
        return 2
    fi
    temp=$(systemctl status ${SERVICE_NAME} | grep Active | awk '{print $3}' | cut -d "(" -f2 | cut -d ")" -f1)
    if [[ "${temp}" == "running" ]]; then
        return 0
    else
        return 1
    fi
}

check_enabled() {
    temp=$(systemctl is-enabled ${SERVICE_NAME} 2>/dev/null)
    if [[ "${temp}" == "enabled" ]]; then
        return 0
    else
        return 1
    fi
}

show_status() {
    check_status
    case $? in
    0)
        echo -e "  Service Status : ${green}Running${plain}"
        show_enable_status
        ;;
    1)
        echo -e "  Service Status : ${yellow}Stopped${plain}"
        show_enable_status
        ;;
    2)
        echo -e "  Service Status : ${red}Not Installed${plain}"
        ;;
    esac
}

show_enable_status() {
    check_enabled
    if [[ $? == 0 ]]; then
        echo -e "  Auto-Start     : ${green}Enabled${plain}"
    else
        echo -e "  Auto-Start     : ${red}Disabled${plain}"
    fi
}

install_base() {
    echo -e "${cyan}[1/5] Installing system dependencies (curl, git, Node.js 20)...${plain}"
    if [[ "${release}" == "centos" ]]; then
        yum install -y curl wget git tar gcc-c++ make
        if ! command -v node &>/dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
            yum install -y nodejs
        fi
    else
        apt-get update -y
        apt-get install -y curl wget git tar build-essential ca-certificates
        if ! command -v node &>/dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs
        fi
    fi
}

install_panel() {
    install_base

    echo -e "${cyan}[2/5] Cloning repository from GitHub (${REPO_URL})...${plain}"
    if [[ -d "${INSTALL_DIR}/.git" ]]; then
        git -C "${INSTALL_DIR}" fetch --all
        git -C "${INSTALL_DIR}" reset --hard origin/main || git -C "${INSTALL_DIR}" pull
    else
        rm -rf "${INSTALL_DIR}"
        git clone "${REPO_URL}" "${INSTALL_DIR}"
    fi

    echo -e "${cyan}[3/5] Installing npm packages and building production bundle...${plain}"
    npm --prefix "${INSTALL_DIR}" install --legacy-peer-deps
    npm --prefix "${INSTALL_DIR}" run build

    echo -e "${cyan}[4/5] Configuring Port, Web Panel Login, Bot Tokens, and Admin ID...${plain}"
    read -rp "Enter Panel & Webhook Port [default: 3000]: " input_port </dev/tty
    PORT="${input_port:-3000}"

    read -rp "Enter Web Panel Login Username [default: admin]: " panel_user </dev/tty
    PANEL_USERNAME="${panel_user:-admin}"
    read -rp "Enter Web Panel Login Password [default: admin123456]: " panel_pass </dev/tty
    PANEL_PASSWORD="${panel_pass:-admin123456}"

    read -rp "Enter Telegram Bot Token (@BotFather) [optional]: " tg_token </dev/tty
    read -rp "Enter Bale Bot Token (@botfather) [optional]: " bale_token </dev/tty
    read -rp "Enter Admin Numeric Chat ID (e.g. 589402194) [optional]: " admin_id </dev/tty
    ADMIN_ID="${admin_id:-}"
    read -rp "Enter In-Bot Master Secret for /setadmin [default: 123456]: " admin_secret </dev/tty
    ADMIN_SECRET="${admin_secret:-123456}"

    cat > "${INSTALL_DIR}/.env" <<EOF
PORT=${PORT}
NODE_ENV=production
PANEL_USERNAME=${PANEL_USERNAME}
PANEL_PASSWORD=${PANEL_PASSWORD}
TELEGRAM_BOT_TOKEN=${tg_token}
BALE_BOT_TOKEN=${bale_token}
ADMIN_IDS=${ADMIN_ID}
ADMIN_SECRET=${ADMIN_SECRET}
EOF

    echo -e "${cyan}[5/5] Creating systemd service and 'salarybot' CLI command...${plain}"
    cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=SalaryBot - Telegram & Bale Payroll Bot Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/bin/npx tsx server.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    cp -f "${INSTALL_DIR}/install.sh" "${CLI_PATH}" 2>/dev/null || curl -Ls "${RAW_INSTALL_URL}" -o "${CLI_PATH}"
    chmod +x "${CLI_PATH}"

    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME}
    systemctl restart ${SERVICE_NAME}

    SERVER_IP=$(curl -s4m8 ip.sb || hostname -I | awk '{print $1}')
    echo -e ""
    echo -e "${green}======================================================================${plain}"
    echo -e "${green}  [SUCCESS] SalaryBot Panel & Bot Service Installed Successfully!     ${plain}"
    echo -e "${green}======================================================================${plain}"
    echo -e "  Web Panel URL        : ${cyan}http://${SERVER_IP}:${PORT}${plain}"
    echo -e "  Web Panel Username   : ${green}${PANEL_USERNAME}${plain}"
    echo -e "  Web Panel Password   : ${green}${PANEL_PASSWORD}${plain}"
    echo -e "  Telegram Webhook URL : ${yellow}http://${SERVER_IP}:${PORT}/api/webhook/telegram${plain}"
    echo -e "  Bale Webhook URL     : ${yellow}http://${SERVER_IP}:${PORT}/api/webhook/bale${plain}"
    echo -e "  In-Bot Admin Command : Send ${green}/setadmin ${ADMIN_SECRET}${plain} inside Bot Chat!"
    echo -e "  Management Command   : Type ${green}salarybot${plain} anytime in terminal!"
    echo -e "${green}======================================================================${plain}"
}

update_panel() {
    echo -e "${cyan}[INFO] Updating SalaryBot from GitHub (preserving database & config)...${plain}"
    if [[ ! -d "${INSTALL_DIR}" ]]; then
        echo -e "${red}[ERROR] SalaryBot is not installed yet! Please run option 1 first.${plain}"
        return 1
    fi

    # Backup Database & .env
    if [[ -f "${INSTALL_DIR}/data/payroll-db.json" ]]; then
        cp -f "${INSTALL_DIR}/data/payroll-db.json" "/tmp/payroll-db-backup.json"
        echo -e "${green}[OK] Database backup saved to /tmp/payroll-db-backup.json${plain}"
    fi
    if [[ -f "${INSTALL_DIR}/.env" ]]; then
        cp -f "${INSTALL_DIR}/.env" "/tmp/salarybot-env-backup"
    fi

    git -C "${INSTALL_DIR}" fetch --all
    git -C "${INSTALL_DIR}" reset --hard origin/main || git -C "${INSTALL_DIR}" pull

    # Restore Database & .env
    if [[ -f "/tmp/payroll-db-backup.json" ]]; then
        mkdir -p "${INSTALL_DIR}/data"
        cp -f "/tmp/payroll-db-backup.json" "${INSTALL_DIR}/data/payroll-db.json"
    fi
    if [[ -f "/tmp/salarybot-env-backup" ]]; then
        cp -f "/tmp/salarybot-env-backup" "${INSTALL_DIR}/.env"
    fi

    # Prompt to set or update Web Panel Login Username & Password during update
    CURRENT_USER=$(grep -E "^PANEL_USERNAME=" "${INSTALL_DIR}/.env" 2>/dev/null | cut -d'=' -f2- || echo "admin")
    CURRENT_PASS=$(grep -E "^PANEL_PASSWORD=" "${INSTALL_DIR}/.env" 2>/dev/null | cut -d'=' -f2- || echo "")
    [[ -z "${CURRENT_USER}" ]] && CURRENT_USER="admin"

    echo -e "${cyan}--- Web Panel Security Credentials (Login Username & Password) ---${plain}"
    if [[ -e /dev/tty ]]; then
        read -rp "Enter Web Panel Login Username [default/current: ${CURRENT_USER}]: " upd_user </dev/tty
        read -rp "Enter Web Panel Login Password [leave blank to keep current${CURRENT_PASS:+ ($CURRENT_PASS)}]: " upd_pass </dev/tty
    fi
    FINAL_USER="${upd_user:-${CURRENT_USER}}"
    if [[ -n "${upd_pass}" ]]; then
        FINAL_PASS="${upd_pass}"
    elif [[ -n "${CURRENT_PASS}" ]]; then
        FINAL_PASS="${CURRENT_PASS}"
    else
        FINAL_PASS="admin123456"
    fi

    touch "${INSTALL_DIR}/.env"
    sed -i '/^PANEL_USERNAME=/d' "${INSTALL_DIR}/.env" 2>/dev/null || true
    sed -i '/^PANEL_PASSWORD=/d' "${INSTALL_DIR}/.env" 2>/dev/null || true
    echo "PANEL_USERNAME=${FINAL_USER}" >> "${INSTALL_DIR}/.env"
    echo "PANEL_PASSWORD=${FINAL_PASS}" >> "${INSTALL_DIR}/.env"

    npm --prefix "${INSTALL_DIR}" install --legacy-peer-deps
    npm --prefix "${INSTALL_DIR}" run build
    cp -f "${INSTALL_DIR}/install.sh" "${CLI_PATH}" 2>/dev/null || true
    chmod +x "${CLI_PATH}" 2>/dev/null || true

    systemctl restart ${SERVICE_NAME}
    echo -e "${green}[SUCCESS] SalaryBot updated and restarted without losing any data!${plain}"
    echo -e "  Web Panel Login Username : ${green}${FINAL_USER}${plain}"
    echo -e "  Web Panel Login Password : ${green}${FINAL_PASS}${plain}"
}

uninstall_panel() {
    echo -e "${red}[WARNING] Are you sure you want to completely uninstall SalaryBot? [y/n]: ${plain}"
    read -r confirm </dev/tty
    if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
        echo -e "${yellow}[INFO] Uninstall cancelled.${plain}"
        return 0
    fi

    if [[ -f "${INSTALL_DIR}/data/payroll-db.json" ]]; then
        BACKUP_FILE="/root/salarybot-db-backup-$(date +%F-%H%M).json"
        cp -f "${INSTALL_DIR}/data/payroll-db.json" "${BACKUP_FILE}"
        echo -e "${green}[OK] Final database backup saved to: ${BACKUP_FILE}${plain}"
    fi

    systemctl stop ${SERVICE_NAME} 2>/dev/null || true
    systemctl disable ${SERVICE_NAME} 2>/dev/null || true
    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    systemctl daemon-reload
    rm -rf "${INSTALL_DIR}"
    rm -f "${CLI_PATH}"

    echo -e "${green}[SUCCESS] SalaryBot service and files have been completely removed.${plain}"
}

config_tokens() {
    echo -e "${cyan}--- Configure Web Panel Login, Bot Tokens, Port, Admin ID & Master Secret ---${plain}"
    read -rp "Web Panel Login Username [default: admin]: " pnl_usr </dev/tty
    read -rp "Web Panel Login Password [default: admin123456]: " pnl_pwd </dev/tty
    read -rp "Telegram Bot Token (@BotFather): " tg_tok </dev/tty
    read -rp "Bale Bot Token (@botfather): " bale_tok </dev/tty
    read -rp "Admin Numeric Chat IDs (comma-separated, e.g. 589402194): " adm_id </dev/tty
    read -rp "In-Bot Master Secret for /setadmin [default 123456]: " adm_sec </dev/tty
    read -rp "Service Port [default 3000]: " srv_port </dev/tty
    PORT="${srv_port:-3000}"

    cat > "${INSTALL_DIR}/.env" <<EOF
PORT=${PORT}
NODE_ENV=production
PANEL_USERNAME=${pnl_usr:-admin}
PANEL_PASSWORD=${pnl_pwd:-admin123456}
TELEGRAM_BOT_TOKEN=${tg_tok}
BALE_BOT_TOKEN=${bale_tok}
ADMIN_IDS=${adm_id:-}
ADMIN_SECRET=${adm_sec:-123456}
EOF
    systemctl restart ${SERVICE_NAME}
    echo -e "${green}[SUCCESS] Configuration saved! Web Panel User: ${pnl_usr:-admin} | Pass: ${pnl_pwd:-admin123456}${plain}"
}

change_panel_auth() {
    echo -e "${cyan}--- Change Web Panel Login Username & Password ---${plain}"
    read -rp "Enter New Web Panel Username [default: admin]: " new_usr </dev/tty
    read -rp "Enter New Web Panel Password [default: admin123456]: " new_pwd </dev/tty
    FINAL_U="${new_usr:-admin}"
    FINAL_P="${new_pwd:-admin123456}"

    mkdir -p "${INSTALL_DIR}"
    touch "${INSTALL_DIR}/.env"
    sed -i '/^PANEL_USERNAME=/d' "${INSTALL_DIR}/.env" 2>/dev/null || true
    sed -i '/^PANEL_PASSWORD=/d' "${INSTALL_DIR}/.env" 2>/dev/null || true
    echo "PANEL_USERNAME=${FINAL_U}" >> "${INSTALL_DIR}/.env"
    echo "PANEL_PASSWORD=${FINAL_P}" >> "${INSTALL_DIR}/.env"

    systemctl restart ${SERVICE_NAME}
    echo -e "${green}[SUCCESS] Web Panel credentials updated! Username: ${FINAL_U} | Password: ${FINAL_P}${plain}"
}

set_webhook_cli() {
    echo -e "${cyan}--- Register Webhook on Telegram / Bale ---${plain}"
    read -rp "Select Platform (1: Telegram | 2: Bale): " plat_choice </dev/tty
    read -rp "Enter Bot Token: " wh_token </dev/tty
    read -rp "Enter Server HTTPS URL or Domain (e.g. https://bot.example.com): " wh_domain </dev/tty
    wh_domain="${wh_domain%/}"

    if [[ "${plat_choice}" == "2" ]]; then
        WH_URL="${wh_domain}/api/webhook/bale"
        RES=$(curl -s "https://tapi.bale.ai/bot${wh_token}/setWebhook?url=${WH_URL}")
    else
        WH_URL="${wh_domain}/api/webhook/telegram"
        RES=$(curl -s "https://api.telegram.org/bot${wh_token}/setWebhook?url=${WH_URL}")
    fi
    echo -e "${green}API Response:${plain} ${RES}"
}

backup_db() {
    if [[ -f "${INSTALL_DIR}/data/payroll-db.json" ]]; then
        OUT="/root/salarybot-backup-$(date +%F-%H%M).json"
        cp -f "${INSTALL_DIR}/data/payroll-db.json" "${OUT}"
        echo -e "${green}[SUCCESS] Database backup saved to:${plain} ${yellow}${OUT}${plain}"
    else
        echo -e "${red}[ERROR] Database file not found!${plain}"
    fi
}

show_menu() {
    clear
    echo -e "${cyan}+--------------------------------------------------------------------+${plain}"
    echo -e "${cyan}|${plain}      ${green}SalaryBot Management Panel (Sanaei 3x-ui Style CLI)${plain}           ${cyan}|${plain}"
    echo -e "${cyan}|${plain}      ${yellow}GitHub: https://github.com/meh732/salarybot.git${plain}               ${cyan}|${plain}"
    echo -e "${cyan}+--------------------------------------------------------------------+${plain}"
    show_status
    echo -e "${cyan}----------------------------------------------------------------------${plain}"
    echo -e "  ${green}0.${plain} Exit Panel"
    echo -e "${cyan}----------------------------------------------------------------------${plain}"
    echo -e "  ${green}1.${plain} Install SalaryBot from GitHub (Full Setup)"
    echo -e "  ${green}2.${plain} Update SalaryBot from GitHub (Preserves Database & Sets Panel Auth)"
    echo -e "  ${green}3.${plain} Uninstall SalaryBot Completely"
    echo -e "${cyan}----------------------------------------------------------------------${plain}"
    echo -e "  ${green}4.${plain} Configure Bot Tokens, Port, Web Panel Login & Admin Chat ID"
    echo -e "  ${green}5.${plain} Set Webhook on Telegram / Bale API"
    echo -e "  ${green}6.${plain} Backup Payroll Database (payroll-db.json)"
    echo -e "  ${green}11.${plain} Change Web Panel Login Username & Password"
    echo -e "${cyan}----------------------------------------------------------------------${plain}"
    echo -e "  ${green}7.${plain} Start SalaryBot Service"
    echo -e "  ${green}8.${plain} Stop SalaryBot Service"
    echo -e "  ${green}9.${plain} Restart SalaryBot Service"
    echo -e "  ${green}10.${plain} View Live Service Logs (journalctl)"
    echo -e "${cyan}+--------------------------------------------------------------------+${plain}"
    echo && read -rp "Please enter your selection [0-11]: " num </dev/tty

    case "${num}" in
    0)
        exit 0
        ;;
    1)
        install_panel
        ;;
    2)
        update_panel
        ;;
    3)
        uninstall_panel
        ;;
    4)
        config_tokens
        ;;
    5)
        set_webhook_cli
        ;;
    6)
        backup_db
        ;;
    7)
        systemctl start ${SERVICE_NAME} && echo -e "${green}[OK] Service started.${plain}"
        ;;
    8)
        systemctl stop ${SERVICE_NAME} && echo -e "${yellow}[OK] Service stopped.${plain}"
        ;;
    9)
        systemctl restart ${SERVICE_NAME} && echo -e "${green}[OK] Service restarted.${plain}"
        ;;
    10)
        journalctl -u ${SERVICE_NAME} -n 50 --no-pager
        ;;
    11)
        change_panel_auth
        ;;
    *)
        echo -e "${red}[ERROR] Please enter a valid number between 0 and 11!${plain}"
        ;;
    esac
}

# Handle direct CLI arguments (install, update, uninstall, status, restart)
if [[ $# -gt 0 ]]; then
    case $1 in
    "install" | "--install")
        install_panel
        ;;
    "update" | "--update")
        update_panel
        ;;
    "uninstall" | "--uninstall")
        uninstall_panel
        ;;
    "status" | "--status")
        show_status
        ;;
    "restart" | "--restart")
        systemctl restart ${SERVICE_NAME}
        ;;
    *)
        show_menu
        ;;
    esac
else
    while true; do
        show_menu
        echo && read -rp "Press Enter to return to main menu..." </dev/tty
    done
fi
