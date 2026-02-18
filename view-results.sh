#!/bin/bash
# 代码审查结果查看工具

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# 清屏
clear

# 显示欢迎信息
echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║       🎉 OpenClawCN 代码审查结果查看工具 🎉            ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# 显示完成状态
echo -e "${GREEN}✅ 状态: 所有18个Agent已完成审查${NC}"
echo -e "${BLUE}📊 发现: 119个问题 (18 Critical, 36 High, 50 Medium, 15 Low)${NC}"
echo -e "${YELLOW}⏱️  预计修复时间: 400-500小时 (2-3个月)${NC}"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 主菜单
echo -e "${BOLD}请选择要查看的报告:${NC}"
echo ""
echo -e "${GREEN}[1]${NC} 快速预览 (EXECUTIVE_SUMMARY.md) - ${YELLOW}5分钟${NC}"
echo -e "${GREEN}[2]${NC} 完整问题清单 (ALL_AGENTS_COMPREHENSIVE_SUMMARY.md) - ${YELLOW}15分钟${NC}"
echo -e "${GREEN}[3]${NC} 详细修复方案 (FINAL_COMPREHENSIVE_FIX_PLAN.md) - ${YELLOW}30分钟${NC}"
echo -e "${GREEN}[4]${NC} 模块审查汇总 (PHASE1_MODULE_REVIEW_SUMMARY.md)"
echo ""
echo -e "${CYAN}[5]${NC} 核心模块报告 (report_ac2ce88.md)"
echo -e "${CYAN}[6]${NC} Extensions报告 (report_ac04a22.md)"
echo -e "${CYAN}[7]${NC} macOS应用报告 (report_aeac412.md)"
echo -e "${CYAN}[8]${NC} iOS应用报告 (report_a7e49c1.md)"
echo -e "${CYAN}[9]${NC} DevOps报告 (report_aaf06e1.md)"
echo ""
echo -e "${MAGENTA}[10]${NC} 自动化执行报告 (AUTOMATION_COMPLETION_REPORT.md)"
echo -e "${MAGENTA}[11]${NC} 查看所有报告列表"
echo -e "${MAGENTA}[12]${NC} 搜索特定问题"
echo ""
echo -e "${RED}[0]${NC} 退出"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -ne "${BOLD}请输入选项 [0-12]: ${NC}"
read choice

echo ""

case $choice in
    1)
        echo -e "${GREEN}📄 正在打开: EXECUTIVE_SUMMARY.md${NC}"
        echo ""
        if [ -f "EXECUTIVE_SUMMARY.md" ]; then
            cat EXECUTIVE_SUMMARY.md | less -R
        else
            echo -e "${RED}❌ 文件不存在${NC}"
        fi
        ;;
    2)
        echo -e "${GREEN}📄 正在打开: ALL_AGENTS_COMPREHENSIVE_SUMMARY.md${NC}"
        echo ""
        if [ -f "ALL_AGENTS_COMPREHENSIVE_SUMMARY.md" ]; then
            cat ALL_AGENTS_COMPREHENSIVE_SUMMARY.md | less -R
        else
            echo -e "${RED}❌ 文件不存在${NC}"
        fi
        ;;
    3)
        echo -e "${GREEN}📄 正在打开: FINAL_COMPREHENSIVE_FIX_PLAN.md${NC}"
        echo ""
        if [ -f "FINAL_COMPREHENSIVE_FIX_PLAN.md" ]; then
            cat FINAL_COMPREHENSIVE_FIX_PLAN.md | less -R
        else
            echo -e "${RED}❌ 文件不存在${NC}"
        fi
        ;;
    4)
        echo -e "${GREEN}📄 正在打开: PHASE1_MODULE_REVIEW_SUMMARY.md${NC}"
        echo ""
        if [ -f "PHASE1_MODULE_REVIEW_SUMMARY.md" ]; then
            cat PHASE1_MODULE_REVIEW_SUMMARY.md | less -R
        else
            echo -e "${RED}❌ 文件不存在${NC}"
        fi
        ;;
    5)
        echo -e "${GREEN}📄 正在打开: report_ac2ce88.md (核心模块)${NC}"
        echo ""
        if [ -f "report_ac2ce88.md" ]; then
            cat report_ac2ce88.md | less -R
        else
            echo -e "${RED}❌ 文件不存在${NC}"
        fi
        ;;
    6)
        echo -e "${GREEN}📄 正在打开: report_ac04a22.md (Extensions)${NC}"
        echo ""
        if [ -f "report_ac04a22.md" ]; then
            cat report_ac04a22.md | less -R
        else
            echo -e "${RED}❌ 文件不存在${NC}"
        fi
        ;;
    7)
        echo -e "${GREEN}📄 正在打开: report_aeac412.md (macOS)${NC}"
        echo ""
        if [ -f "report_aeac412.md" ]; then
            cat report_aeac412.md | less -R
        else
            echo -e "${RED}❌ 文件不存在${NC}"
        fi
        ;;
    8)
        echo -e "${GREEN}📄 正在打开: report_a7e49c1.md (iOS)${NC}"
        echo ""
        if [ -f "report_a7e49c1.md" ]; then
            cat report_a7e49c1.md | less -R
        else
            echo -e "${RED}❌ 文件不存在${NC}"
        fi
        ;;
    9)
        echo -e "${GREEN}📄 正在打开: report_aaf06e1.md (DevOps)${NC}"
        echo ""
        if [ -f "report_aaf06e1.md" ]; then
            cat report_aaf06e1.md | less -R
        else
            echo -e "${RED}❌ 文件不存在${NC}"
        fi
        ;;
    10)
        echo -e "${GREEN}📄 正在打开: AUTOMATION_COMPLETION_REPORT.md${NC}"
        echo ""
        if [ -f "AUTOMATION_COMPLETION_REPORT.md" ]; then
            cat AUTOMATION_COMPLETION_REPORT.md | less -R
        else
            echo -e "${RED}❌ 文件不存在${NC}"
        fi
        ;;
    11)
        echo -e "${GREEN}📋 所有生成的报告文件:${NC}"
        echo ""
        echo -e "${BOLD}主要报告:${NC}"
        ls -lh EXECUTIVE_SUMMARY.md ALL_AGENTS_COMPREHENSIVE_SUMMARY.md FINAL_COMPREHENSIVE_FIX_PLAN.md PHASE1_MODULE_REVIEW_SUMMARY.md 2>/dev/null | awk '{print "  " $9, "(" $5 ")"}'
        echo ""
        echo -e "${BOLD}模块报告:${NC}"
        ls -lh report_*.md 2>/dev/null | awk '{print "  " $9, "(" $5 ")"}'
        echo ""
        echo -e "${BOLD}辅助文档:${NC}"
        ls -lh AUTOMATION_*.md ISSUE_TRACKING_CHECKLIST.md README_UPDATE_SUGGESTIONS.md 2>/dev/null | awk '{print "  " $9, "(" $5 ")"}'
        echo ""
        ;;
    12)
        echo -e "${YELLOW}🔍 搜索功能${NC}"
        echo ""
        echo "请选择搜索类型:"
        echo "[1] 搜索Critical问题"
        echo "[2] 搜索特定模块 (输入关键词)"
        echo "[3] 搜索安全漏洞"
        echo "[4] 自定义搜索"
        echo ""
        echo -ne "请输入选项 [1-4]: "
        read search_choice
        echo ""

        case $search_choice in
            1)
                echo -e "${GREEN}🔍 搜索所有Critical问题...${NC}"
                echo ""
                grep -n -A 5 "\[Critical\]" ALL_AGENTS_COMPREHENSIVE_SUMMARY.md 2>/dev/null | less -R
                ;;
            2)
                echo -ne "请输入模块关键词 (如: agents, extensions, macos): "
                read keyword
                echo ""
                echo -e "${GREEN}🔍 搜索包含 '$keyword' 的问题...${NC}"
                echo ""
                grep -i -n -A 5 "$keyword" ALL_AGENTS_COMPREHENSIVE_SUMMARY.md 2>/dev/null | less -R
                ;;
            3)
                echo -e "${GREEN}🔍 搜索所有安全漏洞...${NC}"
                echo ""
                grep -i -n -A 5 "security\|vulnerability\|injection\|auth" ALL_AGENTS_COMPREHENSIVE_SUMMARY.md 2>/dev/null | less -R
                ;;
            4)
                echo -ne "请输入搜索关键词: "
                read custom_keyword
                echo ""
                echo -e "${GREEN}🔍 搜索包含 '$custom_keyword' 的内容...${NC}"
                echo ""
                grep -i -n -A 5 "$custom_keyword" ALL_AGENTS_COMPREHENSIVE_SUMMARY.md 2>/dev/null | less -R
                ;;
            *)
                echo -e "${RED}❌ 无效选项${NC}"
                ;;
        esac
        ;;
    0)
        echo -e "${GREEN}👋 再见!${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ 无效选项,请重新运行脚本${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ 查看完成${NC}"
echo ""
echo -e "${YELLOW}提示: 再次运行 ./view-results.sh 可以查看其他报告${NC}"
echo ""
