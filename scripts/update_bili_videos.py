#!/usr/bin/env python3
"""
B站排行榜视频数据抓取脚本
从 B站 API 获取最新排行榜数据，更新 app.js 中的 FALLBACK_BILI_VIDEOS
"""

import requests
import json
import re
import sys
from datetime import datetime

HEADERS = {
    'Referer': 'https://www.bilibili.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

RANKING_API = 'https://api.bilibili.com/x/web-interface/ranking/v2'

# 五大分类配置，与 app.js 中 VIDEO_CATEGORIES 一致
CATEGORIES = {
    'beauty':  {'rid': 155, 'filterTname': ['美妆护肤', '仿妆cos']},
    'fashion': {'rid': 155, 'filterTname': ['穿搭']},
    'game':    {'rid': 4,   'filterTname': None},
    'travel':  {'rid': 0,   'filterTname': ['出行']},
    'general': {'rid': 0,   'filterTname': None},
}

# 每类取 top 3
TOP_N = 3


def fetch_ranking(rid):
    """获取 B站排行榜数据"""
    url = f'{RANKING_API}?rid={rid}&type=all'
    resp = requests.get(url, headers=HEADERS, timeout=15)
    data = resp.json()
    if data['code'] != 0:
        print(f'  ✗ rid={rid} API error: {data["code"]}', file=sys.stderr)
        return []
    lst = data['data']['list']
    print(f'  ✓ rid={rid}: {len(lst)} videos fetched')
    return lst


def pick_top_videos(lst, filter_tname, n=TOP_N):
    """按热度（点赞+评论+收藏）筛选并排序，取 top N"""
    if filter_tname:
        candidates = [v for v in lst if any(t in (v.get('tname') or '') for t in filter_tname)]
    else:
        candidates = lst[:]
    if not candidates:
        candidates = lst[:]

    candidates.sort(
        key=lambda v: (v['stat']['like'] + v['stat']['reply'] + v['stat']['favorite']),
        reverse=True
    )

    result = []
    for v in candidates[:n]:
        result.append({
            'bvid': v['bvid'],
            'title': v['title'].replace('"', "'").replace('\\', ''),
            'author': v['owner']['name'].replace('"', "'").replace('\\', ''),
            'pic': (v.get('pic') or '').replace('http:', 'https:'),
            'stats': {
                'like': v['stat']['like'],
                'reply': v['stat']['reply'],
                'favorite': v['stat']['favorite'],
            }
        })
    return result


def generate_js_block(all_data):
    """生成 JS 代码块"""
    lines = ['// B站兜底数据（由 GitHub Actions 每日自动更新，真实排行榜视频，每类3个，随机展示1个，均可播放）']
    lines.append(f'// 最后更新: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    lines.append('const FALLBACK_BILI_VIDEOS = {')

    for cat_key, videos in all_data.items():
        lines.append(f'  {cat_key}: [')
        for v in videos:
            lines.append(
                f"    {{ bvid: '{v['bvid']}', title: '{v['title']}', author: '{v['author']}', "
                f"pic: '{v['pic']}', stats: {{ like: {v['stats']['like']}, reply: {v['stats']['reply']}, "
                f"favorite: {v['stats']['favorite']} }} }},"
            )
        lines.append('  ],')

    lines.append('};')
    return '\n'.join(lines)


def update_appjs(new_block):
    """替换 app.js 中的 FALLBACK_BILI_VIDEOS 块"""
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 匹配从注释行到 }; 的整个块
    pattern = r'// B站兜底数据.*?const FALLBACK_BILI_VIDEOS = \{.*?\};\n'
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        print('✗ 未找到 FALLBACK_BILI_VIDEOS 块', file=sys.stderr)
        return False

    new_content = content[:match.start()] + new_block + '\n' + content[match.end():]
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(new_content)

    print('✓ app.js 已更新')
    return True


def main():
    print('=== B站排行榜数据抓取 ===')
    print(f'时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')

    # 获取需要的 rid 数据（去重）
    rid_data = {}
    needed_rids = {c['rid'] for c in CATEGORIES.values()}
    for rid in needed_rids:
        print(f'获取 rid={rid} ...')
        rid_data[rid] = fetch_ranking(rid)

    # 为每个分类筛选 top N
    all_data = {}
    for cat_key, cfg in CATEGORIES.items():
        lst = rid_data.get(cfg['rid'], [])
        videos = pick_top_videos(lst, cfg['filterTname'])
        all_data[cat_key] = videos
        if videos:
            print(f'  {cat_key}: top1 = {videos[0]["title"][:40]}')

    # 生成 JS 代码并更新 app.js
    new_block = generate_js_block(all_data)
    success = update_appjs(new_block)

    if success:
        print('\n=== 完成 ===')
        # 输出摘要供 Actions 日志查看
        total = sum(len(v) for v in all_data.values())
        print(f'共更新 {len(all_data)} 个分类, {total} 个视频')
    else:
        print('\n=== 失败 ===', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
