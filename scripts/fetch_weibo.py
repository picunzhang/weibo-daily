#!/usr/bin/env python3
"""
微博热搜数据抓取脚本
从 tophub.today 获取微博热搜前10条数据，生成JSON数据文件
"""

import json
import re
import sys
from datetime import datetime, timezone, timedelta
from urllib.request import urlopen, Request
from html.parser import HTMLParser


class WeiboHotParser(HTMLParser):
    """解析 tophub.today 微博热搜页面"""
    
    def __init__(self):
        super().__init__()
        self.items = []
        self.current_item = None
        self.in_link = False
        self.in_td = False
        self.td_count = 0
        self.tr_started = False
        self.capture_text = False
        self.captured_texts = []
    
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        
        if tag == 'tr':
            self.tr_started = True
            self.captured_texts = []
            self.td_count = 0
        
        if tag == 'td' and self.tr_started:
            self.td_count += 1
            self.in_td = True
        
        if tag == 'a' and self.in_td and self.td_count == 2:
            self.in_link = True
            self.capture_text = True
            # 提取链接
            href = attrs_dict.get('href', '')
            if href:
                self.current_item = {'url': href}
        
    def handle_endtag(self, tag):
        if tag == 'a' and self.in_link:
            self.in_link = False
            self.capture_text = False
        
        if tag == 'td':
            self.in_td = False
        
        if tag == 'tr' and self.tr_started:
            self.tr_started = False
            if self.current_item and self.current_item.get('title'):
                # 提取热度数据（从captured_texts中）
                hot = ''
                for t in self.captured_texts:
                    t = t.strip()
                    if re.match(r'^\d+[\u4e00-\u9fff]?$', t) or re.match(r'^[\d.]+\u4e07$', t):
                        hot = t
                        break
                self.current_item['hot'] = hot
                self.items.append(self.current_item)
            self.current_item = None
    
    def handle_data(self, data):
        if self.capture_text and self.current_item is not None:
            text = data.strip()
            if text:
                self.current_item['title'] = text
        
        if self.tr_started and data.strip():
            self.captured_texts.append(data.strip())


def fetch_weibo_hot():
    """获取微博热搜前10条"""
    url = "https://tophub.today/n/KqndgxeLl9"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }
    
    req = Request(url, headers=headers)
    
    try:
        with urlopen(req, timeout=30) as response:
            html = response.read().decode('utf-8', errors='ignore')
        
        parser = WeiboHotParser()
        parser.feed(html)
        
        top10 = parser.items[:10]
        
        if not top10:
            print("Warning: No data parsed, trying fallback...")
            return fetch_weibo_hot_fallback()
        
        result = []
        for i, item in enumerate(top10):
            result.append({
                'rank': i + 1,
                'title': item.get('title', ''),
                'hot': item.get('hot', ''),
                'url': item.get('url', '')
            })
        
        return result
        
    except Exception as e:
        print(f"Error fetching from tophub: {e}")
        return fetch_weibo_hot_fallback()


def fetch_weibo_hot_fallback():
    """备用方案：从微博移动端获取"""
    url = "https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'application/json',
        'Referer': 'https://m.weibo.cn/',
    }
    
    req = Request(url, headers=headers)
    
    try:
        with urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
        
        cards = data.get('data', {}).get('cards', [])
        if cards:
            card_group = cards[0].get('card_group', [])
            result = []
            for i, item in enumerate(card_group[:10]):
                desc = item.get('desc', '')
                result.append({
                    'rank': i + 1,
                    'title': desc,
                    'hot': '',
                    'url': item.get('scheme', '')
                })
            return result
    except Exception as e:
        print(f"Error fetching fallback: {e}")
    
    return []


def get_beijing_time():
    """获取北京时间"""
    utc_now = datetime.now(timezone.utc)
    beijing_tz = timezone(timedelta(hours=8))
    return utc_now.astimezone(beijing_tz)


def main():
    print(f"[{get_beijing_time().strftime('%Y-%m-%d %H:%M:%S')}] Start fetching Weibo hot search...")
    
    hot_list = fetch_weibo_hot()
    
    now = get_beijing_time()
    
    output = {
        'update_time': now.strftime('%Y-%m-%d %H:%M'),
        'date': now.strftime('%Y年%m月%d日'),
        'weekday': ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'][now.weekday()],
        'year': now.strftime('%Y'),
        'month': now.strftime('%m'),
        'day': now.strftime('%d'),
        'items': hot_list
    }
    
    # 写入JSON数据文件
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"[{get_beijing_time().strftime('%Y-%m-%d %H:%M:%S')}] Fetched {len(hot_list)} items")
    
    if hot_list:
        for item in hot_list:
            print(f"  {item['rank']}. {item['title']} ({item['hot']})")
    
    return output


if __name__ == '__main__':
    main()
