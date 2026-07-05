#!/usr/bin/env python3
"""
HTML生成脚本
读取 data.json，生成适配7.3寸墨水屏(5:3, 800x480)的静态HTML页面
"""

import json
import os
from datetime import datetime, timezone, timedelta


def get_beijing_time():
    utc_now = datetime.now(timezone.utc)
    beijing_tz = timezone(timedelta(hours=8))
    return utc_now.astimezone(beijing_tz)


def generate_html(data):
    """生成墨水屏友好的HTML页面"""
    
    items_html = ""
    for item in data.get('items', []):
        rank = item.get('rank', '')
        title = item.get('title', '')
        hot = item.get('hot', '')
        
        # 对标题进行截断，避免溢出
        max_title_len = 18
        if len(title) > max_title_len:
            title = title[:max_title_len] + '...'
        
        items_html += f'''
        <div class="hot-item">
            <span class="rank">{rank}</span>
            <span class="title">{title}</span>
            <span class="hot">{hot}</span>
        </div>'''
    
    now = get_beijing_time()
    time_str = now.strftime('%H:%M')
    
    html_content = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>每日简报 - {data.get('date', '')}</title>
    <style>
        /* 7.3寸墨水屏优化 - 800x480 (5:3) */
        @font-face {{
            font-family: 'Noto Sans CJK SC';
            src: local('Noto Sans CJK SC'), local('Microsoft YaHei'), local('SimHei'), local('WenQuanYi Micro Hei');
        }}

        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            width: 800px;
            height: 480px;
            font-family: 'Noto Sans CJK SC', 'Microsoft YaHei', 'SimHei', 'WenQuanYi Micro Hei', sans-serif;
            background: #fff;
            color: #000;
            padding: 20px 28px;
            overflow: hidden;
        }}

        .header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 12px;
        }}

        .header-left {{
            display: flex;
            align-items: baseline;
            gap: 12px;
        }}

        .header-left .date {{
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 2px;
        }}

        .header-left .weekday {{
            font-size: 16px;
            opacity: 0.7;
        }}

        .header-right .time {{
            font-size: 32px;
            font-weight: bold;
            font-family: 'Courier New', monospace;
        }}

        .section-title {{
            font-size: 16px;
            font-weight: bold;
            padding: 6px 0;
            border-bottom: 1px solid #ccc;
            margin-bottom: 8px;
            letter-spacing: 4px;
        }}

        .hot-list {{
            display: flex;
            flex-direction: column;
            gap: 4px;
        }}

        .hot-item {{
            display: flex;
            align-items: center;
            padding: 4px 8px;
            font-size: 15px;
            line-height: 1.4;
            border-bottom: 1px dashed #ddd;
        }}

        .hot-item:last-child {{
            border-bottom: none;
        }}

        .hot-item .rank {{
            width: 28px;
            font-weight: bold;
            font-size: 16px;
            flex-shrink: 0;
        }}

        .hot-item .rank.top3 {{
            color: #000;
            font-weight: 900;
        }}

        .hot-item .title {{
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }}

        .hot-item .hot {{
            width: 60px;
            text-align: right;
            font-size: 12px;
            opacity: 0.6;
            flex-shrink: 0;
        }}

        .footer {{
            position: absolute;
            bottom: 12px;
            right: 28px;
            font-size: 11px;
            opacity: 0.5;
        }}

        /* 墨水屏优化：无动画、无阴影、纯黑白 */
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <span class="date">{data.get('date', '')}</span>
            <span class="weekday">{data.get('weekday', '')}</span>
        </div>
        <div class="header-right">
            <span class="time">{time_str}</span>
        </div>
    </div>

    <div class="section-title">微 博 热 搜</div>

    <div class="hot-list">
        {items_html}
    </div>

    <div class="footer">更新于 {data.get('update_time', '')} | 墨水屏简报</div>
</body>
</html>'''
    
    return html_content


def main():
    # 读取数据
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data.json')
    if not os.path.exists(data_path):
        print("Error: data.json not found. Run fetch_weibo.py first.")
        return False
    
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 生成HTML
    html = generate_html(data)
    
    # 写入index.html
    output_path = os.path.join(os.path.dirname(__file__), '..', 'index.html')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"HTML generated: {output_path}")
    return True


if __name__ == '__main__':
    main()
