#!/usr/bin/env python3
"""
新闻数据静态化脚本
- 从中新网 RSS 源抓取最新新闻
- 按分类筛选，生成 news.json 供前端直接读取
- 前端优先读取本地 news.json，避免运行时频繁调用第三方代理 API

输出文件: news.json （放在仓库根目录）
"""

import requests
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
import sys

# 中新网 RSS 源
RSS_FEEDS = [
    { 'rss': 'https://www.chinanews.com.cn/rss/world.xml',        'tag': '国际', 'cls': 'tag-intl' },
    { 'rss': 'https://www.chinanews.com.cn/rss/sports.xml',       'tag': '体育', 'cls': 'tag-sports' },
    { 'rss': 'https://www.chinanews.com.cn/rss/finance.xml',      'tag': '财经', 'cls': 'tag-finance' },
    { 'rss': 'https://www.chinanews.com.cn/rss/edu.xml',          'tag': '教育', 'cls': 'tag-edu' },
    { 'rss': 'https://www.chinanews.com.cn/rss/scroll-news.xml',  'tag': '综合', 'cls': 'tag-domestic' },
]

# 代理列表（在 GitHub Actions 环境中可以直接访问外网，优先直连）
PROXIES = [
    '',  # 直连
    'https://api.rss2json.com/v1/api.json?rss_url=',
    'https://api.allorigins.win/raw?url=',
]

ENTERTAIN_WORDS = ['电影','票房','明星','娱乐','音乐','综艺','演唱会','剧集','电视剧','演员','导演','歌手','出道','专辑','颁奖','影帝','影后','电影节','首映','定档','开播','收官','真人秀','偶像','选秀']

TIMEOUT = 15


def fetch_rss_direct(url):
    """直接获取 RSS XML 并解析"""
    resp = requests.get(url, timeout=TIMEOUT, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    resp.raise_for_status()
    root = ET.fromstring(resp.content)
    items = []
    for item in root.findall('.//item'):
        title = item.findtext('title', '').strip()
        link = item.findtext('link', '').strip()
        if title and link:
            items.append({ 'title': title, 'link': link })
    return items


def fetch_rss_via_rss2json(url):
    """通过 rss2json 代理获取"""
    api_url = 'https://api.rss2json.com/v1/api.json?rss_url=' + requests.utils.quote(url, safe='')
    resp = requests.get(api_url, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    if data.get('items'):
        return [{ 'title': i.get('title', ''), 'link': i.get('link', '') } for i in data['items'] if i.get('title') and i.get('link')]
    return []


def fetch_rss_via_allorigins(url):
    """通过 allorigins 代理获取"""
    api_url = 'https://api.allorigins.win/raw?url=' + requests.utils.quote(url, safe='')
    resp = requests.get(api_url, timeout=TIMEOUT)
    resp.raise_for_status()
    root = ET.fromstring(resp.content)
    items = []
    for item in root.findall('.//item'):
        title = item.findtext('title', '').strip()
        link = item.findtext('link', '').strip()
        if title and link:
            items.append({ 'title': title, 'link': link })
    return items


def fetch_rss_items(url):
    """尝试多种方式获取 RSS items"""
    fetchers = [
        ('direct', lambda: fetch_rss_direct(url)),
        ('rss2json', lambda: fetch_rss_via_rss2json(url)),
        ('allorigins', lambda: fetch_rss_via_allorigins(url)),
    ]
    for name, fetcher in fetchers:
        try:
            items = fetcher()
            if items:
                print(f'  [{name}] 获取 {len(items)} 条')
                return items
        except Exception as e:
            print(f'  [{name}] 失败: {e}')
            continue
    return []


def main():
    print('=== 开始抓取新闻 ===')
    results = []

    # 1. 国际新闻：取前2条
    world_items = fetch_rss_items(RSS_FEEDS[0]['rss'])
    for item in world_items[:2]:
        results.append({ 'title': item['title'], 'url': item['link'], 'tag': '国际', 'cls': 'tag-intl' })

    # 2. 体育/财经/教育 各1条
    sports_items = fetch_rss_items(RSS_FEEDS[1]['rss'])
    if sports_items:
        results.append({ 'title': sports_items[0]['title'], 'url': sports_items[0]['link'], 'tag': '体育', 'cls': 'tag-sports' })

    finance_items = fetch_rss_items(RSS_FEEDS[2]['rss'])
    if finance_items:
        results.append({ 'title': finance_items[0]['title'], 'url': finance_items[0]['link'], 'tag': '财经', 'cls': 'tag-finance' })

    edu_items = fetch_rss_items(RSS_FEEDS[3]['rss'])
    if edu_items:
        results.append({ 'title': edu_items[0]['title'], 'url': edu_items[0]['link'], 'tag': '教育', 'cls': 'tag-edu' })

    # 3. 娱乐：从综合滚动新闻中筛选
    scroll_items = fetch_rss_items(RSS_FEEDS[4]['rss'])
    entertain_found = False
    for item in scroll_items:
        if any(w in item['title'] for w in ENTERTAIN_WORDS):
            results.append({ 'title': item['title'], 'url': item['link'], 'tag': '娱乐', 'cls': 'tag-entertain' })
            entertain_found = True
            break
    if not entertain_found and scroll_items:
        results.append({ 'title': scroll_items[0]['title'], 'url': scroll_items[0]['link'], 'tag': '国内', 'cls': 'tag-domestic' })

    # 4. 补充综合新闻到8条
    if len(results) < 8 and scroll_items:
        existing_urls = {r['url'] for r in results}
        for item in scroll_items:
            if len(results) >= 8:
                break
            if item['link'] not in existing_urls:
                results.append({ 'title': item['title'], 'url': item['link'], 'tag': '国内', 'cls': 'tag-domestic' })

    if len(results) < 3:
        print(f'⚠️ 仅获取到 {len(results)} 条新闻，不足3条，跳过更新')
        sys.exit(0)

    # 生成 news.json
    beijing_tz = timezone(timedelta(hours=8))
    output = {
        'news': results,
        'updated': datetime.now(beijing_tz).strftime('%Y-%m-%d %H:%M'),
        'count': len(results),
    }

    with open('news.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f'✅ 成功生成 news.json，共 {len(results)} 条新闻')
    print(f'   更新时间: {output["updated"]}')


if __name__ == '__main__':
    main()
