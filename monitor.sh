#!/bin/bash

# Claude History Viewer 监控脚本
# 定期检查服务状态，自动重启失败的服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志文件
LOG_FILE="logs/monitor.log"
MAX_LOG_SIZE=10485760  # 10MB

# 旋转日志
rotate_log() {
    if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || echo 0) -gt $MAX_LOG_SIZE ]; then
        mv "$LOG_FILE" "$LOG_FILE.$(date +%Y%m%d_%H%M%S)"
        touch "$LOG_FILE"
    fi
}

# 记录日志
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

# 检查端口是否监听
check_port() {
    local port=$1
    local service=$2

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log "✅ $service (端口 $port) 正在运行"
        return 0
    else
        log "❌ $service (端口 $port) 未运行"
        return 1
    fi
}

# 检查PM2进程
check_pm2_process() {
    local name=$1

    if pm2 describe $name >/dev/null 2>&1; then
        local status=$(pm2 jlist | jq -r ".[] | select(.name==\"$name\") | .pm2_env.status")
        if [ "$status" = "online" ]; then
            log "✅ PM2进程 '$name' 状态: $status"
            return 0
        else
            log "⚠️  PM2进程 '$name' 状态: $status"
            return 1
        fi
    else
        log "❌ PM2进程 '$name' 不存在"
        return 1
    fi
}

# 检查API端点
check_api_endpoint() {
    local endpoint=$1
    local timeout=5

    if curl -s -f --max-time $timeimeout "http://localhost:8800$endpoint" >/dev/null 2>&1; then
        log "✅ API端点 '$endpoint' 响应正常"
        return 0
    else
        log "❌ API端点 '$endpoint' 无响应"
        return 1
    fi
}

# 检查磁盘空间
check_disk_space() {
    local threshold=90  # 百分比

    local usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')

    if [ "$usage" -lt "$threshold" ]; then
        log "✅ 磁盘空间使用率: ${usage}% (正常)"
        return 0
    else
        log "⚠️  磁盘空间使用率: ${usage}% (超过 ${threshold}% 阈值)"
        return 1
    fi
}

# 检查内存使用
check_memory_usage() {
    local threshold=80  # 百分比

    # 获取PM2进程内存使用
    local memory_info=$(pm2 jlist | jq -r '.[] | "\(.name):\(.monit.memory)"')

    echo "$memory_info" | while IFS=: read -r name memory; do
        if [ -n "$memory" ]; then
            local mb=$((memory / 1024 / 1024))
            log "📊 进程 '$name' 内存使用: ${mb}MB"

            # 检查是否超过1GB限制
            if [ $mb -gt 1024 ]; then
                log "⚠️  进程 '$name' 内存使用超过1GB限制"
            fi
        fi
    done
}

# 重启服务
restart_service() {
    local name=$1

    log "🔄 重启服务: $name"
    pm2 restart $name

    # 等待服务启动
    sleep 3

    if check_pm2_process "$name"; then
        log "✅ 服务 '$name' 重启成功"
        return 0
    else
        log "❌ 服务 '$name' 重启失败"
        return 1
    fi
}

# 发送通知（可扩展为邮件、Slack等）
send_notification() {
    local message=$1
    local level=$2  # info, warning, error

    # 这里可以集成通知系统
    # 例如: curl -X POST -H 'Content-type: application/json' --data "{\"text\":\"$message\"}" $SLACK_WEBHOOK_URL

    log "📢 [$level] 通知: $message"
}

# 主监控函数
monitor() {
    log "🔍 开始监控检查..."

    local errors=0
    local warnings=0

    # 检查日志文件大小
    rotate_log

    # 检查端口
    if ! check_port 3100 "前端服务"; then
        errors=$((errors + 1))
        send_notification "前端服务(3100)未运行" "error"
        restart_service "claude-history-viewer-frontend"
    fi

    if ! check_port 8800 "后端服务"; then
        errors=$((errors + 1))
        send_notification "后端服务(8800)未运行" "error"
        restart_service "claude-history-viewer-backend"
    fi

    # 检查PM2进程
    if ! check_pm2_process "claude-history-viewer-frontend"; then
        warnings=$((warnings + 1))
    fi

    if ! check_pm2_process "claude-history-viewer-backend"; then
        warnings=$((warnings + 1))
    fi

    # 检查API端点（如果后端运行）
    if check_port 8800 "后端服务"; then
        if ! check_api_endpoint "/api/stats"; then
            warnings=$((warnings + 1))
        fi

        if ! check_api_endpoint "/api/sessions"; then
            warnings=$((warnings + 1))
        fi
    fi

    # 检查系统资源
    if ! check_disk_space; then
        warnings=$((warnings + 1))
        send_notification "磁盘空间使用率过高" "warning"
    fi

    # 检查内存使用
    check_memory_usage

    # 生成报告
    log "📈 监控报告: $errors 个错误, $warnings 个警告"

    if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
        log "🎉 所有检查通过，系统运行正常"
    elif [ $errors -gt 0 ]; then
        send_notification "监控发现 $errors 个错误，$warnings 个警告" "error"
    elif [ $warnings -gt 0 ]; then
        send_notification "监控发现 $warnings 个警告" "warning"
    fi

    log "🔚 监控检查完成"
}

# 持续监控模式
continuous_monitor() {
    local interval=${1:-300}  # 默认5分钟

    log "🔄 进入持续监控模式，间隔: ${interval}秒"

    while true; do
        monitor
        sleep $interval
    done
}

# 单次检查模式
single_check() {
    monitor
}

# 显示帮助
show_help() {
    echo "Claude History Viewer 监控脚本"
    echo ""
    echo "使用方法: ./monitor.sh [模式] [参数]"
    echo ""
    echo "模式:"
    echo "  single      单次检查（默认）"
    echo "  continuous  持续监控"
    echo ""
    echo "参数:"
    echo "  --interval <秒>  持续监控的间隔时间（默认: 300）"
    echo "  --help          显示帮助信息"
    echo ""
    echo "示例:"
    echo "  ./monitor.sh                     # 单次检查"
    echo "  ./monitor.sh continuous          # 持续监控（5分钟间隔）"
    echo "  ./monitor.sh continuous --interval 60  # 持续监控（1分钟间隔）"
}

# 主函数
main() {
    # 确保日志目录存在
    mkdir -p logs

    case "$1" in
        single|"")
            single_check
            ;;
        continuous)
            local interval=300

            # 解析参数
            shift
            while [ $# -gt 0 ]; do
                case "$1" in
                    --interval)
                        interval="$2"
                        shift 2
                        ;;
                    --help)
                        show_help
                        exit 0
                        ;;
                    *)
                        echo "未知参数: $1"
                        show_help
                        exit 1
                        ;;
                esac
            done

            continuous_monitor "$interval"
            ;;
        --help|-h)
            show_help
            ;;
        *)
            echo "未知模式: $1"
            show_help
            exit 1
            ;;
    esac
}

# 检查jq是否安装（用于JSON解析）
if ! command -v jq &> /dev/null; then
    echo "错误: jq 未安装。请安装: brew install jq 或 apt-get install jq"
    exit 1
fi

# 执行主函数
main "$@"