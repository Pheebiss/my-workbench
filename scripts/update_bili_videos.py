#!/usr/bin/env python3
"""
B站 + 抖音 视频数据抓取脚本（多重降级版）
- B站：排行榜 API → 搜索 API → 热门 API → 保留旧数据
- 抖音：推荐流 API → 热搜榜 API → 保留旧数据
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
SEARCH_API = 'https://api.bilibili.com/x/web-interface/search/type'
POPULAR_API = 'https://api.bilibili.com/x/web-interface/popular'

BILI_CATEGORIES = {
    'beauty':  {'rid': 155, 'filterTname': ['美妆护肤', '仿妆cos'], 'search_kw': '美妆'},
    'fashion': {'rid': 155, 'filterTname': ['穿搭'], 'search_kw': '穿搭'},
    'game':    {'rid': 4,   'filterTname': None, 'search_kw': '游戏'},
    'travel':  {'rid': 0,   'filterTname': ['出行'], 'search_kw': '旅行'},
    'general': {'rid': 0,   'filterTname': None, 'search_kw': '热门'},
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


# ==================== B站 多重降级 ====================

def fetch_bili_ranking(rid):
    """方法①：排行榜 API"""
    try:
        url = f'{RANKING_API}?rid={rid}&type=all'
        resp = requests.get(url, headers=BILI_HEADERS, timeout=15)
        data = resp.json()
        if data.get('code') == 0 and data.get('data', {}).get('list'):
            lst = data['data']['list']
            print(f'  ✓ [排行榜] rid={rid}: {len(lst)} videos')
            return lst
        print(f'  ✗ [排行榜] rid={rid}: code={data.get("code")}', file=sys.stderr)
    except Exception as e:
        print(f'  ✗ [排行榜] rid={rid}: {e}', file=sys.stderr)
    return []


def fetch_bili_search(keyword, page=1):
    """方法②：搜索 API（按关键词搜索，风控较松）"""
    try:
        params = {
            'keyword': keyword,
            'search_type': 'video',
            'order': 'totalrank',
            'page': str(page),
        }
        resp = requests.get(SEARCH_API, params=params, headers=BILI_HEADERS, timeout=15)
        data = resp.json()
        if data.get('code') == 0 and data.get('data', {}).get('result'):
            results = data['data']['result']
            # 转换为排行榜一致的格式
            lst = []
            for v in results:
                stat = v.get('stat', {})
                # stat 可能是字符串 "123" 或数字
                def parse_stat(s, key):
                    if isinstance(s, dict):
                        return s.get(key, 0)
                    return 0
                lst.append({
                    'bvid': v.get('bvid', ''),
                    'title': re.sub(r'<[^>]+>', '', v.get('title', '')),  # 去除高亮标签
                    'pic': (v.get('pic') or '').replace('http:', 'https:'),
                    'owner': {'name': v.get('author', '')},
                    'tname': v.get('typename', ''),
                    'stat': {
                        'like': parse_stat(stat, 'like'),
                        'reply': parse_stat(stat, 'reply'),
                        'favorite': parse_stat(stat, 'favorite'),
                        'view': v.get('play', 0),
                    }
                })
            print(f'  ✓ [搜索] kw="{keyword}": {len(lst)} videos')
            return lst
        print(f'  ✗ [搜索] kw="{keyword}": code={data.get("code")}', file=sys.stderr)
    except Exception as e:
        print(f'  ✗ [搜索] kw="{keyword}": {e}', file=sys.stderr)
    return []


def fetch_bili_popular():
    """方法③：热门 API（全站热门，无需分类参数）"""
    try:
        resp = requests.get(POPULAR_API, params={'pn': 1, 'ps': 50}, headers=BILI_HEADERS, timeout=15)
        data = resp.json()
        if data.get('code') == 0 and data.get('data', {}).get('list'):
            lst = data['data']['list']
            print(f'  ✓ [热门]: {len(lst)} videos')
            return lst
        print(f'  ✗ [热门]: code={data.get("code")}', file=sys.stderr)
    except Exception as e:
        print(f'  ✗ [热门]: {e}', file=sys.stderr)
    return []


def pick_bili_videos(lst, filter_tname, n=TOP_N):
    """按热度筛选并排序，取 top N"""
    if not lst:
        return []
    if filter_tname:
        candidates = [v for v in lst if any(t in (v.get('tname') or '') for t in filter_tname)]
    else:
        candidates = lst[:]
    if not candidates:
        candidates = lst[:]

    candidates.sort(
        key=lambda v: (v.get('stat', {}).get('like', 0) + v.get('stat', {}).get('reply', 0) + v.get('stat', {}).get('favorite', 0)),
        reverse=True
    )

    result = []
    for v in candidates[:n]:
        stat = v.get('stat', {})
        result.append({
            'bvid': v.get('bvid', ''),
            'title': safe_str(v.get('title', '')),
            'author': safe_str(v.get('owner', {}).get('name', '') if isinstance(v.get('owner'), dict) else str(v.get('owner', ''))),
            'pic': (v.get('pic') or '').replace('http:', 'https:'),
            'stats': {
                'like': stat.get('like', 0),
                'reply': stat.get('reply', 0),
                'favorite': stat.get('favorite', 0),
            }
        })
    return result


def fetch_bili_videos_multilevel():
    """B站多重降级获取：排行榜 → 搜索 → 热门 → 保留旧数据"""
    bili_data = {}

    # 方法①：排行榜 API（按 rid 获取）
    print('  --- 方法①：排行榜 API ---')
    rid_data = {}
    needed_rids = {c['rid'] for c in BILI_CATEGORIES.values()}
    for rid in needed_rids:
        rid_data[rid] = fetch_bili_ranking(rid)

    for cat_key, cfg in BILI_CATEGORIES.items():
        lst = rid_data.get(cfg['rid'], [])
        bili_data[cat_key] = pick_bili_videos(lst, cfg['filterTname'])
        if bili_data[cat_key]:
            print(f'  B站 {cat_key}: [排行榜] top1 = {bili_data[cat_key][0]["title"][:40]}')

    # 方法②：对空分类用搜索 API
    empty_cats = [k for k, v in bili_data.items() if not v]
    if empty_cats:
        print(f'  --- 方法②：搜索 API（{len(empty_cats)} 个分类需要） ---')
        for cat_key in empty_cats:
            cfg = BILI_CATEGORIES[cat_key]
            lst = fetch_bili_search(cfg['search_kw'])
            bili_data[cat_key] = pick_bili_videos(lst, None)
            if bili_data[cat_key]:
                print(f'  B站 {cat_key}: [搜索] top1 = {bili_data[cat_key][0]["title"][:40]}')

    # 方法③：对仍为空的分类用热门 API（不区分分类，取全站热门）
    empty_cats = [k for k, v in bili_data.items() if not v]
    if empty_cats:
        print(f'  --- 方法③：热门 API（{len(empty_cats)} 个分类需要） ---')
        popular_lst = fetch_bili_popular()
        for cat_key in empty_cats:
            bili_data[cat_key] = pick_bili_videos(popular_lst, None)
            if bili_data[cat_key]:
                print(f'  B站 {cat_key}: [热门] top1 = {bili_data[cat_key][0]["title"][:40]}')

    return bili_data


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


# ==================== 抖音 多重降级 ====================

def fetch_douyin_feed(count=20):
    """方法①：推荐流 API"""
    try:
        resp = requests.get('https://api.amemv.com/aweme/v1/feed/',
            params={'count': str(count), 'type': '0'},
            headers={'User-Agent': DOUYIN_UA},
            timeout=10)
        d = resp.json()
        lst = d.get('aweme_list', [])
        if lst:
            print(f'  ✓ [推荐流]: {len(lst)} videos')
        else:
            print(f'  ✗ [推荐流]: empty', file=sys.stderr)
        return lst
    except Exception as e:
        print(f'  ✗ [推荐流]: {e}', file=sys.stderr)
        return []


def fetch_douyin_hot():
    """方法②：抖音热搜榜 API"""
    try:
        # 抖音热搜榜（网页版 API，风控较松）
        resp = requests.get('https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/',
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'},
            timeout=10)
        d = resp.json()
        words = d.get('word_list', [])
        if words:
            print(f'  ✓ [热搜榜]: {len(words)} 条热搜')
        # 转换为类似视频列表格式（热搜本身不是视频，但可以用来辅助分类）
        # 热搜榜只有文字，无法直接获取视频 ID，所以这里作为辅助标记
        return []
    except Exception as e:
        print(f'  ✗ [热搜榜]: {e}', file=sys.stderr)
        return []


def fetch_douyin_feed_multilevel(max_fetch=200):
    """抖音多重降级获取：推荐流 → 热搜榜辅助"""
    all_videos = []

    # 方法①：推荐流（多次请求）
    print('  --- 方法①：推荐流 API ---')
    for i in range(max_fetch // 20):
        try:
            awl = fetch_douyin_feed(20)
            if awl:
                all_videos.extend(awl)
                time.sleep(0.3)
            else:
                break  # 推荐流返回空，停止重试
        except:
            break

    if all_videos:
        # 去重
        seen = set()
        unique = []
        for v in all_videos:
            aid = v.get('aweme_id', '')
            if aid and aid not in seen:
                seen.add(aid)
                unique.append(v)
        print(f'  ✓ [推荐流] 去重后: {len(unique)} 个唯一视频')
        return unique

    # 方法②：热搜榜（辅助，不一定能拿到视频）
    print('  --- 方法②：热搜榜 API ---')
    fetch_douyin_hot()

    return []


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


def preserve_old_bili_data(bili_data):
    """从旧 app.js 读取保留 B站旧数据"""
    print('  --- 方法④：保留旧数据 ---')
    with open('app.js', 'r', encoding='utf-8') as f:
        old_content = f.read()
    old_match = re.search(r'const FALLBACK_BILI_VIDEOS = \{(.+?)\};', old_content, re.DOTALL)
    if old_match:
        for cat in bili_data:
            if not bili_data[cat]:
                cat_pattern = rf"{cat}:\s*\[(.+?)\],"
                cat_match = re.search(cat_pattern, old_match.group(1), re.DOTALL)
                if cat_match:
                    old_items = re.findall(r"\{[^}]+bvid: '([^']+)'[^}]+title: '([^']*)'[^}]+author: '([^']*)'[^}]+pic: '([^']*)'[^}]+like: (\d+)[^}]+reply: (\d+)[^}]+favorite: (\d+)[^}]*\}", cat_match.group(1))
                    bili_data[cat] = [{
                        'bvid': m[0], 'title': m[1], 'author': m[2], 'pic': m[3],
                        'stats': {'like': int(m[4]), 'reply': int(m[5]), 'favorite': int(m[6])}
                    } for m in old_items]
                    print(f'  B站 {cat}: 保留原有 {len(bili_data[cat])} 个视频')
                else:
                    print(f'  ⚠ B站 {cat} 无旧数据可保留')


def preserve_old_douyin_data(dy_data):
    """从旧 app.js 读取保留抖音旧数据"""
    print('  --- 保留旧数据 ---')
    with open('app.js', 'r', encoding='utf-8') as f:
        old_content = f.read()
    old_match = re.search(r'const FALLBACK_DOUYIN_VIDEOS = \{(.+?)\};', old_content, re.DOTALL)
    if old_match:
        for cat in dy_data:
            if not dy_data[cat]:
                cat_pattern = rf"{cat}:\s*\[(.+?)\],"
                cat_match = re.search(cat_pattern, old_match.group(1), re.DOTALL)
                if cat_match:
                    old_items = re.findall(r"\{[^}]+vid: '([^']+)'[^}]+title: '([^']*)'[^}]+author: '([^']*)'[^}]+like: (\d+)[^}]+reply: (\d+)[^}]+favorite: (\d+)[^}]*\}", cat_match.group(1))
                    dy_data[cat] = [{
                        'vid': m[0], 'title': m[1], 'author': m[2],
                        'like': int(m[3]), 'comment': int(m[4]), 'share': int(m[5])
                    } for m in old_items]
                    print(f'  抖音 {cat}: 保留原有 {len(dy_data[cat])} 个视频')
                else:
                    print(f'  ⚠ 抖音 {cat} 无旧数据可保留')


def main():
    print('=== B站 + 抖音 视频数据抓取（多重降级） ===')
    print(f'时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')

    # --- B站（排行榜 → 搜索 → 热门 → 旧数据） ---
    print('\n--- B站 ---')
    bili_data = fetch_bili_videos_multilevel()

    # 方法④：对仍为空的分类保留旧数据
    if any(not v for v in bili_data.values()):
        preserve_old_bili_data(bili_data)

    bili_js = generate_bili_js(bili_data)
    bili_ok = update_appjs_block(bili_js, 'B站兜底数据')
    if bili_ok:
        print('✓ B站数据已更新')

    # --- 抖音（推荐流 → 热搜榜 → 旧数据） ---
    print('\n--- 抖音 ---')
    dy_videos = fetch_douyin_feed_multilevel(200)

    if dy_videos:
        dy_data = categorize_douyin(dy_videos)
    else:
        print('  ⚠ 推荐流获取失败，所有分类保留旧数据')
        dy_data = {cat: [] for cat in DOUYIN_KEYWORDS}
        dy_data['general'] = []

    # 保留旧数据
    if any(not v for v in dy_data.values()):
        preserve_old_douyin_data(dy_data)

    dy_js = generate_douyin_js(dy_data)
    dy_ok = update_appjs_block(dy_js, '抖音兜底数据')
    if dy_ok:
        print('✓ 抖音数据已更新')

    # --- 汇总 ---
    print('\n=== 完成 ===')
    bili_total = sum(len(v) for v in bili_data.values())
    print(f'B站: {len(bili_data)} 分类, {bili_total} 视频')
    dy_total = sum(len(v) for v in dy_data.values())
    print(f'抖音: {len(dy_data)} 分类, {dy_total} 视频')


if __name__ == '__main__':
    main()
