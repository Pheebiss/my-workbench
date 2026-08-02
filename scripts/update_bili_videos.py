#!/usr/bin/env python3
"""
B站 + 抖音 视频数据抓取脚本
- B站：从排行榜 API 获取最新排行榜数据，按热度排序取 top3
- 抖音：从 feed API 获取推荐视频 + 热搜榜，按热度排序取 top3
更新 app.js 中的 FALLBACK_BILI_VIDEOS 和 FALLBACK_DOUYIN_VIDEOS
"""

import requests
import json
import re
import sys
import time
from datetime import datetime

BILI_HEADERS = {
    'Referer': 'https://www.bilibili.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

DOUYIN_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

RANKING_API = 'https://api.bilibili.com/x/web-interface/ranking/v2'

BILI_CATEGORIES = {
    'beauty':  {'rid': 155, 'filterTname': ['美妆护肤', '仿妆cos']},
    'fashion': {'rid': 155, 'filterTname': ['穿搭']},
    'game':    {'rid': 4,   'filterTname': None},
    'travel':  {'rid': 0,   'filterTname': ['出行']},
    'general': {'rid': 0,   'filterTname': None},
}

DOUYIN_KEYWORDS = {
    'beauty':  ['美妆', '化妆', '口红', '妆容', '护肤', '仿妆', '粉底', '眼影', '睫毛', '腮红', '变美', '颜值'],
    'fashion': ['穿搭', '搭配', 'ootd', '时尚', '服装', '裙子', '卫衣', '外套', '显瘦'],
    'game':    ['游戏', '电竞', '手游', '端游', '王者', '原神', '吃鸡', '无畏契约', '英雄联盟', '黑神话', 'ps5', 'switch'],
    'travel':  ['旅游', '旅行', 'vlog', '打卡', '风景', '出行', '游记', '自驾', '古镇', '攻略'],
}

TOP_N = 3


def safe_str(s):
    """转义单引号和反斜杠"""
    if not s:
        return ''
    return s.replace('\\', '').replace("'", '').replace('\n', ' ').strip()


# ==================== B站 ====================

def fetch_bili_ranking(rid):
    """获取 B站排行榜数据"""
    url = f'{RANKING_API}?rid={rid}&type=all'
    resp = requests.get(url, headers=BILI_HEADERS, timeout=15)
    data = resp.json()
    if data['code'] != 0:
        print(f'  ✗ B站 rid={rid} API error: {data["code"]}', file=sys.stderr)
        return []
    lst = data['data']['list']
    print(f'  ✓ B站 rid={rid}: {len(lst)} videos')
    return lst


def pick_bili_videos(lst, filter_tname, n=TOP_N):
    """按热度筛选并排序，取 top N"""
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
            'title': safe_str(v['title']),
            'author': safe_str(v['owner']['name']),
            'pic': (v.get('pic') or '').replace('http:', 'https:'),
            'stats': {
                'like': v['stat']['like'],
                'reply': v['stat']['reply'],
                'favorite': v['stat']['favorite'],
            }
        })
    return result


def generate_bili_js(all_data):
    """生成 B站 JS 代码块"""
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


# ==================== 抖音 ====================

def fetch_douyin_feed(count=20):
    """获取抖音推荐流视频"""
    try:
        resp = requests.get('https://api.amemv.com/aweme/v1/feed/',
            params={'count': str(count), 'type': '0'},
            headers={'User-Agent': DOUYIN_UA},
            timeout=10)
        d = resp.json()
        return d.get('aweme_list', [])
    except Exception as e:
        print(f'  ✗ 抖音 feed 获取失败: {e}', file=sys.stderr)
        return []


def fetch_douyin_videos(max_fetch=200):
    """多次调用 feed API 获取大量视频"""
    all_videos = []
    for i in range(max_fetch // 20):
        try:
            awl = fetch_douyin_feed(20)
            all_videos.extend(awl)
            time.sleep(0.3)
        except:
            pass

    # 去重
    seen = set()
    unique = []
    for v in all_videos:
        aid = v.get('aweme_id', '')
        if aid and aid not in seen:
            seen.add(aid)
            unique.append(v)

    print(f'  ✓ 抖音 feed: {len(unique)} 个唯一视频')
    return unique


def categorize_douyin(videos):
    """按关键词分类抖音视频，按热度排序取 top N"""
    result = {}

    for cat, kws in DOUYIN_KEYWORDS.items():
        matched = []
        for v in videos:
            desc = (v.get('desc', '') + ' ' + v.get('author', {}).get('nickname', '')).lower()
            if any(kw.lower() in desc for kw in kws):
                stats = v.get('statistics', {})
                like = stats.get('digg_count', 0)
                comment = stats.get('comment_count', 0)
                share = stats.get('share_count', 0)
                matched.append({
                    'vid': v.get('aweme_id', ''),
                    'title': safe_str(v.get('desc', ''))[:60],
                    'author': safe_str(v.get('author', {}).get('nickname', '')),
                    'like': like,
                    'comment': comment,
                    'share': share,
                    'heatScore': like + comment * 5 + share * 3,
                })
        matched.sort(key=lambda x: x['heatScore'], reverse=True)
        result[cat] = matched[:TOP_N]
        print(f'  抖音 {cat}: {len(matched)} 匹配, top: {matched[0]["title"][:30] if matched else "无"}')

    # 综合分类 = 所有视频按热度排序
    general = []
    for v in videos:
        stats = v.get('statistics', {})
        like = stats.get('digg_count', 0)
        comment = stats.get('comment_count', 0)
        share = stats.get('share_count', 0)
        general.append({
            'vid': v.get('aweme_id', ''),
            'title': safe_str(v.get('desc', ''))[:60],
            'author': safe_str(v.get('author', {}).get('nickname', '')),
            'like': like,
            'comment': comment,
            'share': share,
            'heatScore': like + comment * 5 + share * 3,
        })
    general.sort(key=lambda x: x['heatScore'], reverse=True)
    result['general'] = general[:TOP_N]
    print(f'  抖音 general: top like={general[0]["like"] if general else 0}')

    return result


def generate_douyin_js(all_data):
    """生成抖音 JS 代码块"""
    lines = ['// 抖音兜底数据（由 GitHub Actions 每日自动更新，真实热门视频，每类3个，随机展示1个）']
    lines.append(f'// 最后更新: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    lines.append('const FALLBACK_DOUYIN_VIDEOS = {')

    for cat_key, videos in all_data.items():
        lines.append(f'  {cat_key}: [')
        for v in videos:
            lines.append(
                f"    {{ vid: '{v['vid']}', title: '{v['title']}', author: '{v['author']}', "
                f"stats: {{ like: {v['like']}, reply: {v['comment']}, favorite: {v['share']} }} }},"
            )
        lines.append('  ],')

    lines.append('};')
    return '\n'.join(lines)


# ==================== 更新 app.js ====================

def update_appjs_block(new_block, marker_comment):
    """替换 app.js 中的指定块"""
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 匹配从注释行到 }; 的整个块
    pattern = rf'// {re.escape(marker_comment)}.*?const \w+ = \{{.*?\}};\n'
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        print(f'✗ 未找到 {marker_comment} 块', file=sys.stderr)
        return False

    new_content = content[:match.start()] + new_block + '\n' + content[match.end():]
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(new_content)

    return True


def main():
    print('=== B站 + 抖音 视频数据抓取 ===')
    print(f'时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')

    # --- B站 ---
    print('\n--- B站排行榜 ---')
    rid_data = {}
    needed_rids = {c['rid'] for c in BILI_CATEGORIES.values()}
    for rid in needed_rids:
        print(f'获取 rid={rid} ...')
        rid_data[rid] = fetch_bili_ranking(rid)

    bili_data = {}
    for cat_key, cfg in BILI_CATEGORIES.items():
        lst = rid_data.get(cfg['rid'], [])
        bili_data[cat_key] = pick_bili_videos(lst, cfg['filterTname'])
        if bili_data[cat_key]:
            print(f'  B站 {cat_key}: top1 = {bili_data[cat_key][0]["title"][:40]}')

    bili_js = generate_bili_js(bili_data)
    bili_ok = update_appjs_block(bili_js, 'B站兜底数据')
    if bili_ok:
        print('✓ B站数据已更新')

    # 对空分类，从旧 app.js 读取原有数据保留（与抖音逻辑一致）
    if any(not v for v in bili_data.values()):
        print('⚠ 部分 B站分类为空，尝试保留旧数据...')
        with open('app.js', 'r', encoding='utf-8') as f:
            old_content = f.read()
        old_bili_match = re.search(r'const FALLBACK_BILI_VIDEOS = \{(.+?)\};', old_content, re.DOTALL)
        if old_bili_match:
            for cat in bili_data:
                if not bili_data[cat]:
                    cat_pattern = rf"{cat}:\s*\[(.+?)\],"
                    cat_match = re.search(cat_pattern, old_bili_match.group(1), re.DOTALL)
                    if cat_match:
                        old_items = re.findall(r"\{[^}]+bvid: '([^']+)'[^}]+title: '([^']*)'[^}]+author: '([^']*)'[^}]+pic: '([^']*)'[^}]+like: (\d+)[^}]+reply: (\d+)[^}]+favorite: (\d+)[^}]*\}", cat_match.group(1))
                        bili_data[cat] = [{
                            'bvid': m[0], 'title': m[1], 'author': m[2], 'pic': m[3],
                            'stats': {'like': int(m[4]), 'reply': int(m[5]), 'favorite': int(m[6])}
                        } for m in old_items]
                        print(f'  B站 {cat}: 保留原有 {len(bili_data[cat])} 个视频')
                    else:
                        print(f'  ⚠ B站 {cat} 无匹配且无旧数据')
            # 重新生成并写入
            bili_js = generate_bili_js(bili_data)
            bili_ok = update_appjs_block(bili_js, 'B站兜底数据')
            if bili_ok:
                print('✓ B站数据已更新（含保留的旧数据）')

    # --- 抖音 ---
    print('\n--- 抖音热门视频 ---')
    dy_videos = fetch_douyin_videos(200)
    if dy_videos:
        dy_data = categorize_douyin(dy_videos)

        # 对空分类，从 app.js 读取原有数据保留
        with open('app.js', 'r', encoding='utf-8') as f:
            old_content = f.read()
        old_dy_match = re.search(r'const FALLBACK_DOUYIN_VIDEOS = \{(.+?)\};', old_content, re.DOTALL)
        if old_dy_match:
            for cat in dy_data:
                if not dy_data[cat]:
                    # 从旧数据中提取该分类
                    cat_pattern = rf"{cat}:\s*\[(.+?)\],"
                    cat_match = re.search(cat_pattern, old_dy_match.group(1), re.DOTALL)
                    if cat_match:
                        old_items = re.findall(r"\{[^}]+vid: '([^']+)'[^}]+title: '([^']*)'[^}]+author: '([^']*)'[^}]+like: (\d+)[^}]+reply: (\d+)[^}]+favorite: (\d+)[^}]*\}", cat_match.group(1))
                        dy_data[cat] = [{
                            'vid': m[0], 'title': m[1], 'author': m[2],
                            'like': int(m[3]), 'comment': int(m[4]), 'share': int(m[5])
                        } for m in old_items]
                        print(f'  抖音 {cat}: 保留原有 {len(dy_data[cat])} 个视频')
                    else:
                        print(f'  ⚠ 抖音 {cat} 无匹配且无旧数据')

        dy_js = generate_douyin_js(dy_data)
        dy_ok = update_appjs_block(dy_js, '抖音兜底数据')
        if dy_ok:
            print('✓ 抖音数据已更新')
    else:
        print('⚠ 抖音 feed 获取失败，跳过更新')

    # --- 汇总 ---
    print('\n=== 完成 ===')
    bili_total = sum(len(v) for v in bili_data.values())
    print(f'B站: {len(bili_data)} 分类, {bili_total} 视频')
    if dy_videos:
        dy_total = sum(len(v) for v in dy_data.values())
        print(f'抖音: {len(dy_data)} 分类, {dy_total} 视频')


if __name__ == '__main__':
    main()
