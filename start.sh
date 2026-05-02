#!/bin/bash

# Claude History Viewer 启动脚本
# 作者: Claude Code
# 日期: 2026-03-27

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."

    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js未安装"
        exit 1
    fi

    # 检查npm
    if ! command -v npm &> /dev/null; then
        log_error "npm未安装"
        exit 1
    fi

    # 检查PM2
    if ! command -v pm2 &> /dev/null; then
        log_warning "PM2未安装，正在安装..."
        npm install -g pm2
    fi

    log_success "所有依赖检查通过"
}

# 安装项目依赖
install_dependencies() {
    log_info "安装项目依赖..."
    npm install
    log_success "依赖安装完成"
}

# 构建项目
build_project() {
    log_info "构建项目..."
    npm run build
    log_success "项目构建完成"
}

# 创建日志目录
create_logs_dir() {
    log_info "创建日志目录..."
    mkdir -p logs
    log_success "日志目录创建完成"
}

# 启动服务
start_services() {
    log_info "启动服务..."

    # 加载环境变量
    if [ -f .env.production ]; then
        export $(grep -v '^#' .env.production | xargs)
    fi

    # 停止现有服务
    pm2 delete ecosystem.config.cjs 2>/dev/null || true

    # 启动新服务
    pm2 start ecosystem.config.cjs

    # 保存PM2配置
    pm2 save

    # 设置开机自启
    pm2 startup 2>/dev/null || log_warning "开机自启设置可能需要sudo权限"

    log_success "服务启动完成"
}

# 显示状态
show_status() {
    log_info "服务状态:"
    echo ""
    pm2 list
    echo ""

    log_info "端口监听状态:"
    echo ""
    echo "前端 (端口 3100):"
    if lsof -Pi :3100 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "  ${GREEN}✓ 正在运行${NC}"
    else
        echo -e "  ${RED}✗ 未运行${NC}"
    fi

    echo "后端 (端口 8800):"
    if lsof -Pi :8800 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "  ${GREEN}✓ 正在运行${NC}"
    else
        echo -e "  ${RED}✗ 未运行${NC}"
    fi
    echo ""

    log_info "访问地址:"
    echo "前端: http://localhost:3100"
    echo "后端API: http://localhost:8800/api"
}

# 停止服务
stop_services() {
    log_info "停止服务..."
    pm2 stop ecosystem.config.cjs
    log_success "服务已停止"
}

# 重启服务
restart_services() {
    log_info "重启服务..."
    pm2 restart ecosystem.config.cjs
    log_success "服务已重启"
}

# 查看日志
view_logs() {
    log_info "查看日志..."
    echo ""
    echo "选择要查看的日志:"
    echo "1) 前端输出日志"
    echo "2) 前端错误日志"
    echo "3) 后端输出日志"
    echo "4) 后端错误日志"
    echo "5) 所有日志"
    echo ""
    read -p "请输入选项 (1-5): " choice

    case $choice in
        1) tail -f logs/frontend-out.log ;;
        2) tail -f logs/frontend-error.log ;;
        3) tail -f logs/backend-out.log ;;
        4) tail -f logs/backend-error.log ;;
        5) pm2 logs ;;
        *) log_error "无效选项" ;;
    esac
}

# 显示帮助
show_help() {
    echo "Claude History Viewer 管理脚本"
    echo ""
    echo "使用方法: ./start.sh [命令]"
    echo ""
    echo "命令:"
    echo "  install    安装依赖并构建项目"
    echo "  start      启动服务"
    echo "  stop       停止服务"
    echo "  restart    重启服务"
    echo "  status     查看服务状态"
    echo "  logs       查看日志"
    echo "  help       显示帮助信息"
    echo ""
    echo "示例:"
    echo "  ./start.sh install   # 安装并构建"
    echo "  ./start.sh start     # 启动服务"
    echo "  ./start.sh status    # 查看状态"
}

# 主函数
main() {
    case "$1" in
        install)
            check_dependencies
            install_dependencies
            build_project
            create_logs_dir
            ;;
        start)
            check_dependencies
            create_logs_dir
            start_services
            show_status
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            show_status
            ;;
        status)
            show_status
            ;;
        logs)
            view_logs
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            if [ -z "$1" ]; then
                # 默认执行完整安装和启动
                check_dependencies
                install_dependencies
                build_project
                create_logs_dir
                start_services
                show_status
            else
                log_error "未知命令: $1"
                show_help
                exit 1
            fi
            ;;
    esac
}

# 执行主函数
main "$@"