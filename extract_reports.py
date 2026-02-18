#!/usr/bin/env python3
import json
import sys

def extract_report(jsonl_file):
    """从JSONL文件中提取最后一条包含审查报告的消息"""
    try:
        with open(jsonl_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # 从后往前查找包含"审查报告"或"Review Report"的消息
        for line in reversed(lines):
            try:
                data = json.loads(line)
                if 'message' in data and 'content' in data['message']:
                    content = data['message']['content']
                    if isinstance(content, list):
                        for item in content:
                            if isinstance(item, dict) and item.get('type') == 'text':
                                text = item.get('text', '')
                                if ('审查报告' in text or 'Review Report' in text or
                                    '深度审查' in text or 'Comprehensive' in text):
                                    return text
            except:
                continue

        return None
    except Exception as e:
        print(f"Error reading {jsonl_file}: {e}", file=sys.stderr)
        return None

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: extract_reports.py <jsonl_file>")
        sys.exit(1)

    report = extract_report(sys.argv[1])
    if report:
        print(report)
    else:
        print("No report found", file=sys.stderr)
