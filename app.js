/* =========================================================================
 * 我的工作台 - 主应用脚本
 * 数据持久化：localStorage + IndexedDB（衣橱图片）
 * ========================================================================= */

/* ---------- 工具函数 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const Store = {
  get(key, def = null) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : def;
    } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { console.warn('localStorage 写入失败:', key, e); }
  },
};

const fmtDate = d => {
  const w = ['日','一','二','三','四','五','六'][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 星期${w}`;
};
const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

/* ---------- 安全工具 ---------- */
// HTML 转义（防止 XSS）
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// 属性转义（用于 HTML 属性值）
function escapeAttr(s) {
  return String(s).replace(/["'<>]/g, c => ({'"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[c]));
}
// URL 安全过滤（只允许 http/https 协议，防止 javascript: 注入）
function safeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^\//.test(trimmed)) return trimmed; // 相对路径
  return ''; // 其他协议（javascript:, data: 等）一律拒绝
}

/* ---------- API 超时/重试工具 ---------- */
// 带超时的 fetch
function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// 带重试的 fetch：默认最多 3 次，指数退避（0s, 1s, 2s）
async function fetchWithRetry(url, options = {}, { retries = 3, timeout = 5000, backoff = 1000 } = {}) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetchWithTimeout(url, options, timeout);
      if (res.ok) return res;
      // 4xx 客户端错误不重试
      if (res.status >= 400 && res.status < 500) return res;
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, backoff * i));
      }
    }
  }
  throw lastError;
}

/* ---------- 日期种子（公共函数，消除重复） ---------- */
function dailySeed(offset = 0) {
  const key = dateKey(new Date());
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed += key.charCodeAt(i) * (i + 1);
  return seed + offset;
}

/* ---------- 本地金句缓存池（API 失败时降级） ---------- */
const LOCAL_QUOTES = [
  { text: '今天永远是昨天死去的人所期待的明天', from: '每日金句' },
  { text: '种一棵树最好的时间是十年前，其次是现在', from: '谚语' },
  { text: '不积跬步，无以至千里；不积小流，无以成江海', from: '荀子·劝学' },
  { text: '千里之行，始于足下', from: '老子' },
  { text: '路漫漫其修远兮，吾将上下而求索', from: '屈原·离骚' },
  { text: '天行健，君子以自强不息', from: '周易' },
  { text: '宝剑锋从磨砺出，梅花香自苦寒来', from: '警世贤文' },
  { text: '业精于勤，荒于嬉；行成于思，毁于随', from: '韩愈' },
  { text: '一寸光阴一寸金，寸金难买寸光阴', from: '增广贤文' },
  { text: '黑发不知勤学早，白首方悔读书迟', from: '颜真卿' },
  { text: '勿以恶小而为之，勿以善小而不为', from: '刘备' },
  { text: '三人行，必有我师焉', from: '论语' },
  { text: '学而不思则罔，思而不学则殆', from: '论语' },
  { text: '知之者不如好之者，好之者不如乐之者', from: '论语' },
  { text: '己所不欲，勿施于人', from: '论语' },
  { text: '君子坦荡荡，小人长戚戚', from: '论语' },
  { text: '锲而不舍，金石可镂', from: '荀子·劝学' },
  { text: '纸上得来终觉浅，绝知此事要躬行', from: '陆游' },
  { text: '问渠那得清如许，为有源头活水来', from: '朱熹' },
  { text: '海纳百川，有容乃大；壁立千仞，无欲则刚', from: '林则徐' },
  { text: '会当凌绝顶，一览众山小', from: '杜甫·望岳' },
  { text: '长风破浪会有时，直挂云帆济沧海', from: '李白' },
  { text: '莫等闲，白了少年头，空悲切', from: '岳飞' },
  { text: '人生自古谁无死，留取丹心照汗青', from: '文天祥' },
  { text: '天下兴亡，匹夫有责', from: '顾炎武' },
  { text: '静以修身，俭以养德', from: '诸葛亮' },
  { text: '非淡泊无以明志，非宁静无以致远', from: '诸葛亮' },
  { text: '读万卷书，行万里路', from: '刘彝' },
  { text: '书山有路勤为径，学海无涯苦作舟', from: '韩愈' },
  { text: '百闻不如一见', from: '汉书' },
  { text: '失败是成功之母', from: '谚语' },
  { text: '世上无难事，只怕有心人', from: '谚语' },
  { text: '只要功夫深，铁杵磨成针', from: '谚语' },
  { text: '光阴似箭，日月如梭', from: '增广贤文' },
  { text: '少壮不努力，老大徒伤悲', from: '汉乐府·长歌行' },
  { text: '路是脚踏出来的，历史是人写出来的', from: '吉鸿昌' },
  { text: '每一条弯路，其实都是必经之路', from: '佚名' },
  { text: '你现在的气质里，藏着你走过的路、读过的书和爱过的人', from: '张爱玲' },
  { text: '生活不止眼前的苟且，还有诗和远方', from: '高晓松' },
  { text: '愿你历尽千帆，归来仍是少年', from: '苏轼' },
  { text: '心若向阳，无谓悲伤', from: '佚名' },
  { text: '所有努力都不会完全白费，你付出的时间和精力都是对未来的积累', from: '佚名' },
  { text: '世界上只有一种英雄主义，就是看清生活的真相之后依然热爱生活', from: '罗曼·罗兰' },
  { text: '我们都在阴沟里，但仍有人仰望星空', from: '王尔德' },
  { text: '当你为错过太阳而哭泣时，你也要再错过群星了', from: '泰戈尔' },
  { text: '一个人的价值，不在于他拥有什么，而在于他是什么', from: '佚名' },
  { text: '真正的平静，不是避开车马喧嚣，而是在心中修篱种菊', from: '林徽因' },
  { text: '每一个不曾起舞的日子，都是对生命的辜负', from: '尼采' },
  { text: '不管前方的路有多苦，只要走的方向正确，都比站在原地更接近幸福', from: '宫崎骏' },
  { text: '做你自己，因为别人都有人做了', from: '王尔德' },
];

/* ---------- 数据导出/导入 ---------- */
async function exportData() {
  const data = { _version: 1, _exportDate: new Date().toISOString(), localStorage: {}, indexedDB: {} };
  // 导出 localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    data.localStorage[k] = localStorage.getItem(k);
  }
  // 导出 IndexedDB 图片
  try {
    const db = await ImageDB.init();
    const tx = db.transaction('images', 'readonly');
    const store = tx.objectStore('images');
    const allKeys = await new Promise((res, rej) => {
      const r = store.getAllKeys(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    for (const key of allKeys) {
      const val = await new Promise((res, rej) => {
        const r = store.get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
      data.indexedDB[key] = val;
    }
  } catch (e) { console.warn('IndexedDB 导出失败:', e); }
  // 下载
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workbench-backup-${dateKey(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  wdToast('数据已导出');
}

async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data._version || !data.localStorage) { wdToast('文件格式不正确'); return; }
    // 导入 localStorage
    for (const [k, v] of Object.entries(data.localStorage)) {
      localStorage.setItem(k, v);
    }
    // 导入 IndexedDB
    if (data.indexedDB) {
      for (const [k, v] of Object.entries(data.indexedDB)) {
        await ImageDB.set(k, v);
      }
    }
    wdToast('数据已导入，即将刷新…');
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    wdToast('导入失败：' + e.message);
  }
}

/* ---------- 设置面板 ---------- */
function openSettings() {
  const currentTheme = Store.get('theme', 'auto');
  showModal('设置', `
    <div class="settings-panel">
      <div class="settings-section">
        <div class="settings-section-title">🎨 外观主题</div>
        <div class="settings-section-desc">选择浅色/深色/跟随系统主题。</div>
        <div class="settings-actions theme-switcher">
          <button class="theme-btn ${currentTheme==='light'?'active':''}" onclick="setTheme('light')">☀️ 浅色</button>
          <button class="theme-btn ${currentTheme==='dark'?'active':''}" onclick="setTheme('dark')">🌙 深色</button>
          <button class="theme-btn ${currentTheme==='auto'?'active':''}" onclick="setTheme('auto')">🖥️ 跟随系统</button>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">📦 数据备份</div>
        <div class="settings-section-desc">将所有数据（待办、衣橱、经期记录、学习进度等）导出为 JSON 文件，保存到本地。</div>
        <div class="settings-actions">
          <button class="btn" onclick="exportData()">导出数据</button>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">📥 数据恢复</div>
        <div class="settings-section-desc">从之前导出的 JSON 文件恢复数据。注意：导入会覆盖当前数据。</div>
        <div class="settings-actions">
          <button class="btn btn-soft" onclick="document.getElementById('importFileInput').click()">选择文件导入</button>
          <input type="file" id="importFileInput" accept=".json" hidden onchange="importData(this.files[0])" />
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">👤 个人设置</div>
        <div class="settings-section-desc">自定义昵称，将显示在首页问候语中。</div>
        <div class="settings-actions">
          <input class="input" id="nicknameInput" placeholder="输入昵称" value="${escapeAttr(Store.get('user_nickname', 'OnePiece'))}" style="flex:1;max-width:200px;" />
          <button class="btn btn-soft" onclick="saveNickname()">保存</button>
        </div>
      </div>
    </div>
  `);
}
function saveNickname() {
  const v = $('#nicknameInput')?.value.trim() || 'OnePiece';
  Store.set('user_nickname', v);
  wdToast('昵称已保存');
}

/* ---------- 主题切换 ---------- */
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    // auto: 移除手动设置的 data-theme，交给 CSS @media 处理
    document.documentElement.removeAttribute('data-theme');
  }
}
function setTheme(theme) {
  Store.set('theme', theme);
  applyTheme(theme);
  // 更新设置面板中的按钮高亮
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const map = { light: 0, dark: 1, auto: 2 };
  const btns = document.querySelectorAll('.theme-btn');
  if (btns[map[theme]]) btns[map[theme]].classList.add('active');
  wdToast(theme === 'dark' ? '已切换至深色模式' : theme === 'light' ? '已切换至浅色模式' : '已跟随系统主题');
}

/* ---------- IndexedDB 封装（衣橱图片存储，突破 5MB 限制） ---------- */
const ImageDB = {
  _db: null,
  async init() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('workbench_images', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images');
        }
      };
      req.onsuccess = e => { this._db = e.target.result; resolve(this._db); };
      req.onerror = e => reject(e.target.error);
    });
  },
  async set(key, dataUrl) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put(dataUrl, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = e => reject(e.target.error);
    });
  },
  async get(key) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readonly');
      const req = tx.objectStore('images').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = e => reject(e.target.error);
    });
  },
  async del(key) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = e => reject(e.target.error);
    });
  },
};

// 将图片存入 IndexedDB，返回引用 key（img:xxx）
async function saveImgToIDB(clothId, dataUrl) {
  await ImageDB.set(clothId, dataUrl);
  return 'img:' + clothId;
}

// 解析图片引用：idb key → dataURL；旧数据 base64 → 原样返回
async function resolveImg(src) {
  if (!src) return '';
  if (src.startsWith('img:')) {
    const key = src.slice(4);
    const data = await ImageDB.get(key);
    return data || ''; // 取不到返回空
  }
  return src; // 旧的 base64 直接返回
}

// 批量异步填充图片到 DOM 元素
async function fillImgs(entries) {
  // entries: [{ el, src }] —— el 是 DOM 元素，src 是原始引用
  await Promise.all(entries.map(async ({ el, src }) => {
    if (!el) return;
    const url = await resolveImg(src);
    if (url) {
      if (el.tagName === 'IMG') el.src = url;
      else el.style.backgroundImage = `url('${url}')`;
    }
  }));
}

// 迁移旧数据：把 localStorage 中衣物的 base64 图片迁移到 IndexedDB
async function migrateClothesImagesIfNeeded() {
  const arr = getClothesRaw();
  let migrated = false;
  for (const c of arr) {
    if (c.img && !c.img.startsWith('img:')) {
      // 旧 base64 数据，迁移
      try {
        const newImg = await saveImgToIDB(c.id, c.img);
        c.img = newImg;
        migrated = true;
      } catch (e) { /* 迁移失败保留旧数据 */ }
    }
  }
  if (migrated) {
    try { localStorage.setItem('wardrobe_items', JSON.stringify(arr)); } catch (e) { console.warn('衣橱数据保存失败:', e); }
  }
}

/* ---------- 模块配置 ---------- */
const MODULES = [
  { id: 'home',     icon: '🏠', label: '首页' },
  { id: 'daily',    icon: '✅', label: '每日打卡' },
  { id: 'headline', icon: '📰', label: '今日头条' },
  { id: 'wardrobe', icon: '👗', label: '电子衣橱' },
  { id: 'fun',      icon: '🎬', label: '休闲娱乐' },
  { id: 'meal',     icon: '🍱', label: '均衡膳食' },
  { id: 'period',   icon: '🌸', label: '经期记录' },
  { id: 'piano',    icon: '🎹', label: '钢琴学习' },
  { id: 'chess',    icon: '♟️', label: '象棋学习' },
  { id: 'calli',    icon: '✒️', label: '行楷书法' },
  { id: 'sketch',   icon: '✏️', label: '素描学习' },
  { id: 'dance',    icon: '💃', label: '舞蹈学习' },
  { id: 'sew',      icon: '✂️', label: '裁剪学习' },
  { id: 'stats',    icon: '📊', label: '数据统计' },
];

const LEARN_DATA = {
  piano: {
    name: '钢琴学习',
    phases: [
      { title: '第一阶段·基础入门', tasks: [
        { t: '认识钢琴键盘与中央C', v: 'https://www.bilibili.com/video/BV1iQgx6fExP' },
        { t: '正确坐姿与手型', v: 'https://www.bilibili.com/video/BV1m5g96ZECi' },
        { t: '学习五线谱基础', v: 'https://www.bilibili.com/video/BV1q541117jq' },
        { t: '练习右手单音弹奏', v: 'https://www.bilibili.com/video/BV1yErjYFEWv' },
      ]},
      { title: '第二阶段·节奏训练', tasks: [
        { t: '学习四分、八分音符', v: 'https://www.bilibili.com/video/BV1tx3C6eEb2' },
        { t: '节拍器配合练习', v: 'https://www.bilibili.com/video/BV1EP4y1g7tz' },
        { t: '《小星星》完整弹奏', v: 'https://www.bilibili.com/video/BV1dNebzGEmy' },
      ]},
      { title: '第三阶段·双手协调', tasks: [
        { t: '左手和弦伴奏练习', v: 'https://www.bilibili.com/video/BV1b1Ec6KEEr' },
        { t: '《欢乐颂》双手弹奏', v: 'https://www.bilibili.com/video/BV19K3j6YENh' },
        { t: '简单指法转换训练', v: 'https://www.bilibili.com/video/BV1Zy3E65EYw' },
      ]},
    ],
  },
  chess: {
    name: '象棋学习',
    phases: [
      { title: '第一阶段·认识棋盘', tasks: [
        { t: '棋盘各线与九宫认识', v: 'https://www.bilibili.com/video/BV1da411S7Vf' },
        { t: '各棋子走法：车马炮', v: 'https://www.bilibili.com/video/BV1LgFrzoEg7' },
        { t: '各棋子走法：相士帅', v: 'https://www.bilibili.com/video/BV1da411S7Vf' },
        { t: '兵卒规则与过河', v: 'https://www.bilibili.com/video/BV1Lwgk6ME9B' },
      ]},
      { title: '第二阶段·基本杀法', tasks: [
        { t: '马后炮杀法', v: 'https://www.bilibili.com/video/BV1XMwjebEaN' },
        { t: '双将杀与闷杀', v: 'https://www.bilibili.com/video/BV1d4M2zfEtQ' },
        { t: '铁门栓杀法', v: 'https://www.bilibili.com/video/BV16A336FEtb' },
      ]},
      { title: '第三阶段·开局原理', tasks: [
        { t: '中炮开局学习', v: 'https://www.bilibili.com/video/BV1LgFrzoEg7' },
        { t: '屏风马应对', v: 'https://www.bilibili.com/video/BV11RijBjEyH' },
        { t: '仙人指路开局', v: 'https://www.bilibili.com/video/BV1da411S7Vf' },
      ]},
    ],
  },
  calli: {
    name: '行楷书法',
    phases: [
      { title: '第一阶段·用笔基础', tasks: [
        { t: '毛笔/钢笔执笔姿势', v: 'https://www.bilibili.com/video/BV1w6K2zPEKK' },
        { t: '中锋与侧锋练习', v: 'https://www.bilibili.com/video/BV15eKn6AENL' },
        { t: '基本笔画：横竖撇捺', v: 'https://www.bilibili.com/video/BV1Vq4y177yv' },
      ]},
      { title: '第二阶段·行楷笔法', tasks: [
        { t: '连笔与牵丝练习', v: 'https://www.bilibili.com/video/BV1P84y197c1' },
        { t: '偏旁部首写法', v: 'https://www.bilibili.com/video/BV1fRNwerEo8' },
        { t: '常用字结构训练', v: 'https://www.bilibili.com/video/BV1Xjgq6pEr6' },
      ]},
      { title: '第三阶段·篇章练习', tasks: [
        { t: '临摹《兰亭序》片段', v: 'https://www.bilibili.com/video/BV1oE411b7mq' },
        { t: '行楷作品创作', v: 'https://www.bilibili.com/video/BV1rsgQ6VEDQ' },
      ]},
    ],
  },
  sketch: {
    name: '素描学习',
    phases: [
      { title: '第一阶段·线条与透视', tasks: [
        { t: '排线练习：横竖斜', v: 'https://www.bilibili.com/video/BV1CZ4y167KC' },
        { t: '一点透视原理', v: 'https://www.bilibili.com/video/BV1vN411Q7G8' },
        { t: '两点透视原理', v: 'https://www.bilibili.com/video/BV1Ce3u6cENT' },
      ]},
      { title: '第二阶段·明暗关系', tasks: [
        { t: '三大面五调子', v: 'https://www.bilibili.com/video/BV1xA366XECT' },
        { t: '球体明暗素描', v: 'https://www.bilibili.com/video/BV17Z421n78T' },
        { t: '正方体明暗素描', v: 'https://www.bilibili.com/video/BV1vK4y1j7iD' },
      ]},
      { title: '第三阶段·静物组合', tasks: [
        { t: '单体静物：苹果', v: 'https://www.bilibili.com/video/BV1nT4y1o74P' },
        { t: '组合静物写生', v: 'https://www.bilibili.com/video/BV1htgD6pExW' },
        { t: '质感表现练习', v: 'https://www.bilibili.com/video/BV1ef4y1F7n1' },
      ]},
    ],
  },
  dance: {
    name: '舞蹈学习',
    phases: [
      { title: '第一阶段·基本功', tasks: [
        { t: '热身与软开度训练', v: 'https://www.bilibili.com/video/BV1Xg4y147Jy' },
        { t: '下腰与压腿', v: 'https://www.bilibili.com/video/BV1fh411R79j' },
        { t: '基本手位与脚位', v: 'https://www.bilibili.com/video/BV1u98CzcEKE' },
      ]},
      { title: '第二阶段·身韵训练', tasks: [
        { t: '提、沉、冲、靠', v: 'https://www.bilibili.com/video/BV1ruckzgEbW' },
        { t: '云手与风火轮', v: 'https://www.bilibili.com/video/BV1XxVEzsEN2' },
        { t: '圆场步练习', v: 'https://www.bilibili.com/video/BV1NE411r7KS' },
      ]},
      { title: '第三阶段·剧目片段', tasks: [
        { t: '学习扇子舞片段', v: 'https://www.bilibili.com/video/BV1Qz411e7EV' },
        { t: '水袖基本动作', v: 'https://www.bilibili.com/video/BV1KgEcz3ELJ' },
        { t: '完整剧目跟练', v: 'https://www.bilibili.com/video/BV1Zs421K7um' },
      ]},
    ],
  },
  sew: {
    name: '裁剪学习',
    phases: [
      { title: '第一阶段·工具与针法', tasks: [
        { t: '认识缝纫工具与布料', v: 'https://www.bilibili.com/video/BV12z4y1X7mL' },
        { t: '平针缝与回针缝', v: 'https://www.bilibili.com/video/BV1ii4y177yF' },
        { t: '锁边缝与藏针缝', v: 'https://www.bilibili.com/video/BV11k4y1g7cE' },
      ]},
      { title: '第二阶段·量体与制版', tasks: [
        { t: '人体测量方法', v: 'https://www.bilibili.com/video/BV1QK411p7Xd' },
        { t: '基础裙装制版', v: 'https://www.bilibili.com/video/BV1Vi3c6oEZ2' },
        { t: '纸样转印到布料', v: 'https://www.bilibili.com/video/BV1jcg96BEqb' },
      ]},
      { title: '第三阶段·成衣制作', tasks: [
        { t: '缝制简易束口袋', v: 'https://www.bilibili.com/video/BV1uL4y1p7BY' },
        { t: '半身裙缝制', v: 'https://www.bilibili.com/video/BV1s7411W79Y' },
        { t: '缝纫机使用入门', v: 'https://www.bilibili.com/video/BV1LL4y1G7Ph' },
      ]},
    ],
  },
};

/* ========== 电子衣橱枚举常量 ========== */
const CAT_LABELS = { top:'上装', bottom:'下装', onesie:'连身装', outerwear:'外套', shoes:'鞋履', accessory:'配饰' };
const COLOR_LABELS = { white:'白色', black:'黑色', gray:'灰色', red:'红色', pink:'粉色', orange:'橙色', yellow:'黄色', green:'绿色', blue:'蓝色', purple:'紫色', brown:'棕色', multicolor:'花色' };
const COLOR_SWATCHES = { white:'#ffffff', black:'#3a3a3a', gray:'#b0b0b0', red:'#d68a8a', pink:'#f0bfc4', orange:'#e8b89d', yellow:'#e6d08a', green:'#b8c6a8', blue:'#9ab8c8', purple:'#b8a0c8', brown:'#b89878', multicolor:'linear-gradient(135deg,#f0bfc4,#e8b89d,#b8c6a8,#9ab8c8)' };
const SEASON_LABELS = { spring:'春', summer:'夏', autumn:'秋', winter:'冬' };
const STYLE_LABELS = { casual:'休闲', formal:'正式', sporty:'运动', sweet:'甜美', vintage:'复古', minimal:'极简' };
const COLOR_HARMONY = {
  white:['white','black','gray','red','pink','orange','yellow','green','blue','purple','brown','multicolor'],
  black:['white','black','gray','red','pink','orange','yellow','green','blue','purple','brown','multicolor'],
  gray:['white','black','gray','red','pink','orange','yellow','green','blue','purple','brown','multicolor'],
  red:['white','black','gray','red','orange','brown','pink'],
  orange:['white','black','gray','orange','yellow','brown','green'],
  yellow:['white','black','gray','yellow','orange','green','blue'],
  pink:['white','black','gray','pink','red','purple'],
  brown:['white','black','gray','brown','orange','yellow','green'],
  blue:['white','black','gray','blue','green','purple','yellow'],
  green:['white','black','gray','green','blue','yellow','brown','orange'],
  purple:['white','black','gray','purple','pink','blue'],
  multicolor:['white','black','gray'],
};

const MEAL_GRADS = {
  warm:   ['#ffd6a5','#caffbf'],
  red:    ['#ff9a9e','#fad0c4'],
  purple: ['#a18cd1','#fbc2eb'],
  green:  ['#84fab0','#8fd3f4'],
  blue:   ['#e0c3fc','#8ec5fc'],
  orange: ['#fccb90','#d57eeb'],
  pink:   ['#ffecd2','#fcb69f'],
  mint:   ['#a8edea','#fed6e3'],
};
const MG = MEAL_GRADS;

const MEALS = [
  // ===== 早餐 35 道 =====
  { name: '燕麦牛奶杯', cal: '约 250 千卡', desc: '高纤维燕麦搭配牛奶，饱腹持久。', grad: MG.warm, meal: 'breakfast' },
  { name: '全麦三明治', cal: '约 320 千卡', desc: '全麦面包夹蛋生菜，营养均衡。', grad: MG.red, meal: 'breakfast' },
  { name: '小米南瓜粥', cal: '约 180 千卡', desc: '暖胃养胃，低卡好消化。', grad: MG.orange, meal: 'breakfast' },
  { name: '紫薯豆浆', cal: '约 220 千卡', desc: '花青素加植物蛋白，抗氧化。', grad: MG.purple, meal: 'breakfast' },
  { name: '鸡蛋蔬菜卷饼', cal: '约 280 千卡', desc: '蛋白质加膳食纤维，方便快手。', grad: MG.green, meal: 'breakfast' },
  { name: '玉米虾仁粥', cal: '约 240 千卡', desc: '鲜虾优质蛋白，玉米甜香。', grad: MG.blue, meal: 'breakfast' },
  { name: '酸奶水果碗', cal: '约 200 千卡', desc: '益生菌加维生素，清爽开胃。', grad: MG.pink, meal: 'breakfast' },
  { name: '红豆薏米粥', cal: '约 190 千卡', desc: '祛湿消肿，经典养颜粥品。', grad: MG.red, meal: 'breakfast' },
  { name: '全麦贝果', cal: '约 260 千卡', desc: '低脂低糖，搭配奶油芝士。', grad: MG.warm, meal: 'breakfast' },
  { name: '蔬菜煎蛋饼', cal: '约 230 千卡', desc: '鸡蛋混入胡萝卜丝西葫芦，简单营养。', grad: MG.green, meal: 'breakfast' },
  { name: '香蕉牛奶奶昔', cal: '约 210 千卡', desc: '快手早餐，饱腹又好喝。', grad: MG.pink, meal: 'breakfast' },
  { name: '紫米杂粮饭团', cal: '约 270 千卡', desc: '糯米裹油条，中式经典。', grad: MG.purple, meal: 'breakfast' },
  { name: '牛奶玉米饼', cal: '约 240 千卡', desc: '玉米面煎饼，松软微甜。', grad: MG.warm, meal: 'breakfast' },
  { name: '牛油果吐司', cal: '约 310 千卡', desc: '健康脂肪搭配全麦面包。', grad: MG.green, meal: 'breakfast' },
  { name: '银耳莲子羹', cal: '约 160 千卡', desc: '润肺养颜，低糖版本。', grad: MG.pink, meal: 'breakfast' },
  { name: '葱油拌面', cal: '约 340 千卡', desc: '上海经典早餐，葱香四溢。', grad: MG.orange, meal: 'breakfast' },
  { name: '皮蛋瘦肉粥', cal: '约 220 千卡', desc: '广式早茶经典，咸香暖胃。', grad: MG.warm, meal: 'breakfast' },
  { name: '芝士火腿帕尼尼', cal: '约 380 千卡', desc: '西式早餐，浓郁满足。', grad: MG.pink, meal: 'breakfast' },
  { name: '黑芝麻糊', cal: '约 180 千卡', desc: '乌发养颜，香浓顺滑。', grad: MG.purple, meal: 'breakfast' },
  { name: '蔬菜包子', cal: '约 200 千卡', desc: '白菜香菇馅，低脂健康。', grad: MG.green, meal: 'breakfast' },
  { name: '藜麦水果碗', cal: '约 230 千卡', desc: '超级谷物搭配时令水果。', grad: MG.mint, meal: 'breakfast' },
  { name: '豆浆油条', cal: '约 350 千卡', desc: '中式经典CP，偶尔解馋。', grad: MG.warm, meal: 'breakfast' },
  { name: '希腊酸奶碗', cal: '约 190 千卡', desc: '高蛋白低糖，加蜂蜜坚果。', grad: MG.pink, meal: 'breakfast' },
  { name: '红薯小米粥', cal: '约 170 千卡', desc: '膳食纤维丰富，通便养胃。', grad: MG.orange, meal: 'breakfast' },
  { name: '日式饭团', cal: '约 250 千卡', desc: '三角饭团夹梅子或三文鱼。', grad: MG.blue, meal: 'breakfast' },
  { name: '南瓜蒸糕', cal: '约 200 千卡', desc: '蓬松香甜，无油低卡。', grad: MG.warm, meal: 'breakfast' },
  { name: '牛奶鸡蛋布丁', cal: '约 180 千卡', desc: '嫩滑蛋香，少糖版本。', grad: MG.pink, meal: 'breakfast' },
  { name: '蔬菜豆腐脑', cal: '约 150 千卡', desc: '嫩豆花浇卤汁，暖胃低卡。', grad: MG.green, meal: 'breakfast' },
  { name: '坚果牛奶燕麦', cal: '约 290 千卡', desc: '隔夜燕麦加坚果，饱腹持久。', grad: MG.warm, meal: 'breakfast' },
  { name: '虾仁蛋羹', cal: '约 160 千卡', desc: '嫩滑蒸蛋配鲜虾，高蛋白。', grad: MG.pink, meal: 'breakfast' },
  { name: '杂粮馒头', cal: '约 210 千卡', desc: '玉米面荞麦面混合，粗粮健康。', grad: MG.warm, meal: 'breakfast' },
  { name: '草莓松饼', cal: '约 280 千卡', desc: '松软美式松饼，偶尔放纵。', grad: MG.red, meal: 'breakfast' },
  { name: '西葫芦蛋饼', cal: '约 200 千卡', desc: '蔬菜鸡蛋煎饼，快手美味。', grad: MG.green, meal: 'breakfast' },
  { name: '红豆松饼', cal: '约 260 千卡', desc: '微甜松软，搭配红豆沙。', grad: MG.pink, meal: 'breakfast' },
  { name: '味噌豆腐汤', cal: '约 120 千卡', desc: '日式暖汤，低卡暖胃。', grad: MG.warm, meal: 'breakfast' },

  // ===== 午餐 40 道 =====
  { name: '鸡胸肉蔬菜沙拉', cal: '约 280 千卡', desc: '高蛋白低脂，搭配时令蔬菜，清爽饱腹。', grad: MG.warm, meal: 'lunch' },
  { name: '糙米三文鱼饭', cal: '约 420 千卡', desc: '优质碳水加Omega-3，营养均衡。', grad: MG.purple, meal: 'lunch' },
  { name: '荞麦冷面', cal: '约 320 千卡', desc: '低GI主食，搭配蛋丝黄瓜，夏日清爽。', grad: MG.blue, meal: 'lunch' },
  { name: '清蒸鲈鱼', cal: '约 200 千卡', desc: '优质蛋白，原汁原味，低脂健康。', grad: MG.orange, meal: 'lunch' },
  { name: '番茄牛腩饭', cal: '约 480 千卡', desc: '番茄酸甜开胃，牛腩补铁。', grad: MG.red, meal: 'lunch' },
  { name: '藜麦鸡肉碗', cal: '约 380 千卡', desc: '超级谷物搭配嫩滑鸡胸。', grad: MG.green, meal: 'lunch' },
  { name: '日式照烧鸡饭', cal: '约 450 千卡', desc: '甜咸酱汁配米饭，满足不腻。', grad: MG.pink, meal: 'lunch' },
  { name: '香煎鸡排', cal: '约 350 千卡', desc: '外酥里嫩，搭配柠檬汁解腻。', grad: MG.orange, meal: 'lunch' },
  { name: '蒜蓉粉丝蒸虾', cal: '约 260 千卡', desc: '鲜美弹牙，蒜香入味。', grad: MG.red, meal: 'lunch' },
  { name: '咖喱鸡肉饭', cal: '约 460 千卡', desc: '浓郁咖喱配嫩鸡，下饭神器。', grad: MG.warm, meal: 'lunch' },
  { name: '酸汤肥牛', cal: '约 400 千卡', desc: '酸辣开胃，肥牛卷鲜嫩。', grad: MG.green, meal: 'lunch' },
  { name: '黑椒牛柳意面', cal: '约 440 千卡', desc: '西式经典，黑椒浓郁。', grad: MG.purple, meal: 'lunch' },
  { name: '口水鸡', cal: '约 300 千卡', desc: '川味凉菜，麻辣鲜香。', grad: MG.red, meal: 'lunch' },
  { name: '红烧排骨', cal: '约 500 千卡', desc: '经典家常菜，软烂入味。', grad: MG.orange, meal: 'lunch' },
  { name: '酸菜鱼', cal: '约 350 千卡', desc: '酸辣鲜嫩，鱼片入口即化。', grad: MG.green, meal: 'lunch' },
  { name: '宫保鸡丁', cal: '约 380 千卡', desc: '花生鸡丁，甜辣下饭。', grad: MG.red, meal: 'lunch' },
  { name: '麻婆豆腐', cal: '约 280 千卡', desc: '麻辣鲜香，经典川味。', grad: MG.red, meal: 'lunch' },
  { name: '糖醋里脊', cal: '约 420 千卡', desc: '酸甜酥脆，老少皆宜。', grad: MG.orange, meal: 'lunch' },
  { name: '蒜苔炒肉', cal: '约 320 千卡', desc: '家常小炒，蒜香浓郁。', grad: MG.green, meal: 'lunch' },
  { name: '番茄鸡蛋面', cal: '约 340 千卡', desc: '快手汤面，酸甜暖胃。', grad: MG.red, meal: 'lunch' },
  { name: '韩式拌饭', cal: '约 420 千卡', desc: '蔬菜拌饭配辣酱，营养全面。', grad: MG.purple, meal: 'lunch' },
  { name: '泰式冬阴功汤', cal: '约 180 千卡', desc: '酸辣鲜香，开胃暖身。', grad: MG.green, meal: 'lunch' },
  { name: '葱爆羊肉', cal: '约 400 千卡', desc: '大葱配羊肉，鲜嫩不膻。', grad: MG.warm, meal: 'lunch' },
  { name: '鱼香肉丝', cal: '约 330 千卡', desc: '酸甜微辣，经典下饭菜。', grad: MG.red, meal: 'lunch' },
  { name: '椒盐排骨', cal: '约 460 千卡', desc: '外酥里嫩，椒盐飘香。', grad: MG.orange, meal: 'lunch' },
  { name: '白切鸡', cal: '约 280 千卡', desc: '原汁原味，皮爽肉滑。', grad: MG.pink, meal: 'lunch' },
  { name: '回锅肉', cal: '约 450 千卡', desc: '川菜之王，肥而不腻。', grad: MG.red, meal: 'lunch' },
  { name: '清炒虾仁', cal: '约 220 千卡', desc: '清淡鲜美，高蛋白低脂。', grad: MG.blue, meal: 'lunch' },
  { name: '地三鲜', cal: '约 300 千卡', desc: '茄子土豆青椒，东北经典。', grad: MG.purple, meal: 'lunch' },
  { name: '香菇滑鸡饭', cal: '约 390 千卡', desc: '港式经典，鸡肉嫩滑。', grad: MG.warm, meal: 'lunch' },
  { name: '意式番茄肉酱面', cal: '约 430 千卡', desc: '浓郁肉酱配弹牙意面。', grad: MG.red, meal: 'lunch' },
  { name: '土豆烧鸡', cal: '约 380 千卡', desc: '土豆绵软入味，鸡肉鲜嫩。', grad: MG.warm, meal: 'lunch' },
  { name: '干煸四季豆', cal: '约 260 千卡', desc: '焦香入味，下饭一绝。', grad: MG.green, meal: 'lunch' },
  { name: '海南鸡饭', cal: '约 400 千卡', desc: '嫩鸡配油饭，蘸料灵魂。', grad: MG.pink, meal: 'lunch' },
  { name: '西红柿牛腩面', cal: '约 410 千卡', desc: '酸甜浓郁汤底，牛腩软烂。', grad: MG.red, meal: 'lunch' },
  { name: '蒜香排骨', cal: '约 440 千卡', desc: '蒜香炸排骨，酥脆多汁。', grad: MG.orange, meal: 'lunch' },
  { name: '彩椒牛柳', cal: '约 350 千卡', desc: '彩椒配嫩牛，色彩丰富。', grad: MG.green, meal: 'lunch' },
  { name: '奶油蘑菇意面', cal: '约 450 千卡', desc: '浓郁奶香，蘑菇鲜美。', grad: MG.pink, meal: 'lunch' },
  { name: '香辣虾', cal: '约 320 千卡', desc: '麻辣鲜香，吮指回味。', grad: MG.red, meal: 'lunch' },
  { name: '韭黄炒蛋', cal: '约 240 千卡', desc: '简单家常，鲜香软嫩。', grad: MG.warm, meal: 'lunch' },
  { name: '土豆炖牛肉', cal: '约 400 千卡', desc: '牛肉软烂，土豆入味。', grad: MG.orange, meal: 'lunch' },

  // ===== 晚餐 35 道 =====
  { name: '番茄豆腐汤', cal: '约 150 千卡', desc: '酸甜开胃，豆腐补钙，低卡暖胃。', grad: MG.red, meal: 'dinner' },
  { name: '清炒西兰花', cal: '约 90 千卡', desc: '高纤维维C丰富，简单快炒保留营养。', grad: MG.green, meal: 'dinner' },
  { name: '蒜蓉菠菜', cal: '约 80 千卡', desc: '补铁绿叶菜，清淡少油。', grad: MG.green, meal: 'dinner' },
  { name: '冬瓜虾仁汤', cal: '约 120 千卡', desc: '消水肿低热量，鲜美暖身。', grad: MG.purple, meal: 'dinner' },
  { name: '凉拌木耳', cal: '约 70 千卡', desc: '清肠排毒，脆爽可口。', grad: MG.blue, meal: 'dinner' },
  { name: '蒸蛋羹', cal: '约 130 千卡', desc: '嫩滑易消化，老少皆宜。', grad: MG.warm, meal: 'dinner' },
  { name: '紫菜蛋花汤', cal: '约 100 千卡', desc: '补碘低卡，简单快手。', grad: MG.orange, meal: 'dinner' },
  { name: '凉拌黄瓜', cal: '约 50 千卡', desc: '清脆爽口，开胃前菜。', grad: MG.green, meal: 'dinner' },
  { name: '丝瓜蛋汤', cal: '约 90 千卡', desc: '清淡鲜美，低卡暖胃。', grad: MG.mint, meal: 'dinner' },
  { name: '白灼生菜', cal: '约 60 千卡', desc: '保留原味，清淡健康。', grad: MG.green, meal: 'dinner' },
  { name: '莲藕排骨汤', cal: '约 200 千卡', desc: '莲藕软糯，汤鲜味美。', grad: MG.pink, meal: 'dinner' },
  { name: '蒸南瓜', cal: '约 80 千卡', desc: '天然甜味，低卡代餐。', grad: MG.warm, meal: 'dinner' },
  { name: '凉拌秋葵', cal: '约 60 千卡', desc: '黏液蛋白，养胃护肝。', grad: MG.green, meal: 'dinner' },
  { name: '番茄龙利鱼', cal: '约 180 千卡', desc: '无刺鱼肉，酸甜低脂。', grad: MG.red, meal: 'dinner' },
  { name: '海带豆腐汤', cal: '约 90 千卡', desc: '补碘补钙，清淡暖身。', grad: MG.blue, meal: 'dinner' },
  { name: '芹菜炒香干', cal: '约 150 千卡', desc: '高纤维，清爽可口。', grad: MG.green, meal: 'dinner' },
  { name: '萝卜清汤', cal: '约 70 千卡', desc: '消食化滞，清淡低卡。', grad: MG.mint, meal: 'dinner' },
  { name: '蒜蓉娃娃菜', cal: '约 80 千卡', desc: '清甜软嫩，简单好吃。', grad: MG.warm, meal: 'dinner' },
  { name: '凉拌三丝', cal: '约 90 千卡', desc: '海带粉丝胡萝卜，开胃低卡。', grad: MG.blue, meal: 'dinner' },
  { name: '玉米排骨汤', cal: '约 220 千卡', desc: '玉米甜香，排骨软烂。', grad: MG.warm, meal: 'dinner' },
  { name: '清蒸蛋黄豆腐', cal: '约 120 千卡', desc: '嫩滑入口即化，低卡高蛋白。', grad: MG.pink, meal: 'dinner' },
  { name: '芦笋炒虾仁', cal: '约 160 千卡', desc: '高蛋白低脂，鲜美脆嫩。', grad: MG.green, meal: 'dinner' },
  { name: '银耳木瓜汤', cal: '约 110 千卡', desc: '养颜润肺，低糖甜品。', grad: MG.pink, meal: 'dinner' },
  { name: '清炒山药', cal: '约 100 千卡', desc: '健脾养胃，脆爽可口。', grad: MG.mint, meal: 'dinner' },
  { name: '花蛤豆腐汤', cal: '约 130 千卡', desc: '鲜美低卡，补锌补钙。', grad: MG.blue, meal: 'dinner' },
  { name: '凉拌莴笋丝', cal: '约 50 千卡', desc: '清脆爽口，低卡凉菜。', grad: MG.green, meal: 'dinner' },
  { name: '西红柿炖菜', cal: '约 140 千卡', desc: '番茄打底，时蔬乱炖。', grad: MG.red, meal: 'dinner' },
  { name: '虾仁蒸蛋', cal: '约 130 千卡', desc: '双重优质蛋白，嫩滑鲜美。', grad: MG.pink, meal: 'dinner' },
  { name: '上汤苋菜', cal: '约 90 千卡', desc: '红苋菜配皮蛋，营养开胃。', grad: MG.red, meal: 'dinner' },
  { name: '清炖鸡汤', cal: '约 180 千卡', desc: '原汤原味，滋补不上火。', grad: MG.warm, meal: 'dinner' },
  { name: '凉拌豆腐', cal: '约 100 千卡', desc: '嫩豆腐配酱油葱油，简单低卡。', grad: MG.mint, meal: 'dinner' },
  { name: '蘑菇鸡蛋汤', cal: '约 110 千卡', desc: '鲜美暖胃，低卡高蛋白。', grad: MG.warm, meal: 'dinner' },
  { name: '蒜香蒸茄子', cal: '约 80 千卡', desc: '免油蒸制，蒜香浓郁。', grad: MG.purple, meal: 'dinner' },
  { name: '鲜菇豆腐汤', cal: '约 100 千卡', desc: '菌菇鲜美，豆腐嫩滑。', grad: MG.warm, meal: 'dinner' },
  { name: '白萝卜炖牛腩', cal: '约 250 千卡', desc: '萝卜吸汁，牛腩软烂。', grad: MG.warm, meal: 'dinner' },
  { name: '豆苗蛋花汤', cal: '约 80 千卡', desc: '豌豆苗配蛋花，清淡鲜绿。', grad: MG.green, meal: 'dinner' },
];

// 根据日期种子选取每日推荐
function getDailyMeals() {
  const key = window._mealOverride || dateKey(new Date());
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed += key.charCodeAt(i) * (i + 1);
  const pick = (mealType, offset) => {
    const pool = MEALS.filter(m => m.meal === mealType);
    return pool[(seed + offset) % pool.length];
  };
  return [
    { ...pick('breakfast', 0), mealLabel: '早餐' },
    { ...pick('lunch', 3), mealLabel: '午餐' },
    { ...pick('dinner', 7), mealLabel: '晚餐' },
  ];
}

/* ---------- 应用状态 ---------- */
let currentModule = 'home';

/* ---------- 初始化 ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // 应用主题（在渲染前应用，避免闪屏）
  applyTheme(Store.get('theme', 'auto'));

  // 今日日期
  $('#todayDate').textContent = fmtDate(new Date());

  // 侧边栏导航
  const navList = $('#navList');
  MODULES.forEach(m => {
    const el = document.createElement('div');
    el.className = 'nav-item' + (m.id === currentModule ? ' active' : '');
    el.dataset.id = m.id;
    el.innerHTML = `<span class="nav-icon">${m.icon}</span><span class="nav-label">${m.label}</span>`;
    el.addEventListener('click', () => switchModule(m.id));
    navList.appendChild(el);
  });

  // 侧边栏收起/移动端
  $('#menuToggle').addEventListener('click', () => {
    const sb = $('#sidebar');
    if (window.innerWidth <= 768) {
      sb.classList.toggle('open');
      $('#overlay').classList.toggle('show');
    } else {
      sb.classList.toggle('collapsed');
    }
  });
  $('#overlay').addEventListener('click', () => {
    $('#sidebar').classList.remove('open');
    $('#overlay').classList.remove('show');
  });

  // 设置按钮
  const settingsBtn = $('#settingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', () => openSettings());

  // 初始化模块标题
  const initialM = MODULES.find(x => x.id === currentModule);
  if (initialM) $('#moduleTitle').textContent = initialM.label;

  // 大屏自动收起（桌面体验）—— 默认不收起，保持完整显示
  // 迁移旧 localStorage 图片到 IndexedDB（异步执行，不阻塞渲染）
  migrateClothesImagesIfNeeded().then(() => {
    // 如果当前在衣橱页，迁移后刷新
    if (currentModule === 'wardrobe') renderModule('wardrobe');
  });
  renderModule(currentModule);
});

function switchModule(id) {
  currentModule = id;
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.id === id));
  const m = MODULES.find(x => x.id === id);
  $('#moduleTitle').textContent = m.label;
  // 移动端关闭侧边栏
  if (window.innerWidth <= 768) {
    $('#sidebar').classList.remove('open');
    $('#overlay').classList.remove('show');
  }
  renderModule(id);
}

function renderModule(id) {
  const content = $('#content');
  content.classList.remove('fade');
  // 触发重绘以重启动画
  void content.offsetWidth;
  content.classList.add('fade');

  const map = {
    home: renderHome,
    daily: renderDaily,
    headline: renderHeadline,
    wardrobe: renderWardrobe,
    fun: renderFun,
    meal: renderMeal,
    period: renderPeriod,
    piano: () => renderLearn('piano'),
    chess: () => renderLearn('chess'),
    calli: () => renderLearn('calli'),
    sketch: () => renderLearn('sketch'),
    dance: () => renderLearn('dance'),
    sew: () => renderLearn('sew'),
    stats: renderStats,
  };
  content.innerHTML = (map[id] || (() => '<p>模块开发中…</p>'))();
  // 模块特定绑定
  afterRender[id] && afterRender[id]();
}

const afterRender = {};

/* =========================================================================
 * 模块 0：首页（Hi OnePiece + 日期 + 天气 + 每日金句）
 * ========================================================================= */
function getGreeting() {
  const h = new Date().getHours();
  const name = Store.get('user_nickname', 'OnePiece');
  if (h < 6) return `夜深了，${name}`;
  if (h < 9) return `早上好，${name}`;
  if (h < 12) return `上午好，${name}`;
  if (h < 14) return `中午好，${name}`;
  if (h < 18) return `下午好，${name}`;
  if (h < 22) return `晚上好，${name}`;
  return `夜深了，${name}`;
}

// 获取今日打卡概览数据
function getHomeOverview() {
  const todos = Store.get('daily_' + dateKey(new Date()) + '_todos', []);
  const todoDone = todos.filter(t => t.done).length;
  const todoTotal = todos.length;
  const water = Store.get('daily_' + dateKey(new Date()) + '_water', 0);
  const waterGoal = Store.get('water_goal', 6);
  // 学习总进度
  let learnTotal = 0, learnDone = 0;
  Object.keys(LEARN_DATA).forEach(key => {
    const d = LEARN_DATA[key];
    const done = Store.get('learn_' + key, {});
    d.phases.forEach((p, pi) => p.tasks.forEach((t, ti) => {
      learnTotal++;
      if (done[`${pi}_${ti}`]) learnDone++;
    }));
  });
  return { todoDone, todoTotal, water, waterGoal, learnDone, learnTotal };
}

function renderHome() {
  return `
    <div class="home-page">
      <div class="home-card">
        <div class="home-greeting">${escapeHtml(getGreeting())}</div>
        <div class="home-date" id="homeDate"></div>
        <div class="home-weather" id="homeWeather">
          <span class="home-weather-loading">天气加载中…</span>
        </div>
        <div class="home-divider"></div>
        <div class="home-quote" id="homeQuote">
          <span class="home-quote-loading">正在获取今日金句…</span>
        </div>
        <div class="home-overview" id="homeOverview"></div>
      </div>
    </div>
  `;
}

afterRender.home = () => {
  const d = new Date();
  $('#homeDate').textContent = fmtDate(d);
  fetchHomeWeather();
  fetchHomeQuote();
  renderHomeOverview();
};

function renderHomeOverview() {
  const el = $('#homeOverview');
  if (!el) return;
  const ov = getHomeOverview();
  el.innerHTML = `
    <div class="home-overview-item">
      <div class="home-overview-num">${ov.todoDone}/${ov.todoTotal}</div>
      <div class="home-overview-label">今日待办</div>
    </div>
    <div class="home-overview-item">
      <div class="home-overview-num">${ov.water}/${ov.waterGoal}</div>
      <div class="home-overview-label">喝水(杯)</div>
    </div>
    <div class="home-overview-item">
      <div class="home-overview-num">${ov.learnDone}/${ov.learnTotal}</div>
      <div class="home-overview-label">学习进度</div>
    </div>
  `;
}

// WMO 天气码 → 中文描述 + emoji
const WMO_WEATHER = {
  0:['晴','☀️'], 1:['大部晴','🌤️'], 2:['多云','⛅'], 3:['阴天','☁️'],
  45:['有雾','🌫️'], 48:['雾凇','🌫️'],
  51:['小毛毛雨','🌦️'], 53:['毛毛雨','🌦️'], 55:['大毛毛雨','🌧️'],
  56:['冻毛毛雨','🌧️'], 57:['强冻毛毛雨','🌧️'],
  61:['小雨','🌦️'], 63:['中雨','🌧️'], 65:['大雨','🌧️'],
  66:['冻雨','🌧️'], 67:['强冻雨','🌧️'],
  71:['小雪','🌨️'], 73:['中雪','🌨️'], 75:['大雪','❄️'], 77:['米雪','🌨️'],
  80:['阵雨','🌦️'], 81:['强阵雨','🌧️'], 82:['暴阵雨','⛈️'],
  85:['阵雪','🌨️'], 86:['强阵雪','❄️'],
  95:['雷暴','⛈️'], 96:['雷暴冰雹','⛈️'], 99:['强雷暴冰雹','⛈️'],
};

async function fetchHomeWeather() {
  const el = $('#homeWeather');
  if (!el) return;
  try {
    // 上海经纬度，取当前天气（5秒超时）
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=31.23&longitude=121.47&current=temperature_2m,weather_code&timezone=Asia/Shanghai';
    const res = await fetchWithRetry(url, {}, { retries: 3, timeout: 5000 });
    const data = await res.json();
    const temp = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;
    const desc = WMO_WEATHER[code] || ['未知','🌡️'];
    el.innerHTML = `<span class="home-weather-icon">${desc[1]}</span><span>上海 · ${desc[0]} ${temp}°C</span>`;
  } catch (e) {
    // 降级：显示静态信息
    el.innerHTML = `<span class="home-weather-icon">🌡️</span><span>上海 · 天气暂不可用</span>`;
  }
}

async function fetchHomeQuote() {
  const el = $('#homeQuote');
  if (!el) return;
  try {
    // 一言接口：c=i 诗词, c=k 哲理，随机取（5秒超时）
    const res = await fetchWithRetry('https://v1.hitokoto.cn/?c=i&c=k', {}, { retries: 3, timeout: 5000 });
    const data = await res.json();
    const text = data.hitokoto || '';
    const from = data.from ? `—— ${data.from_who ? data.from_who + '·' : ''}${data.from}` : '';
    el.innerHTML = `<div class="home-quote-text">「${escapeHtml(text)}」</div>${from ? `<div class="home-quote-from">${escapeHtml(from)}</div>` : ''}`;
  } catch (e) {
    // 降级：从本地金句池按日期轮换
    const q = LOCAL_QUOTES[dailySeed() % LOCAL_QUOTES.length];
    el.innerHTML = `<div class="home-quote-text">「${escapeHtml(q.text)}」</div><div class="home-quote-from">—— ${escapeHtml(q.from)}</div>`;
  }
}


function renderDaily() {
  return `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-title"><span class="ico">☑</span>待办事项</div>
        <div class="input-group" style="margin-bottom:12px;">
          <input class="input" id="todoInput" placeholder="添加任务，如：写周报" onkeydown="if(event.key==='Enter')TodoAdd()">
          <select class="input" id="todoPriority" style="width:auto;padding:0 10px;">
            <option value="low">低</option>
            <option value="mid" selected>中</option>
            <option value="high">高</option>
          </select>
          <button class="btn" onclick="TodoAdd()">添加</button>
        </div>
        <div class="todo-list" id="todoList"></div>
      </div>

      <div class="card">
        <div class="card-title"><span class="ico">≋</span>喝水记录</div>
        <div class="water-goal-setting">每日目标：<input type="number" id="waterGoalInput" min="1" max="20" value="${Store.get('water_goal', 6)}" onchange="WaterGoalSet(this.value)"> 杯</div>
        <div class="water-summary">今日已喝 <b id="waterCount">0</b> 杯</div>
        <div class="water-cups" id="waterCups"></div>
        <button class="btn btn-soft btn-sm" onclick="WaterReset()">重置</button>
      </div>

      <div class="card">
        <div class="card-title"><span class="ico">➤</span>运动记录</div>
        <div class="input-group" style="margin-bottom:10px;">
          <input class="input" id="sportInput" placeholder="如：跑步30分钟" onkeydown="if(event.key==='Enter')SportAdd()">
          <button class="btn" onclick="SportAdd()">保存</button>
        </div>
        <div class="record-list" id="sportList"></div>
      </div>

      <div class="card">
        <div class="card-title"><span class="ico">✎</span>码字记录</div>
        <div class="input-group" style="margin-bottom:10px;">
          <input class="input" id="wordsInput" type="number" min="0" placeholder="输入今日字数（数字）" onkeydown="if(event.key==='Enter')WordsAdd()">
          <button class="btn" onclick="WordsAdd()">记录</button>
        </div>
        <div class="stat-display" id="wordsDisplay">今日已码 <b id="wordsTotal">0</b> 字</div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card daily-poem-card">
        <div class="card-title"><span class="ico">📜</span>古诗一首</div>
        <div id="dailyPoem">
          <div class="daily-loading">正在为你寻一首诗…</div>
        </div>
      </div>

      <div class="card daily-book-card">
        <div class="card-title"><span class="ico">📚</span>经典诵读</div>
        <div id="dailyBook">
          <div class="daily-loading">今日好书推荐加载中…</div>
        </div>
      </div>
    </div>
  `;
}

const todayKey = () => 'daily_' + dateKey(new Date());

afterRender.daily = () => {
  renderTodos();
  renderWater();
  renderSports();
  renderWords();
  fetchDailyPoem();
  fetchDailyBook();
};

/* --- 待办 --- */
function getTodos() { return Store.get(todayKey() + '_todos', []); }
function setTodos(v) { Store.set(todayKey() + '_todos', v); }

function renderTodos() {
  const list = $('#todoList');
  const todos = getTodos();
  if (!todos.length) { list.innerHTML = '<div class="empty-hint">还没有任务，添加一个吧～</div>'; return; }
  // 按优先级排序：高 > 中 > 低
  const priorityOrder = { high: 0, mid: 1, low: 2 };
  const sorted = todos.map((t, i) => ({ ...t, _i: i })).sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (priorityOrder[a.priority||'mid']||1) - (priorityOrder[b.priority||'mid']||1);
  });
  const priorityLabels = { high: '高', mid: '中', low: '低' };
  list.innerHTML = sorted.map(t => `
    <div class="todo-item ${t.done?'done':''} priority-${t.priority||'mid'}">
      <div class="checkbox ${t.done?'checked':''}" role="checkbox" tabindex="0" aria-checked="${t.done}" onclick="TodoToggle(${t._i})" onkeydown="if(event.key===' '||event.key==='Enter'){event.preventDefault();TodoToggle(${t._i})}"></div>
      <span class="todo-text">${escapeHtml(t.text)}</span>
      <span class="todo-priority"><span class="priority-dot ${t.priority||'mid'} active" title="优先级：${priorityLabels[t.priority||'mid']}"></span></span>
      <span class="todo-delete" onclick="TodoDel(${t._i})">✕</span>
    </div>
  `).join('');
}
function TodoAdd() {
  const inp = $('#todoInput');
  const v = inp.value.trim();
  if (!v) return;
  const priority = $('#todoPriority')?.value || 'mid';
  const todos = getTodos();
  todos.push({ text: v, done: false, priority });
  setTodos(todos);
  inp.value = '';
  renderTodos();
}
function TodoToggle(i) {
  const todos = getTodos();
  todos[i].done = !todos[i].done;
  setTodos(todos);
  renderTodos();
}
function TodoDel(i) {
  const todos = getTodos();
  todos.splice(i, 1);
  setTodos(todos);
  renderTodos();
}

/* --- 喝水 --- */
function getWater() { return Store.get(todayKey() + '_water', 0); }
function setWater(v) { Store.set(todayKey() + '_water', v); }
function renderWater() {
  const n = getWater();
  const goal = Store.get('water_goal', 6);
  $('#waterCount').textContent = n;
  $('#waterCups').innerHTML = Array.from({length: goal}, (_, i) =>
    `<div class="cup ${i < n ? 'filled' : ''}" title="${i+1}杯" role="button" tabindex="0" aria-label="设置${i+1}杯" onclick="WaterSet(${i+1})" onkeydown="if(event.key===' '||event.key==='Enter'){event.preventDefault();WaterSet(${i+1})}"></div>`
  ).join('');
}
function WaterSet(n) {
  const cur = getWater();
  setWater(n === cur ? n - 1 : n);
  renderWater();
}
function WaterReset() { setWater(0); renderWater(); }
function WaterGoalSet(v) {
  const goal = Math.max(1, Math.min(20, parseInt(v) || 6));
  Store.set('water_goal', goal);
  renderWater();
}

/* --- 运动 --- */
function getSports() { return Store.get(todayKey() + '_sports', []); }
function setSports(v) { Store.set(todayKey() + '_sports', v); }
function renderSports() {
  const el = $('#sportList');
  const list = getSports();
  if (!list.length) { el.innerHTML = '<div class="empty-hint">今天还没运动记录～</div>'; return; }
  el.innerHTML = list.map((s, i) => `
    <div class="record-entry">
      <span>${escapeHtml(s.text)}</span>
      <span class="time">${s.time}<span class="del" onclick="SportDel(${i})"> ✕</span></span>
    </div>
  `).join('');
}
function SportAdd() {
  const inp = $('#sportInput');
  const v = inp.value.trim();
  if (!v) return;
  const list = getSports();
  const now = new Date();
  list.push({ text: v, time: `${pad(now.getHours())}:${pad(now.getMinutes())}` });
  setSports(list);
  inp.value = '';
  renderSports();
}
function SportDel(i) {
  const list = getSports();
  list.splice(i, 1);
  setSports(list);
  renderSports();
}

/* --- 码字 --- */
function getWords() { return Store.get(todayKey() + '_words', 0); }
function setWords(v) { Store.set(todayKey() + '_words', v); }
function renderWords() { $('#wordsTotal').textContent = getWords(); }
function WordsAdd() {
  const inp = $('#wordsInput');
  const v = parseInt(inp.value) || 0;
  if (v <= 0) return;
  setWords(getWords() + v);
  inp.value = '';
  renderWords();
}

/* --- 古诗一首（从本地 poems.json 加载，500 首每日轮换） --- */
let _poemsCache = null;

async function loadPoems() {
  if (_poemsCache) return _poemsCache;
  try {
    const res = await fetch('poems.json');
    if (!res.ok) throw new Error('fetch failed');
    _poemsCache = await res.json();
    return _poemsCache;
  } catch (e) {
    return null;
  }
}

async function fetchDailyPoem() {
  const el = $('#dailyPoem');
  if (!el) return;
  el.innerHTML = '<div class="daily-loading">正在为你寻一首诗…</div>';

  const poems = await loadPoems();
  if (!poems || !poems.length) {
    el.innerHTML = '<div class="daily-loading">诗词库加载失败，请刷新重试</div>';
    return;
  }

  // 用日期做种子选诗，同一天同一首
  const poem = poems[dailySeed() % poems.length];
  renderDailyPoem(poem);
}

function renderDailyPoem(p) {
  const el = $('#dailyPoem');
  if (!el) return;
  el.innerHTML = `
    <div class="poem-origin">${escapeHtml(p.title)}</div>
    <div class="poem-author">〔${escapeHtml(p.dynasty || '')}〕${escapeHtml(p.author || '佚名')}</div>
    <div class="poem-content">${escapeHtml(p.content)}</div>
    ${p.note ? `<div class="poem-category">注：${escapeHtml(p.note)}</div>` : ''}
  `;
}

/* --- 经典诵读（每日推荐一本书） --- */
const CLASSIC_BOOKS = [
  { title: "论语", author: "孔子及弟子", desc: "儒家核心经典，记录孔子及其弟子言行。全书共20篇，涵盖修身、齐家、治国、平天下之道，「学而时习之」「己所不欲勿施于人」等名言传诵千古，是中国人精神底色的重要来源。" },
  { title: "道德经", author: "老子", desc: "道家哲学奠基之作，仅五千余言，却博大精深。提出「道法自然」「无为而治」「上善若水」等思想，影响了整个东方哲学。全书八十一章，字字珠玑，是全球翻译最多的中国典籍之一。" },
  { title: "庄子", author: "庄周", desc: "道家学派的瑰丽奇葩，分内篇、外篇、杂篇三部分。以寓言、神话说理，「逍遥游」「齐物论」「庖丁解牛」等名篇想象力奇绝，追求精神绝对自由的境界。" },
  { title: "孟子", author: "孟子", desc: "儒家「亚圣」之作，记录孟子游说诸侯的对话。提出「性善论」「民贵君轻」「舍生取义」等思想，气势磅礴、雄辩有力，是了解儒家政治哲学与道德理想的必读经典。" },
  { title: "诗经", author: "佚名", desc: "中国最早的诗歌总集，收录西周至春秋诗歌305篇，分风、雅、颂三类。「关关雎鸠，在河之洲」「蒹葭苍苍，白露为霜」等名句流传至今，是现实主义的源头。" },
  { title: "楚辞", author: "屈原等", desc: "中国浪漫主义文学源头，以屈原《离骚》为代表。「路漫漫其修远兮，吾将上下而求索」的求索精神，影响了一代代文人志士。" },
  { title: "孙子兵法", author: "孙武", desc: "世界最早的军事理论著作，全书十三篇。「知己知彼，百战不殆」「不战而屈人之兵」等战略思想超越军事领域，被广泛应用于商业、管理和人生智慧。" },
  { title: "左传", author: "左丘明", desc: "中国第一部叙事详细的编年体史书，记录春秋时期历史。「烛之武退秦师」「曹刿论战」等篇章既是史学经典，也是文学典范，开创了史传文学的先河。" },
  { title: "周易", author: "佚名", desc: "群经之首，中国哲学的源头之一。「天行健，君子以自强不息」「地势坤，君子以厚德载物」等思想深刻影响了中华文化的精神品格。" },
  { title: "大学", author: "曾子", desc: "《礼记》中的一篇，南宋朱熹列为「四书」之一。提出「格物、致知、诚意、正心、修身、齐家、治国、平天下」的八条目，构建了儒家内圣外王的完整路径。" },
  { title: "中庸", author: "子思", desc: "《礼记》中的重要篇章，「四书」之一。阐述「不偏之谓中，不易之谓庸」的哲学思想，强调天人合一、诚身明善，是儒家心性之学的核心文本。" },
  { title: "礼记", author: "戴圣编", desc: "儒家经典之一，记录先秦礼制和儒家哲学。「大道之行也，天下为公」的大同理想，「教学相长」的教育理念，影响了中国两千年的礼乐文明。" },
  { title: "史记", author: "司马迁", desc: "中国第一部纪传体通史，被誉为「史家之绝唱，无韵之离骚」。记载上起黄帝下至汉武约三千年历史，是史学与文学的双重巅峰。" },
  { title: "汉书", author: "班固", desc: "中国第一部纪传体断代史，记载西汉一朝历史。体例严谨、文辞雅正，与《史记》并称「史汉」，开创了后代修断代史的先例。" },
  { title: "战国策", author: "刘向编", desc: "记录战国时期纵横家游说各国的策论，文辞雄辩、气势磅礴。「邹忌讽齐王纳谏」「触龙说赵太后」等篇章机智犀利，是学习论辩艺术的经典。" },
  { title: "说文解字", author: "许慎", desc: "中国第一部系统分析汉字字形和考究字源的字典，收录9353个汉字。创立540个部首，奠定汉字研究基础，是文字学的根本经典。" },
  { title: "世说新语", author: "刘义庆", desc: "中国笔记小说的代表作，记录汉末至东晋名士的言行轶事。「管宁割席」「谢道韫咏絮」等故事生动传神，展现了魏晋风度与名士风流。" },
  { title: "陶渊明集", author: "陶渊明", desc: "田园诗派的开创者。「采菊东篱下，悠然见南山」的闲适，「不为五斗米折腰」的气节，《桃花源记》构想的理想世界，影响了整个中国文人的精神追求。" },
  { title: "文心雕龙", author: "刘勰", desc: "中国文学理论批评的奠基之作，全书五十篇。系统论述文学创作与批评的理论，被誉为「体大而思精」的文论巨著。" },
  { title: "古诗十九首", author: "佚名", desc: "五言诗的典范之作，「行行重行行，与君生别离」「迢迢牵牛星，皎皎河汉女」等诗篇情感真挚，被刘勰誉为「五言之冠冕」。" },
  { title: "搜神记", author: "干宝", desc: "中国志怪小说的代表作，记录神仙鬼怪故事。「干将莫邪」「董永卖身葬父」等故事，是后来戏曲小说的重要素材来源。" },
  { title: "洛神赋", author: "曹植", desc: "曹植的辞赋名篇，描写与洛水女神相遇的故事。「翩若惊鸿，婉若游龙」「凌波微步，罗袜生尘」的华美辞藻，是建安文学的代表作。" },
  { title: "李太白全集", author: "李白", desc: "「诗仙」李白的诗文全集。「君不见黄河之水天上来」「天生我材必有用」的豪迈，「举杯邀明月，对影成三人」的浪漫，展现了盛唐气象。" },
  { title: "杜工部集", author: "杜甫", desc: "「诗圣」杜甫的诗文集。「国破山河在」的忧国忧民，「安得广厦千万间，大庇天下寒士俱欢颜」的博大胸怀，被誉为「诗史」。" },
  { title: "白氏长庆集", author: "白居易", desc: "白居易诗文集，倡导新乐府运动。《琵琶行》「同是天涯沦落人」的感叹，《长恨歌》「在天愿作比翼鸟」的深情，通俗易懂、情真意切。" },
  { title: "王维诗集", author: "王维", desc: "「诗佛」王维的诗作。「空山新雨后，天气晚来秋」「明月松间照，清泉石上流」的静谧意境，诗中有画、画中有诗。" },
  { title: "苏东坡全集", author: "苏轼", desc: "苏轼的诗词文全集。「大江东去，浪淘尽千古风流人物」的豪放，「但愿人长久，千里共婵娟」的深情，诗、词、文、书、画皆精，是宋代文学的集大成者。" },
  { title: "稼轩词", author: "辛弃疾", desc: "「词中之龙」辛弃疾的词集。「醉里挑灯看剑，梦回吹角连营」的壮志，是豪放派词人的杰出代表，与苏轼并称「苏辛」。" },
  { title: "漱玉词", author: "李清照", desc: "「千古第一才女」李清照的词集。「寻寻觅觅，冷冷清清，凄凄惨惨戚戚」的哀婉，「生当作人杰，死亦为鬼雄」的刚烈，是婉约派巅峰。" },
  { title: "剑南诗稿", author: "陆游", desc: "陆游的诗集，存诗九千余首。「王师北定中原日，家祭无忘告乃翁」的爱国情怀，是南宋爱国诗人的代表。" },
  { title: "欧阳修全集", author: "欧阳修", desc: "北宋文坛领袖欧阳修的诗文集。《醉翁亭记》「醉翁之意不在酒」的旷达，是宋代古文运动的核心推动者。" },
  { title: "柳永词集", author: "柳永", desc: "「白衣卿相」柳永的词集。「衣带渐宽终不悔，为伊消得人憔悴」，擅长慢词，市井传唱「凡有井水处，皆能歌柳词」。" },
  { title: "唐宋八大家文钞", author: "茅坤编", desc: "收录韩愈、柳宗元、欧阳修、苏洵、苏轼、苏辙、王安石、曾巩八位大家的散文，代表了中国古代散文的最高成就，是学习古文的经典选本。" },
  { title: "资治通鉴", author: "司马光", desc: "中国最大的编年体通史，记载战国到五代1362年历史。以「鉴于往事，有资于治道」为宗旨，是帝王治国教科书。" },
  { title: "六一诗话", author: "欧阳修", desc: "中国第一部诗话著作，开创了诗话这一文学批评体裁。以随笔形式品评诗歌，轻松活泼而又见解精到。" },
  { title: "沧浪诗话", author: "严羽", desc: "宋代诗话的集大成之作，以禅喻诗，提出「妙悟」「兴趣」等诗学概念，是中国诗学理论的经典。" },
  { title: "西厢记", author: "王实甫", desc: "元代杂剧巅峰之作。「碧云天，黄花地，西风紧，北雁南飞」的文采，「愿天下有情人终成眷属」的理想，是古典戏曲爱情主题的代表作。" },
  { title: "牡丹亭", author: "汤显祖", desc: "明代传奇戏曲杰作。「情不知所起，一往而深，生者可以死，死可以生」的至情观，是浪漫主义戏曲的高峰。" },
  { title: "窦娥冤", author: "关汉卿", desc: "元杂剧四大悲剧之一。「地也，你不分好歹何为地！天也，你错勘贤愚枉做天！」的控诉，展现了关汉卿对底层人民的深切同情。" },
  { title: "桃花扇", author: "孔尚任", desc: "清代传奇戏曲名作，以侯方域与李香君的爱情折射南明覆灭。「眼看他起朱楼，眼看他楼塌了」的兴亡之感，是古典戏曲中少有的历史反思之作。" },
  { title: "长生殿", author: "洪昇", desc: "清代传奇戏曲，演绎唐明皇与杨贵妃的爱情故事。与《桃花扇》并称清代戏曲双璧，「七月七日长生殿，夜半无人私语时」的深情令人动容。" },
  { title: "三国演义", author: "罗贯中", desc: "中国第一部长篇章回体历史演义小说，描写东汉末年至西晋初年近百年的历史风云。曹操、刘备、诸葛亮、关羽等人物形象影响深远。" },
  { title: "水浒传", author: "施耐庵", desc: "中国四大名著之一，讲述北宋末年一百零八位好汉被逼上梁山的故事。武松、林冲、鲁智深等英雄形象深入人心。" },
  { title: "西游记", author: "吴承恩", desc: "中国四大名著之一，讲述唐僧师徒四人西天取经、历经九九八十一难的故事。孙悟空的形象深入人心，全书想象力丰富。" },
  { title: "红楼梦", author: "曹雪芹", desc: "中国古典四大名著之首，以贾宝玉、林黛玉、薛宝钗的爱情婚姻悲剧为主线，全书塑造了数百个栩栩如生的人物形象，是中国封建社会的百科全书。" },
  { title: "金瓶梅", author: "兰陵笑笑生", desc: "中国第一部文人独立创作的长篇世情小说，以西门庆的家庭生活为中心，展现了明代社会的众生相。其写实手法对后世小说影响巨大。" },
  { title: "儒林外史", author: "吴敬梓", desc: "中国讽刺小说的巅峰之作。范进中举的荒诞、严监生的吝啬，入木三分地揭示了功名利禄对人性的扭曲。" },
  { title: "聊斋志异", author: "蒲松龄", desc: "中国文言短篇小说集，以花妖狐魅的故事寄寓讽刺与理想。「促织」「聂小倩」「画皮」等篇章情节奇幻、文笔精炼，是文言小说的高峰。" },
  { title: "封神演义", author: "许仲琳", desc: "明代神魔小说，以武王伐纣为背景，融合道教神话与历史。哪吒、杨戬、姜子牙等形象广为流传，是了解中国民间信仰和神话的重要读物。" },
  { title: "喻世明言", author: "冯梦龙", desc: "「三言」之一，收录四十篇话本小说，故事多取材于市井生活，反映了宋明时期市民阶层的价值观与情感世界。" },
  { title: "警世通言", author: "冯梦龙", desc: "「三言」之二，「杜十娘怒沉百宝箱」「白娘子永镇雷峰塔」等名篇脍炙人口，以世俗故事寓劝诫之意。" },
  { title: "醒世恒言", author: "冯梦龙", desc: "「三言」之三，「卖油郎独占花魁」等故事展现了明代市民的生活图景和情感追求，是古代白话短篇小说的经典。" },
  { title: "拍案惊奇", author: "凌濛初", desc: "「二拍」之一，明代拟话本小说集。故事曲折离奇，题材广泛，与「三言」并称，代表了中国古代白话小说的繁荣。" },
  { title: "浮生六记", author: "沈复", desc: "清代自传体散文，记录作者与妻子陈芸的日常生活。「事如春梦了无痕」的感慨，夫妻间的深情厚谊与坎坷际遇，是古代文学中罕见的真挚动人的伉俪回忆录。" },
  { title: "阅微草堂笔记", author: "纪昀", desc: "清代文言笔记小说集，纪晓岚所著。以狐鬼故事寓劝惩之意，与《聊斋志异》并称清代笔记小说双璧。" },
  { title: "镜花缘", author: "李汝珍", desc: "清代长篇小说，以百花仙子被贬下凡为线索。海外游历的奇闻异事与才女们的诗赋才艺，展现了作者对女性才华的肯定。" },
  { title: "老残游记", author: "刘鹗", desc: "晚清四大谴责小说之一。「赃官可恨，人人知之；清官尤可恨，人多不知」的深刻揭露，展现了晚清社会的黑暗与矛盾。" },
  { title: "官场现形记", author: "李宝嘉", desc: "晚清谴责小说代表作，揭露晚清官场腐败。以讽刺笔法描绘各级官员的丑态，是中国第一部专门暴露官场黑暗的小说。" },
  { title: "孽海花", author: "曾朴", desc: "晚清四大谴责小说之一，以金雯青与傅彩云的故事为线索，描绘了晚清外交与社会风情，是了解晚清社会的重要文学作品。" },
  { title: "唐诗三百首", author: "蘅塘退士编", desc: "清代孙洙编选的唐诗选本，收录77位诗人的311首诗。「熟读唐诗三百首，不会作诗也会吟」，是最普及的唐诗入门读本。" },
  { title: "宋词三百首", author: "朱孝臧编", desc: "近代词学大家朱孝臧编选的宋词选本，收录两宋词人代表作。苏轼、辛弃疾的豪放，柳永、李清照的婉约，是欣赏宋词的经典选本。" },
  { title: "古文观止", author: "吴楚材、吴调侯编", desc: "清代编选的古代散文选集，收录先秦至明末222篇散文。「观止」意为所选皆为精华，是学习古文最通用的启蒙读本。" },
  { title: "千家诗", author: "谢枋得编", desc: "古代蒙学读物，收录唐宋名家诗二百余首。按四季时令编排，通俗易懂、朗朗上口，是古代最普及的诗歌启蒙书。" },
  { title: "文选", author: "萧统编", desc: "南朝梁昭明太子萧统编选的诗文总集，是中国现存最早的诗文总集，「事出于沉思，义归乎翰藻」的选文标准影响深远。" },
  { title: "花间集", author: "赵崇祚编", desc: "中国最早的词总集，收录晚唐五代18位词人的500首词。温庭筠、韦庄等花间派词人的作品，是婉约词的源头。" },
  { title: "全唐诗", author: "彭定求等编", desc: "清代编纂的唐诗总集，收录唐诗近五万首。是中国诗歌的宝库，全面展现了唐诗的繁荣面貌。" },
  { title: "梦溪笔谈", author: "沈括", desc: "北宋沈括的笔记著作，被誉为「中国科学史上的里程碑」。记载了活字印刷、指南针等重大发明，涉及天文、数学、物理等领域。" },
  { title: "传习录", author: "王阳明", desc: "明代哲学家王阳明的语录和信件集，心学的核心文本。「知行合一」「致良知」等思想，影响了整个东亚思想界。" },
  { title: "菜根谭", author: "洪应明", desc: "明代处世奇书，以语录体形式阐述人生哲理。「咬得菜根，百事可做」的坚韧，融合儒释道三家智慧，是修身处世的经典。" },
  { title: "围炉夜话", author: "王永彬", desc: "清代处世三大奇书之一。「宠辱不惊，闲看庭前花开花落」的豁达，语言简练、寓意深刻，是传统修身读物中平易近人的代表。" },
  { title: "小窗幽记", author: "陈继儒", desc: "明代修身养性之作。「闭门即是深山，读书随处净土」的清雅，融合了隐逸情怀与生活美学，是明清小品文的代表。" },
  { title: "颜氏家训", author: "颜之推", desc: "中国第一部系统的家训著作。以儒家思想教育子孙，涉及修身、治家、处事、为学等方面，被誉为「家训之祖」。" },
  { title: "明夷待访录", author: "黄宗羲", desc: "明末清初思想家黄宗羲的政治论著。提出「天下为主，君为客」的进步思想，批判君主专制，是中国早期启蒙思想的代表作。" },
  { title: "日知录", author: "顾炎武", desc: "清代学者顾炎武的读书笔记。「天下兴亡，匹夫有责」的思想渊源，是考据学的开山之作。" },
  { title: "文史通义", author: "章学诚", desc: "清代史学理论名著，提出「六经皆史」的观点。系统论述史学理论与方法，是中国古代史学理论的集大成之作。" },
  { title: "骆驼祥子", author: "老舍", desc: "老舍代表作，讲述北平人力车夫祥子从满怀希望到最终堕落的人生历程。语言京味浓郁，是中国现代文学的现实主义杰作。" },
  { title: "围城", author: "钱钟书", desc: "一部讽刺小说经典。「婚姻是一座围城，城外的人想进去，城里的人想出来」成为传世名言，语言机智幽默、比喻精妙。" },
  { title: "平凡的世界", author: "路遥", desc: "以陕北农村为背景，描绘了孙少安、孙少平兄弟在时代变革中的奋斗历程。获茅盾文学奖，讴歌了普通人在困境中不屈不挠的精神。" },
  { title: "活着", author: "余华", desc: "一部讲述苦难与生命韧性的当代经典。主人公福贵经历了人生巨变，亲人相继离世，却始终坚强地活着。" },
  { title: "城南旧事", author: "林海音", desc: "以小女孩英子的视角，回忆上世纪二十年代北京城南的童年往事。文笔温柔细腻，乡愁弥漫，是了解老北京的风情画卷。" },
  { title: "呐喊", author: "鲁迅", desc: "鲁迅短篇小说集，收录《狂人日记》《阿Q正传》《孔乙己》等名篇。以犀利的笔触揭露国民劣根性，是中国现代文学的开山之作。" },
  { title: "边城", author: "沈从文", desc: "以湘西小城茶峒为背景，描写少女翠翠的纯真爱情。文笔优美、意境深远，是田园牧歌式的文学经典。" },
  { title: "茶馆", author: "老舍", desc: "老舍话剧代表作，以北京裕泰茶馆为场景，展现了清末、民国、抗战后三个时期的社会变迁，是中国话剧的巅峰之作。" },
  { title: "雷雨", author: "曹禺", desc: "中国现代话剧的奠基之作。以周公馆为舞台，揭露了封建家庭的罪恶与矛盾，情节紧凑、冲突激烈。" },
  { title: "家", author: "巴金", desc: "巴金「激流三部曲」之一，描写四川封建大家庭的衰落。以觉慧的觉醒和抗争为主线，是「五四」后青年反抗封建礼教的代表作。" },
  { title: "百年孤独", author: "加西亚·马尔克斯", desc: "魔幻现实主义文学的代表作，讲述了布恩迪亚家族七代人的传奇故事和马孔多小镇的百年兴衰。1982年诺贝尔文学奖获奖作品。" },
  { title: "小王子", author: "圣埃克苏佩里", desc: "一部写给大人的童话。「真正重要的东西，用眼睛是看不见的」，通过小王子的星际旅行，揭示了爱、责任与生命的真谛。" },
  { title: "简·爱", author: "夏洛蒂·勃朗特", desc: "一部具有自传色彩的女性成长小说。简·爱追求平等、自由与真爱的精神，是英国文学史上的经典之作。" },
  { title: "老人与海", author: "海明威", desc: "海明威获诺贝尔奖的代表作。「人可以被毁灭，但不能被打败」的硬汉精神，是20世纪最伟大的中篇小说之一。" },
  { title: "了不起的盖茨比", author: "菲茨杰拉德", desc: "美国「爵士时代」的挽歌。揭示了「美国梦」的虚幻与物质时代的空虚，被公认为美国文学经典。" },
  { title: "钢铁是怎样炼成的", author: "奥斯特洛夫斯基", desc: "苏联文学经典。主人公保尔·柯察金磨炼出钢铁般的意志，「不因虚度年华而悔恨」的名句影响了几代人。" },
  { title: "悲惨世界", author: "雨果", desc: "法国文学巨匠雨果的代表作。冉阿让从苦役犯到正直市长的转变，展现了人性的救赎与社会的不公，是浪漫主义文学的丰碑。" },
  { title: "战争与和平", author: "列夫·托尔斯泰", desc: "俄罗斯文学巨著，以拿破仑战争为背景，描绘了俄国上流社会与普通民众的生活。场面宏大、人物众多，是世界文学史上最伟大的小说之一。" },
  { title: "傲慢与偏见", author: "简·奥斯汀", desc: "英国文学经典，描写伊丽莎白与达西先生的爱情故事。以机智幽默的笔调讽刺了当时社会的婚姻观和阶级观念。" },
  { title: "巴黎圣母院", author: "雨果", desc: "法国浪漫主义文学代表作。敲钟人卡西莫多的外表丑陋与内心善良形成鲜明对比，揭示了美丑善恶的深刻主题。" },
  { title: "韩非子", author: "韩非", desc: "法家思想集大成之作，融合法、术、势三家。提出「以法为教，以吏为师」，主张严刑峻法、君主集权。说理精密、寓言生动，「守株待兔」「滥竽充数」等典故出自于此。" },
  { title: "墨子", author: "墨翟", desc: "墨家学派创始人著作，提出「兼爱」「非攻」「尚贤」「节用」等主张。墨家注重逻辑与实践，在先秦与儒家并称「显学」，是中国古代少有的平民哲学。" },
  { title: "荀子", author: "荀况", desc: "儒家现实主义代表，提出「性恶论」，强调后天教化与礼法约束。「青出于蓝而胜于蓝」「不积跬步无以至千里」等名言流传千古，其学生韩非、李斯深刻影响了秦统一。" },
  { title: "鬼谷子", author: "鬼谷子", desc: "纵横家经典，论述游说、谋略与权术之学。内容涉及纵横捭阖、揣摩人心之道，被誉为「智慧的禁果，旷世奇书」，对理解战国纵横之术和政治谋略有重要价值。" },
  { title: "管子", author: "管仲", desc: "托名管仲的综合性著作，涵盖政治、经济、军事、哲学。提出「仓廪实而知礼节，衣食足而知荣辱」的唯物主义观点，是研究先秦经济思想的重要文献。" },
  { title: "晏子春秋", author: "佚名", desc: "记录春秋齐国名相晏婴言行轶事的故事集。晏子使楚的机智、二桃杀三士的巧计，展现了政治家的智慧与风骨，叙事生动，是先秦叙事散文的代表。" },
  { title: "商君书", author: "商鞅", desc: "法家代表作，记录商鞅变法的理论与措施。主张废井田、开阡陌、重农抑商、严刑峻法，奠定了秦国富国强兵的基础，是了解法家思想和秦制的重要文本。" },
  { title: "吕氏春秋", author: "吕不韦编", desc: "战国末年杂家代表作，汇集诸子百家之说。「刻舟求剑」「掩耳盗铃」等寓言出此。以「兼儒墨，合名法」为特色，试图统一思想，是先秦百科全书式的著作。" },
  { title: "公羊传", author: "公羊高", desc: "春秋三传之一，着重阐释《春秋》的微言大义。以问答体解经，强调尊王攘夷、大一统思想，是汉代公羊学的理论基础，对后世政治哲学影响深远。" },
  { title: "谷梁传", author: "谷梁赤", desc: "春秋三传之一，以义理为主解读《春秋》。与《左传》重叙事、《公羊传》重微言不同，《谷梁传》注重礼制评判与道德训诫，是儒家经典的重要组成部分。" },
  { title: "尔雅", author: "佚名", desc: "中国最早的词典，是解释词义、名物的训诂学奠基之作。分为释诂、释言、释训等十九类，被列入「十三经」，是阅读先秦古籍的重要工具书。" },
  { title: "山海经", author: "佚名", desc: "中国上古神话宝库，记载山川地理、神祇异兽、远方民俗。精卫填海、夸父追日、刑天舞干戚等神话出自此书，是研究上古神话、地理和民俗的百科全书。" },
  { title: "水经注", author: "郦道元", desc: "北魏地理名著，为《水经》作注。记录了1252条河流的地理、历史、民俗，文笔优美，「三峡」等篇章被视为山水散文典范，是地理学与文学的双重经典。" },
  { title: "洛阳伽蓝记", author: "杨衒之", desc: "北魏散文著作，记录洛阳佛寺的兴废。以佛寺为线索展现北魏政治文化，文笔绮丽、叙事简练，与《水经注》《世说新语》并称北朝三部奇书。" },
  { title: "九章算术", author: "张苍等", desc: "中国古代数学经典，标志着中国古代数学体系的形成。全书分九章，涵盖算术、代数、几何，提出方程、正负数等概念，在世界数学史上占有重要地位。" },
  { title: "黄帝内经", author: "佚名", desc: "中国最早的医学典籍，中医理论奠基之作。分《素问》《灵枢》两部分，论述阴阳五行、脏腑经络、养生防病之理，被誉为「医之始祖」，至今仍指导中医实践。" },
  { title: "伤寒论", author: "张仲景", desc: "东汉医学名著，确立了辨证论治的原则。记载113首方剂，被尊为「方书之祖」，是中医临床医学的基石，对后世医学发展影响极其深远。" },
  { title: "本草纲目", author: "李时珍", desc: "明代医药学巨著，收录药物1892种、方剂11096首。分类科学、内容详实，被誉为「东方药学巨典」，被达尔文称为「中国古代百科全书」，2011年入选世界记忆名录。" },
  { title: "天工开物", author: "宋应星", desc: "明代科技百科全书，系统记录农业、手工业技术。涵盖纺织、陶瓷、冶炼、造纸等十八个领域，被誉为「中国17世纪的工艺百科全书」，是了解古代科技的重要文献。" },
  { title: "徐霞客游记", author: "徐弘祖", desc: "明代地理考察记录，记载作者三十年间游历大半中国的所见所闻。对喀斯特地貌的考察早于欧洲两百年，文笔生动，是地理学和文学的双重杰作。" },
  { title: "东京梦华录", author: "孟元老", desc: "南宋追忆北宋东京开封城市生活的笔记。详记街巷、节令、民俗、饮食，宛如一幅文字版《清明上河图》，是研究宋代城市生活和社会风俗的重要文献。" },
  { title: "梦粱录", author: "吴自牧", desc: "南宋笔记，记述南宋都城临安（杭州）的城市面貌与市民生活。与《东京梦华录》《武林旧事》并称宋代城市生活笔记，是研究南宋社会的重要史料。" },
  { title: "武林旧事", author: "周密", desc: "南宋遗民回忆录，追记南宋临安的典制、风俗与节令。内容翔实、情感深沉，既是珍贵的城市生活史料，也寄托了故国之思，是宋人笔记的佳作。" },
  { title: "容斋随笔", author: "洪迈", desc: "南宋笔记小说，内容涉及经史百家、诗词文章、典章制度。考证精审、议论独到，被毛泽东一生喜爱，是宋代学术笔记的代表作。" },
  { title: "困学纪闻", author: "王应麟", desc: "南宋学术笔记，涉及经史、天文、地理、诗文。考证精博，与《容斋随笔》《梦溪笔谈》并称宋代三大笔记，是考据学的先驱之作。" },
  { title: "三字经", author: "王应麟", desc: "中国古代蒙学经典，三字一句、朗朗上口。「人之初，性本善」开篇，涵盖伦理、历史、天文、地理等知识，是流传最广的启蒙读物，被誉为「蒙学之冠」。" },
  { title: "千字文", author: "周兴嗣", desc: "南朝梁蒙学经典，千字不重。「天地玄黄，宇宙洪荒」开篇，涵盖天文地理、历史伦理，书法与文学兼备，是历代蒙学和书法练习的经典文本。" },
  { title: "弟子规", author: "李毓秀", desc: "清代蒙学读物，以《论语》「弟子入则孝」为纲。规范孝悌、谨信、爱众、亲仁、学文等行为准则，是传统家教育和儿童启蒙的重要读物。" },
  { title: "增广贤文", author: "佚名", desc: "明代民间谚语集锦，汇集为人处世的格言警句。「近水楼台先得月」「善有善报」等俗语广为流传，雅俗共赏，是了解中国传统人生智慧的大众读物。" },
  { title: "了凡四训", author: "袁了凡", desc: "明代家训，以作者亲身经历阐明「命自我立」的道理。分立命之学、改过之法、积善之方、谦德之效四篇，融儒释道于一体，是改变命运的励志经典。" },
  { title: "幼学琼林", author: "程允升", desc: "明清蒙学经典，被誉为「中国古代百科全书」。以骈文形式介绍天文地理、历史人物、典章制度，「读了幼学走天下」，是古代知识普及的重要读物。" },
  { title: "声律启蒙", author: "车万育", desc: "清代蒙学经典，训练对仗与声律的入门读物。「云对雨，雪对风，晚照对晴空」朗朗上口，是学习诗词对仗、感受汉语音韵之美的最佳启蒙书。" },
  { title: "笠翁对韵", author: "李渔", desc: "清代学习对仗对韵的读物，与《声律启蒙》齐名。「天对地，雨对风，大陆对长空」，包罗万象、音韵和谐，是诗词入门和对联写作的经典教材。" },
  { title: "闲情偶寄", author: "李渔", desc: "清代生活美学经典，论述戏曲、园林、饮食、养生等。被誉为中国人的「生活艺术指南」，是了解明清文人生活情趣和审美品味的必读之作。" },
  { title: "随园食单", author: "袁枚", desc: "清代美食经典，记录了三百余道菜肴的烹饪方法。从选材到火候，从调料到器皿，讲究精致，是古代烹饪理论的集大成之作，被誉为「厨者的经典」。" },
  { title: "红楼梦脂评本", author: "曹雪芹、脂砚斋", desc: "《红楼梦》带有脂砚斋批注的版本。脂批提供了大量关于作者意图、人物命运和八十回后情节的线索，是红学研究的核心文献，对理解原著有不可替代的价值。" },
  { title: "东周列国志", author: "冯梦龙、蔡元放", desc: "清代历史演义小说，讲述西周末年到秦始皇统一六国五百多年历史。春秋五霸、战国七雄的故事波澜壮阔，是了解先秦历史的通俗读物。" },
  { title: "隋唐演义", author: "褚人获", desc: "清代历史演义小说，以隋末农民起义到唐玄宗时期为背景。秦琼、程咬金、单雄信等英雄形象生动，是了解隋唐历史的通俗读物。" },
  { title: "说岳全传", author: "钱彩", desc: "清代英雄演义小说，讲述岳飞抗金的故事。岳母刺字、风波亭等情节感人至深，岳飞精忠报国的精神影响深远，是民间流传最广的英雄传奇之一。" },
  { title: "杨家将演义", author: "熊大木", desc: "明代英雄演义小说，讲述北宋杨家将抗辽的故事。穆桂英挂帅、四郎探母等情节脍炙人口，杨家满门忠烈的形象深入人心，是民间英雄文学的代表作。" },
  { title: "七侠五义", author: "石玉昆", desc: "清代公案侠义小说，包公断案与展昭等侠客的故事。开创了公案与侠义合流的小说类型，情节曲折、人物鲜明，是清代通俗小说的代表。" },
  { title: "儿女英雄传", author: "文康", desc: "清代侠义小说，讲述侠女十三妹何玉凤的故事。融合侠义与儿女情长，语言京味纯正，是清代满族文学的代表，对后世京味小说有影响。" },
  { title: "海上花列传", author: "韩邦庆", desc: "清末吴语小说，以上海租界为背景描写妓院生活。是中国第一部用方言写作的长篇小说，张爱玲推崇备至，胡适称为「吴语文学的第一部杰作」。" },
  { title: "三侠五义", author: "石玉昆", desc: "清代侠义公案小说经典，包拯断案与南侠展昭、北侠欧阳春等侠客的故事。人物生动、情节曲折，是公案侠义小说的代表作，影响后世武侠小说。" },
  { title: "好逑传", author: "名教中人", desc: "清代才子佳人小说，讲述铁中玉与水冰心的爱情故事。是少数被翻译到欧洲的中国古代小说，歌德曾给予关注，是中西文学交流史上的重要作品。" },
  { title: "老残游记续集", author: "刘鹗", desc: "晚清谴责小说《老残游记》的续篇。继续以江湖医生老残的视角揭露晚清社会黑暗，描写更加辛辣，是研究晚清社会和文学变革的重要文本。" },
  { title: "孽海花续编", author: "曾朴", desc: "晚清谴责小说《孽海花》的续编。继续以金雯青与傅彩云的故事为线索，描绘晚清外交与社会风情，是了解晚清社会的文学窗口。" },
  { title: "二十年目睹之怪现状", author: "吴趼人", desc: "晚清四大谴责小说之一，以「九死一生」的视角记录晚清社会怪现状。涉及官场、商场、洋场等各领域，讽刺辛辣，是了解晚清社会的文学窗口。" },
  { title: "罪与罚", author: "陀思妥耶夫斯基", desc: "俄罗斯文学巨著。穷大学生拉斯柯尔尼科夫杀死放高利贷的老太婆后，在良心的折磨中挣扎救赎。深刻探讨了罪与罚、善与恶的哲学命题，是心理小说的巅峰。" },
  { title: "卡拉马佐夫兄弟", author: "陀思妥耶夫斯基", desc: "陀思妥耶夫斯基的封笔之作。以卡拉马佐夫父子间的矛盾为中心，探讨了信仰、自由、道德等终极问题，被誉为「世界上最伟大的小说之一」。" },
  { title: "安娜·卡列尼娜", author: "列夫·托尔斯泰", desc: "托尔斯泰代表作。贵族女子安娜追求爱情却最终走向毁灭。「幸福的家庭都是相似的，不幸的家庭各有各的不幸」开篇即成经典，是现实主义文学的丰碑。" },
  { title: "复活", author: "列夫·托尔斯泰", desc: "托尔斯泰晚年代表作。聂赫留朵夫公爵在法庭上重逢被自己始乱终弃的玛丝洛娃，良知觉醒后决心赎罪。深刻批判了沙俄社会的不公与虚伪。" },
  { title: "童年", author: "高尔基", desc: "高尔基自传体三部曲之一。以少年阿廖沙的视角，描绘了在外祖父家度过的苦难童年。展现了俄罗斯底层人民的苦难与坚韧，是苏联文学的奠基之作。" },
  { title: "静静的顿河", author: "肖洛霍夫", desc: "苏联文学巨著。以哥萨克人格里高利在革命与内战中的命运为主线，描绘了顿河哥萨克的历史变迁。1965年诺贝尔文学奖获奖作品。" },
  { title: "日瓦戈医生", author: "帕斯捷尔纳克", desc: "苏联文学经典。以日瓦戈医生在革命和内战中的经历，展现了知识分子在历史巨变中的命运。1958年诺贝尔文学奖获奖作品。" },
  { title: "伊利亚特", author: "荷马", desc: "古希腊史诗，讲述特洛伊战争中阿喀琉斯的愤怒与战斗。是西方文学的源头之作，描绘了英雄主义与命运的主题，影响了两千多年的西方文学。" },
  { title: "奥德赛", author: "荷马", desc: "古希腊史诗，讲述奥德修斯在特洛伊战争后历经十年磨难返乡的故事。充满了冒险与奇幻，是西方文学中回归主题的原型，影响深远。" },
  { title: "神曲", author: "但丁", desc: "中世纪文学巅峰之作。但丁游历地狱、炼狱、天堂的旅程，融合神学、哲学与诗歌，是意大利文学的奠基之作，标志着中世纪向文艺复兴的过渡。" },
  { title: "十日谈", author: "薄伽丘", desc: "意大利文艺复兴代表作。十个青年在瘟疫期间讲述的一百个故事，讽刺教会腐败、赞美爱情与人性，是欧洲第一部现实主义短篇小说集。" },
  { title: "君主论", author: "马基雅维利", desc: "西方政治学经典。论述君主如何获取和维持权力，提出「目的证明手段的正当性」等观点，开创了近代政治学，影响深远。" },
  { title: "堂吉诃德", author: "塞万提斯", desc: "西班牙文学巅峰。穷乡绅读骑士小说入迷，带着仆人桑丘四处冒险。以荒诞幽默讽刺骑士文学，被誉为「现代小说的开山之作」。" },
  { title: "哈姆雷特", author: "莎士比亚", desc: "莎士比亚最伟大的悲剧。「To be or not to be」的经典独白，王子为父报仇的故事，深刻探讨了生存、复仇与人性，是西方戏剧的巅峰。" },
  { title: "麦克白", author: "莎士比亚", desc: "莎士比亚四大悲剧之一。将军麦克白在野心和女巫预言的驱使下弑君篡位，最终走向毁灭。深刻揭示了权力贪欲对人性的腐蚀。" },
  { title: "李尔王", author: "莎士比亚", desc: "莎士比亚四大悲剧之一。老国王李尔分封国土后被女儿抛弃，在暴风雨中领悟真情。探讨了权力、亲情与人性的主题，震撼人心。" },
  { title: "奥赛罗", author: "莎士比亚", desc: "莎士比亚四大悲剧之一。摩尔人将军奥赛罗在奸人挑拨下掐死爱妻，得知真相后自刎。深刻揭示了嫉妒与轻信的毁灭性力量。" },
  { title: "威尼斯商人", author: "莎士比亚", desc: "莎士比亚喜剧代表作。夏洛克要求割肉还债的法庭对峙扣人心弦，探讨了仁慈、正义与偏见的主题，是莎翁最受欢迎的喜剧之一。" },
  { title: "仲夏夜之梦", author: "莎士比亚", desc: "莎士比亚浪漫喜剧。四对恋人在魔法森林中的爱情奇遇，穿插仙王仙后的争吵，充满了幻想与诗意，是莎翁最富诗意的喜剧。" },
  { title: "鲁滨逊漂流记", author: "笛福", desc: "英国文学经典。鲁滨逊在荒岛上独力生存28年，建造房屋、驯养动物、种植庄稼。展现了人类的勇气与智慧，是英国小说的开山之作。" },
  { title: "格列佛游记", author: "斯威夫特", desc: "英国讽刺文学经典。格列佛游历小人国、大人国、飞岛国、马国的奇遇，以夸张的想象讽刺了当时的政治与社会，是奇幻与讽刺的完美结合。" },
  { title: "大卫·科波菲尔", author: "狄更斯", desc: "狄更斯半自传体小说。孤儿大卫历经磨难最终成为作家的故事，塑造了众多鲜活的人物形象，是维多利亚时代英国社会的生动画卷。" },
  { title: "雾都孤儿", author: "狄更斯", desc: "狄更斯代表作。孤儿奥利弗在济贫院和贼窝中的苦难经历，揭露了维多利亚时代英国底层的黑暗与不公，是社会批判小说的经典。" },
  { title: "双城记", author: "狄更斯", desc: "狄更斯历史小说。「这是最好的时代，这是最坏的时代」开篇，以法国大革命为背景，展现了爱与牺牲的主题，是狄更斯最宏大的作品。" },
  { title: "远大前程", author: "狄更斯", desc: "狄更斯晚期杰作。孤儿匹普意外获得遗产后迷失自我，最终领悟人生真谛。是成长小说的经典，情节曲折、人物丰满。" },
  { title: "呼啸山庄", author: "艾米莉·勃朗特", desc: "英国文学经典。希斯克利夫与凯瑟琳狂暴而绝望的爱情，跨越生死，充满了哥特式的激情与复仇。是勃朗特三姐妹中最具震撼力的作品。" },
  { title: "爱玛", author: "简·奥斯汀", desc: "简·奥斯汀小说。爱玛热衷做媒却弄巧成拙，最终在曲折中找到自己的爱情。以细腻的笔触描绘了英国乡绅阶层的日常生活。" },
  { title: "德伯家的苔丝", author: "哈代", desc: "英国文学悲剧经典。纯洁的农村姑娘苔丝被命运和社会偏见一步步推向毁灭。哈代以深切的同情描绘了底层女性的苦难，震撼人心。" },
  { title: "化身博士", author: "斯蒂文森", desc: "英国心理小说经典。杰基尔博士通过实验分离出自己邪恶的一面——海德先生，最终失控。探讨了人性的善恶两面，影响深远。" },
  { title: "金银岛", author: "斯蒂文森", desc: "英国冒险小说经典。少年吉姆偶然得到藏宝图，与海盗约翰斗智斗勇寻宝。是海盗文学的开山之作，影响了无数冒险小说。" },
  { title: "月亮与六便士", author: "毛姆", desc: "毛姆代表作。以画家高更为原型，讲述证券经纪人思特里克兰德抛弃一切追求绘画理想的传奇故事。探讨了理想与现实、艺术与世俗的主题。" },
  { title: "人性的枷锁", author: "毛姆", desc: "毛姆半自传体小说。跛脚少年菲利普从束缚走向自由的精神成长历程，探讨了宗教、爱情、艺术和人生意义，是毛姆最重要的作品。" },
  { title: "1984", author: "乔治·奥威尔", desc: "反乌托邦文学经典。「老大哥在看着你」，描绘了极权统治下的恐怖世界。对监控、思想控制、语言篡改的描写令人不寒而栗，是20世纪最有影响力的小说之一。" },
  { title: "动物农场", author: "乔治·奥威尔", desc: "政治寓言经典。动物们推翻人类统治后，猪逐渐篡夺权力，「所有动物一律平等，但有些动物比其他动物更平等」。以寓言揭示权力腐蚀的真理。" },
  { title: "华氏451度", author: "布拉德伯里", desc: "反乌托邦小说经典。在未来社会，消防员的职责是烧书。主人公蒙塔格从焚书者变成读书者，探讨了审查制度与思想自由的主题。" },
  { title: "麦田里的守望者", author: "塞林格", desc: "美国文学经典。少年霍尔顿被学校开除后在纽约游荡三天，以叛逆的眼光审视成人世界的虚伪。是青春文学的代表作，影响了一代又一代年轻人。" },
  { title: "永别了，武器", author: "海明威", desc: "海明威一战题材小说。美国青年亨利与英国护士凯瑟琳在战争中相爱却最终悲剧。以冷静的笔调描绘了战争的残酷与爱情的无力。" },
  { title: "飘", author: "玛格丽特·米切尔", desc: "美国南北战争史诗。斯佳丽从娇小姐到坚强女性的蜕变，与白瑞德的爱情纠葛。「明天又是新的一天」成为经典名言。获普利策奖。" },
  { title: "杀死一只知更鸟", author: "哈珀·李", desc: "美国文学经典。律师阿迪克斯为被诬告的黑人辩护，以孩子的视角展现了种族偏见与正义的冲突。获普利策奖，是美国中学必读书目。" },
  { title: "愤怒的葡萄", author: "斯坦贝克", desc: "美国文学经典。大萧条时期乔德一家从俄克拉荷马迁徙到加州的苦难历程。描绘了底层人民的坚韧与团结，获普利策奖和诺贝尔奖。" },
  { title: "红与黑", author: "司汤达", desc: "法国文学经典。木匠之子于连在复辟时代凭借才智和虚伪攀附权贵，最终走向毁灭。深刻描绘了阶层固化的社会现实，是心理现实主义的开山之作。" },
  { title: "包法利夫人", author: "福楼拜", desc: "法国文学经典。爱玛对浪漫爱情的幻想与平庸现实的冲突，最终走向毁灭。福楼拜以「一字说」的精炼文风，开创了现代小说的叙事技巧。" },
  { title: "茶花女", author: "小仲马", desc: "法国文学经典。交际花玛格丽特与青年阿尔芒的爱情被世俗偏见毁灭。以深切的同情描绘了被社会唾弃的女性，影响深远。" },
  { title: "基督山伯爵", author: "大仲马", desc: "法国冒险小说经典。水手唐泰斯被陷害入狱14年后越狱复仇。情节曲折、跌宕起伏，是复仇文学的巅峰之作，影响了无数后世作品。" },
  { title: "三个火枪手", author: "大仲马", desc: "法国历史冒险小说。达达尼昂与三个火枪手的忠诚与冒险。充满了剑客的浪漫与宫廷阴谋，是法国最受欢迎的通俗小说之一。" },
  { title: "海底两万里", author: "凡尔纳", desc: "法国科幻小说经典。尼摩船长驾驶鹦鹉螺号潜艇在海底探险。充满了科学想象力和冒险精神，是科幻文学的先驱之作。" },
  { title: "八十天环游地球", author: "凡尔纳", desc: "法国冒险小说。福格先生与人打赌八十天环游地球，一路历经奇遇。展现了维多利亚时代的科技乐观精神，是凡尔纳最受欢迎的作品之一。" },
  { title: "西京杂记", author: "葛洪", desc: "西汉轶事笔记，记录长安宫廷与民间故事。昭君出塞、卓文君私奔等典故出此，文笔简洁，是研究西汉社会风俗的重要笔记。" },
  { title: "朝花夕拾", author: "鲁迅", desc: "鲁迅散文集，回忆童年与青年时代的生活。从百草园到三味书屋、藤野先生等篇章温馨深情，是了解鲁迅成长历程的必读之作。" },
  { title: "少年维特之烦恼", author: "歌德", desc: "德国文学经典。少年维特爱上已订婚的绿蒂，在绝望中自杀。以书信体写就，掀起整个欧洲的「维特热」，是狂飙突进运动的代表作。" },
  { title: "浮士德", author: "歌德", desc: "歌德毕生巨著。学者浮士德与魔鬼梅菲斯特签约，以灵魂换取知识与体验。涵盖了哲学、神学、文学等广阔领域，是德国文学的巅峰。" },
  { title: "蝇王", author: "戈尔丁", desc: "英国寓言小说。一群儿童流落荒岛后逐渐堕落为野蛮人。以寓言形式揭示人性的黑暗面，1983年诺贝尔文学奖获奖作品。" },

];

async function fetchDailyBook() {
  const el = $('#dailyBook');
  if (!el) return;
  // 用日期种子选书，同一天同一本
  const book = CLASSIC_BOOKS[dailySeed() % CLASSIC_BOOKS.length];
  renderDailyBook(book);
}
function renderDailyBook(b) {
  const el = $('#dailyBook');
  if (!el) return;
  el.innerHTML = `
    <div class="book-title">${escapeHtml(b.title)}</div>
    <div class="book-author">作者：${escapeHtml(b.author)}</div>
    <div class="book-desc">${escapeHtml(b.desc)}</div>
  `;
}

/* =========================================================================
 * 模块 2：今日头条
 * ========================================================================= */

// 降级新闻（news.json 加载失败时显示）
const FALLBACK_NEWS = [
  { tag: '国际', cls: 'tag-intl', title: '国际新闻加载中，请稍后刷新', url: 'https://www.chinanews.com.cn/gj/' },
  { tag: '体育', cls: 'tag-sports', title: '体育新闻加载中，请稍后刷新', url: 'https://www.chinanews.com.cn/ty/' },
  { tag: '财经', cls: 'tag-finance', title: '财经新闻加载中，请稍后刷新', url: 'https://www.chinanews.com.cn/cj/' },
  { tag: '教育', cls: 'tag-edu', title: '教育新闻加载中，请稍后刷新', url: 'https://www.chinanews.com.cn/edu/' },
  { tag: '娱乐', cls: 'tag-entertain', title: '娱乐新闻加载中，请稍后刷新', url: 'https://www.chinanews.com.cn/cul/' },
  { tag: '国内', cls: 'tag-domestic', title: '国内新闻加载中，请稍后刷新', url: 'https://www.chinanews.com.cn/gn/' },
];

// 实时行情配置（腾讯财经接口，支持浏览器 CORS）
const MARKET_CODES = [
  { name: '上证指数', code: 'sh000001' },
  { name: '深证成指', code: 'sz399001' },
  { name: '创业板指', code: 'sz399006' },
  { name: '沪深300', code: 'sh000300' },
];

function renderHeadline() {
  return `
    <div class="card">
      <div class="card-title"><span class="ico">📰</span>新闻速览 <span style="font-size:11px;color:var(--text-mute);font-weight:400;margin-left:6px;" id="newsStatus">加载中…</span> <button class="btn btn-ghost btn-sm" style="margin-left:6px;padding:3px 10px;font-size:11px;" onclick="fetchNews(true)">🔄 刷新</button></div>
      <div class="news-list" id="newsList">
        ${FALLBACK_NEWS.map(n => `
          <a class="news-item" href="${safeUrl(n.url)}" target="_blank" rel="noopener">
            <span class="news-tag ${n.cls}">${n.tag}</span>
            <span class="news-title">${escapeHtml(n.title)}</span>
          </a>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="ico">📈</span>股市行情</div>
      <div class="market-grid" id="marketGrid">
        ${MARKET_CODES.map(m => `
          <div class="market-card" data-code="${escapeAttr(m.code)}">
            <div class="market-name">${escapeHtml(m.name)}</div>
            <div class="market-value">加载中…</div>
            <div class="market-change">—</div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--text-mute);">数据实时更新，仅供参考</div>
    </div>
  `;
}

// RSS 源配置（中新网各分类，链接中国可访问）
const NEWS_RSS_FEEDS = [
  { rss: 'https://www.chinanews.com.cn/rss/world.xml',   tag: '国际', cls: 'tag-intl' },
  { rss: 'https://www.chinanews.com.cn/rss/sports.xml',  tag: '体育', cls: 'tag-sports' },
  { rss: 'https://www.chinanews.com.cn/rss/finance.xml', tag: '财经', cls: 'tag-finance' },
  { rss: 'https://www.chinanews.com.cn/rss/edu.xml',     tag: '教育', cls: 'tag-edu' },
  { rss: 'https://www.chinanews.com.cn/rss/scroll-news.xml', tag: '综合', cls: 'tag-domestic' },
];

// RSS 代理列表（按优先级轮换）
const NEWS_RSS_PROXIES = [
  rss => 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rss),
  rss => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(rss),
];

// 缓存：避免频繁请求触发限流
let _newsCache = null;
let _newsCacheTime = 0;
const NEWS_CACHE_TTL = 30 * 60 * 1000; // 30 分钟

afterRender.headline = () => { fetchMarkets(); fetchNews(); };

// 拉取实时新闻：2条国际 + 4条国内分类（体育/财经/教育/娱乐）
// 优先读取 GitHub Actions 生成的静态 news.json，失败时降级为实时 RSS 抓取
async function fetchNews(force = false) {
  const list = $('#newsList');
  const status = $('#newsStatus');
  if (!list) return;

  // 先用缓存快速渲染（非强制刷新时）
  if (!force && _newsCache && Date.now() - _newsCacheTime < NEWS_CACHE_TTL) {
    renderNews(list, status, _newsCache, '· 已缓存');
    return;
  }

  if (status) status.textContent = '· 加载中…';

  // 1. 优先尝试读取静态 news.json（由 GitHub Actions 定时生成）
  if (!force) {
    try {
      const res = await fetchWithRetry('news.json', {}, { retries: 2, timeout: 3000 });
      if (res.ok) {
        const data = await res.json();
        if (data && data.news && Array.isArray(data.news) && data.news.length >= 3) {
          _newsCache = data.news;
          _newsCacheTime = Date.now();
          renderNews(list, status, data.news, `· ${data.updated || '静态'}`);
          // 静态数据加载后，后台静默刷新实时数据（不阻塞渲染）
          fetchLiveNews(list, status, true);
          return;
        }
      }
    } catch (e) { /* 静态文件不存在或读取失败，继续走实时抓取 */ }
  }

  // 2. 实时 RSS 抓取
  await fetchLiveNews(list, status, force);
}

// 实时 RSS 抓取
async function fetchLiveNews(list, status, force) {
  try {
    // 并行请求所有 RSS 源（5秒超时）
    const [worldItems, sportsItems, financeItems, eduItems, scrollItems] = await Promise.all([
      fetchRSSItems(NEWS_RSS_FEEDS[0].rss),
      fetchRSSItems(NEWS_RSS_FEEDS[1].rss),
      fetchRSSItems(NEWS_RSS_FEEDS[2].rss),
      fetchRSSItems(NEWS_RSS_FEEDS[3].rss),
      fetchRSSItems(NEWS_RSS_FEEDS[4].rss),
    ]);

    const result = [];
    // 1. 国际新闻：取前2条
    worldItems.slice(0, 2).forEach(item => {
      result.push({ title: item.title, url: item.link, tag: '国际', cls: 'tag-intl' });
    });
    // 2. 国内分类：体育/财经/教育 各1条
    if (sportsItems[0]) result.push({ title: sportsItems[0].title, url: sportsItems[0].link, tag: '体育', cls: 'tag-sports' });
    if (financeItems[0]) result.push({ title: financeItems[0].title, url: financeItems[0].link, tag: '财经', cls: 'tag-finance' });
    if (eduItems[0]) result.push({ title: eduItems[0].title, url: eduItems[0].link, tag: '教育', cls: 'tag-edu' });

    // 3. 娱乐：从综合滚动新闻中筛选
    const ENTERTAIN_WORDS = ['电影','票房','明星','娱乐','音乐','综艺','演唱会','剧集','电视剧','演员','导演','歌手','出道','专辑','颁奖','影帝','影后','电影节','首映','定档','开播','收官','真人秀','偶像','选秀'];
    let entertainFound = false;
    for (const item of scrollItems) {
      if (ENTERTAIN_WORDS.some(w => item.title.includes(w))) {
        result.push({ title: item.title, url: item.link, tag: '娱乐', cls: 'tag-entertain' });
        entertainFound = true;
        break;
      }
    }
    if (!entertainFound && scrollItems[0]) {
      result.push({ title: scrollItems[0].title, url: scrollItems[0].link, tag: '国内', cls: 'tag-domestic' });
    }

    if (result.length < 3) throw new Error('not enough news: ' + result.length);

    _newsCache = result;
    _newsCacheTime = Date.now();
    renderNews(list, status, result, '· 已更新');
  } catch (e) {
    console.warn('新闻获取失败:', e);
    if (status) status.textContent = '· 请稍后刷新';
  }
}

function renderNews(list, status, news, msg) {
  list.innerHTML = news.map(n => `
    <a class="news-item" href="${safeUrl(n.url)}" target="_blank" rel="noopener">
      <span class="news-tag ${n.cls}">${n.tag}</span>
      <span class="news-title">${escapeHtml(n.title)}</span>
    </a>
  `).join('');
  if (status) status.textContent = msg;
}

// 通过代理获取 RSS items（带超时）
async function fetchRSSItems(rss) {
  for (const proxy of NEWS_RSS_PROXIES) {
    try {
      const url = proxy(rss);
      const res = await fetchWithRetry(url, {}, { retries: 3, timeout: 5000 });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        return data.items;
      }
      if (data.contents) {
        return parseRSSXML(data.contents);
      }
    } catch (e) { console.warn('RSS 获取失败:', rss, e); continue; }
  }
  return [];
}

// 解析 RSS XML（allorigins 返回原始 XML 时用）
function parseRSSXML(xmlText) {
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    return [...doc.querySelectorAll('item')].map(item => ({
      title: item.querySelector('title')?.textContent || '',
      link: item.querySelector('link')?.textContent || '',
    }));
  } catch { return []; }
}

// 拉取实时行情（带超时）
function fetchMarkets() {
  MARKET_CODES.forEach(m => {
    const url = `https://qt.gtimg.cn/q=${m.code}`;
    fetchWithRetry(url, {}, { retries: 2, timeout: 5000 })
      .then(r => r.text())
      .then(text => {
        const card = document.querySelector(`[data-code="${m.code}"]`);
        if (!card) return;
        const parsed = parseQuote(text, m);
        if (!parsed) { card.querySelector('.market-value').textContent = '暂无数据'; return; }
        card.classList.add(parsed.up ? 'up' : 'down');
        card.querySelector('.market-value').textContent = parsed.value;
        const chg = card.querySelector('.market-change');
        chg.textContent = (parsed.up ? '▲ ' : '▼ ') + parsed.change;
      })
      .catch(() => {
        const card = document.querySelector(`[data-code="${m.code}"]`);
        if (card) card.querySelector('.market-value').textContent = '获取失败';
      });
  });
}

// 解析腾讯行情数据
function parseQuote(text, m) {
  // 腾讯格式: v_sh000001="1~上证指数~000001~3828.47~3813.31~..."
  // 字段用 ~ 分隔：[3]=当前价 [4]=昨收价
  const match = text.match(/"([^"]+)"/);
  if (!match) return null;
  const fields = match[1].split('~');
  if (fields.length < 5) return null;

  const price = parseFloat(fields[3]);
  const prev = parseFloat(fields[4]);
  if (isNaN(price)) return null;
  const diff = price - prev;
  const pct = prev ? (diff / prev * 100) : 0;
  return { value: price.toLocaleString('zh-CN', {maximumFractionDigits: 2}), change: pct.toFixed(2) + '%', up: diff >= 0 };
}

/* =========================================================================
 * 模块 3：电子衣橱（虚拟试衣间）
 * ========================================================================= */

/* --- 数据操作 --- */
function getClothes() { return Store.get('wardrobe_items', []); }
function getCloth(id) { return getClothes().find(c => c.id === id); }
// getClothesRaw 是 getClothes 的别名，供迁移函数使用
const getClothesRaw = getClothes;
function safeSetClothes(arr) {
  try { localStorage.setItem('wardrobe_items', JSON.stringify(arr)); return true; }
  catch(e) { wdToast('存储空间不足，请删除一些旧衣物'); return false; }
}
function addCloth(item) {
  const arr = getClothes(); arr.push(item);
  if (safeSetClothes(arr)) return true; return false;
}
function updateCloth(id, patch) {
  const arr = getClothes();
  const i = arr.findIndex(c => c.id === id);
  if (i >= 0) { arr[i] = { ...arr[i], ...patch }; safeSetClothes(arr); }
}
async function deleteCloth(id) {
  // 删除 IndexedDB 中的图片
  try { await ImageDB.del(id); } catch (e) { console.warn('图片删除失败:', e); }
  const arr = getClothes().filter(c => c.id !== id);
  safeSetClothes(arr);
  // 清理穿搭记录中的引用
  const outfits = getOutfits();
  for (let d in outfits) {
    const o = outfits[d];
    let mainDeleted = false;
    ['topId','bottomId','onesieId'].forEach(k => { if (o[k] === id) { mainDeleted = true; } });
    if (mainDeleted) { delete outfits[d]; }
    else { ['outerwearId','shoesId','accessoryId'].forEach(k => { if (o[k] === id) o[k] = null; }); }
  }
  Store.set('wardrobe_outfits', outfits);
}
function getOutfits() { return Store.get('wardrobe_outfits', {}); }
function getOutfit(dateK) { return getOutfits()[dateK] || null; }
function saveOutfit(record) { const o = getOutfits(); o[record.date] = record; Store.set('wardrobe_outfits', o); }
function deleteOutfit(dateK) { const o = getOutfits(); delete o[dateK]; Store.set('wardrobe_outfits', o); }

/* --- 存储用量 --- */
function getStorageUsage() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    total += (localStorage.getItem(k) || '').length;
  }
  return Math.round(total / 1024); // KB
}
function getStorageRatio() { return Math.min(1, getStorageUsage() / 5120); }

// IndexedDB 图片存储用量估算（异步）
async function getImageStorageUsageKB() {
  try {
    const db = await ImageDB.init();
    return new Promise(resolve => {
      const tx = db.transaction('images', 'readonly');
      const store = tx.objectStore('images');
      const req = store.openCursor();
      let total = 0;
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          total += (cursor.value || '').length;
          cursor.continue();
        } else {
          resolve(Math.round(total * 3 / 4 / 1024)); // base64 → 实际 KB
        }
      };
      req.onerror = () => resolve(0);
    });
  } catch { return 0; }
}

/* --- 图片压缩 --- */
function estimateBase64Size(b64) { return Math.round(b64.length * 3 / 4 / 1024); }
function compressImage(dataUrl, maxDim, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
async function handleFileUpload(file) {
  if (!file || !file.type.startsWith('image/')) { wdToast('请选择图片文件'); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    // IndexedDB 无 5MB 限制，但仍压缩以保证性能（统一 800px / 0.75 质量）
    let maxDim = 800, quality = 0.75;
    let result = await compressImage(reader.result, maxDim, quality);
    if (!result) { wdToast('图片处理失败'); return; }
    // 适度压缩：如果仍超过 200KB，逐级降级
    while (estimateBase64Size(result) > 200) {
      if (quality > 0.4) { quality -= 0.15; }
      else if (maxDim > 400) { maxDim -= 100; quality = 0.55; }
      else break;
      result = await compressImage(reader.result, maxDim, quality);
      if (!result) break;
    }
    wdPendingImage = result;
    const prev = $('#wdUploadPreview');
    if (prev) { prev.src = result; prev.style.display = 'block'; }
    const ph = $('#wdUploadPlaceholder');
    if (ph) ph.style.display = 'none';
    const area = $('#wdUploadArea');
    if (area) area.classList.add('has-image');
  };
  reader.readAsDataURL(file);
}

/* --- 模态框 --- */
let wdPendingImage = null;
let wdFormState = { cat: null, color: null, season: [], style: null, editId: null };
let wdMatchState = { topId: null, bottomId: null };
let wdCalCursor = new Date();
let wdCalSelected = dateKey(new Date());

function showModal(title, contentHtml) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'wd-modal-overlay';
  overlay.id = 'wdModalOverlay';
  overlay.innerHTML = `
    <div class="wd-modal">
      <div class="wd-modal-header">
        <span class="wd-modal-title">${title}</span>
        <span class="wd-modal-close" onclick="closeModal()">✕</span>
      </div>
      <div class="wd-modal-body">${contentHtml}</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  return overlay;
}
function closeModal() { const o = $('#wdModalOverlay'); if (o) o.remove(); }

function wdToast(msg) {
  const t = document.createElement('div');
  t.className = 'wd-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

/* --- Tab 渲染 --- */
function renderWardrobe() {
  // 清理旧键
  if (localStorage.getItem('wardrobe_top') !== null) { localStorage.removeItem('wardrobe_top'); localStorage.removeItem('wardrobe_bottom'); }
  return `
    <div class="wardrobe-page">
      <div class="wd-tabs" id="wdTabs">
        <button class="wd-tab active" data-tab="closet" onclick="wdSwitchTab('closet')">我的衣橱</button>
        <button class="wd-tab" data-tab="match" onclick="wdSwitchTab('match')">智能搭配</button>
        <button class="wd-tab" data-tab="calendar" onclick="wdSwitchTab('calendar')">穿搭日历</button>
      </div>
      <div class="wd-tab-content" id="wdTabContent"></div>
    </div>
  `;
}

afterRender.wardrobe = () => {
  wdSwitchTab(Store.get('wardrobe_tab', 'closet'));
};

function wdSwitchTab(tab) {
  Store.set('wardrobe_tab', tab);
  $$('#wdTabs .wd-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  const content = $('#wdTabContent');
  if (!content) return;
  content.classList.remove('fade');
  void content.offsetWidth;
  content.classList.add('fade');
  if (tab === 'closet') content.innerHTML = renderClosetTab();
  else if (tab === 'match') content.innerHTML = renderMatchTab();
  else if (tab === 'calendar') content.innerHTML = renderCalendarTab();
  // 子绑定
  if (tab === 'closet') afterClosetTab();
  else if (tab === 'match') afterMatchTab();
  else if (tab === 'calendar') afterCalendarTab();
}

/* === Tab 1: 我的衣橱 === */
function renderClosetTab() {
  const clothes = getClothes();
  const filter = Store.get('wardrobe_filter', { category: 'all', color: 'all' });
  // 统计
  const stats = { total: clothes.length, cats: {}, colors: {} };
  clothes.forEach(c => {
    stats.cats[c.category] = (stats.cats[c.category] || 0) + 1;
    stats.colors[c.color] = (stats.colors[c.color] || 0) + 1;
  });
  const topColor = Object.entries(stats.colors).sort((a,b) => b[1]-a[1])[0];
  // 筛选标签
  const catChips = ['all', ...Object.keys(CAT_LABELS)].map(k =>
    `<button class="wd-filter-chip ${filter.category===k?'active':''}" onclick="wdFilterSet('category','${k}')">${k==='all'?'全部':CAT_LABELS[k]}</button>`
  ).join('');
  const colorChips = ['all', ...Object.keys(COLOR_LABELS)].map(k =>
    `<button class="wd-filter-chip wd-filter-color-chip ${filter.color===k?'active':''}" onclick="wdFilterSet('color','${k}')" title="${k==='all'?'全部':COLOR_LABELS[k]}">
      ${k==='all' ? '全' : `<span class="wd-color-dot" style="background:${COLOR_SWATCHES[k]}"></span>`}
    </button>`
  ).join('');
  // 筛选衣物
  const filtered = clothes.filter(c =>
    (filter.category === 'all' || c.category === filter.category) &&
    (filter.color === 'all' || c.color === filter.color)
  );
  // 存储用量（localStorage 元数据 + IndexedDB 图片）
  const lsUsageKB = getStorageUsage();
  const lsMB = (lsUsageKB / 1024).toFixed(1);

  return `
    <div class="wd-stats">
      <div class="wd-stat-item"><span class="wd-stat-num">${stats.total}</span><span class="wd-stat-label">件单品</span></div>
      ${Object.entries(stats.cats).map(([k,v]) => `<div class="wd-stat-item"><span class="wd-stat-num">${v}</span><span class="wd-stat-label">${CAT_LABELS[k]}</span></div>`).join('')}
      ${topColor ? `<div class="wd-stat-item"><span class="wd-stat-label">主色</span><span class="wd-stat-num" style="font-size:14px;">${COLOR_LABELS[topColor[0]]}</span></div>` : ''}
    </div>
    <div class="wd-storage-info" id="wdStorageInfo">
      <span>存储：元数据 ${lsMB}MB · 图片 <span id="wdImgUsage">计算中…</span></span>
    </div>
    <div class="wd-toolbar">
      <button class="btn wd-add-btn" onclick="openAddForm()">+ 添加衣物</button>
    </div>
    <div class="wd-filters">
      <div class="wd-filter-group">${catChips}</div>
      <div class="wd-filter-group">${colorChips}</div>
    </div>
    <div class="wd-grid" id="wdGrid">
      ${filtered.length === 0
        ? `<div class="wd-empty"><div class="wd-empty-icon">👗</div><p>${clothes.length===0?'衣橱还是空的，添加第一件衣物吧～':'没有符合条件的衣物'}</p>${clothes.length===0?'<button class="btn" onclick="openAddForm()">+ 添加衣物</button>':''}</div>`
        : filtered.map(c => `
          <div class="wd-card" onclick="openClothDetail('${c.id}')">
            <div class="wd-card-img" data-img="${c.img}"></div>
            <div class="wd-card-info">
              <span class="wd-card-cat">${CAT_LABELS[c.category]}</span>
              <span class="wd-card-color" style="background:${COLOR_SWATCHES[c.color]}"></span>
            </div>
          </div>`).join('')
      }
    </div>
  `;
}

async function afterClosetTab() {
  // 异步加载所有衣物图片 + 存储用量
  const entries = $$('#wdGrid .wd-card-img[data-img]').map(el => ({ el, src: el.dataset.img }));
  fillImgs(entries);
  const imgKB = await getImageStorageUsageKB();
  const el = $('#wdImgUsage');
  if (el) el.textContent = (imgKB / 1024).toFixed(1) + 'MB（IndexedDB）';
}

function wdFilterSet(type, val) {
  const filter = Store.get('wardrobe_filter', { category: 'all', color: 'all' });
  filter[type] = val;
  Store.set('wardrobe_filter', filter);
  wdSwitchTab('closet');
}

/* === 添加/编辑表单 === */
function openAddForm() {
  wdPendingImage = null;
  wdFormState = { cat: null, color: null, season: [], style: null, editId: null };
  showClothForm('添加衣物');
}
async function openEditForm(id) {
  const c = getCloth(id); if (!c) return;
  // 从 IndexedDB 加载真实图片数据用于预览
  wdPendingImage = await resolveImg(c.img);
  wdFormState = { cat: c.category, color: c.color, season: c.season || [], style: c.style, editId: id };
  showClothForm('编辑衣物');
}
function showClothForm(title) {
  const catChips = Object.entries(CAT_LABELS).map(([k,v]) =>
    `<button class="wd-chip ${wdFormState.cat===k?'active':''}" onclick="wdChipSelect('cat','${k}')">${v}</button>`).join('');
  const colorChips = Object.entries(COLOR_LABELS).map(([k,v]) =>
    `<button class="wd-chip wd-chip-color ${wdFormState.color===k?'active':''}" onclick="wdChipSelect('color','${k}')"><span class="wd-color-dot" style="background:${COLOR_SWATCHES[k]}"></span>${v}</button>`).join('');
  const seasonChips = Object.entries(SEASON_LABELS).map(([k,v]) =>
    `<button class="wd-chip ${wdFormState.season.includes(k)?'active':''}" onclick="wdChipSelect('season','${k}')">${v}</button>`).join('');
  const styleChips = Object.entries(STYLE_LABELS).map(([k,v]) =>
    `<button class="wd-chip ${wdFormState.style===k?'active':''}" onclick="wdChipSelect('style','${k}')">${v}</button>`).join('');

  showModal(title, `
    <div class="wd-form">
      <div class="wd-upload-area ${wdPendingImage?'has-image':''}" id="wdUploadArea" onclick="$('#wdFileInput').click()">
        ${wdPendingImage ? `<img id="wdUploadPreview" src="${wdPendingImage}" />` : `<img id="wdUploadPreview" style="display:none" /><div class="wd-upload-placeholder" id="wdUploadPlaceholder">点击拍照或从相册选择</div>`}
        <input type="file" id="wdFileInput" accept="image/*" hidden />
      </div>
      <div class="wd-form-row"><label>类别 <span class="wd-required">*</span></label><div class="wd-chip-group">${catChips}</div></div>
      <div class="wd-form-row"><label>颜色</label><div class="wd-chip-group">${colorChips}</div></div>
      <div class="wd-form-row"><label>季节</label><div class="wd-chip-group">${seasonChips}</div></div>
      <div class="wd-form-row"><label>风格</label><div class="wd-chip-group">${styleChips}</div></div>
      <div class="wd-form-row"><label>备注</label><textarea class="textarea" id="wdFormNote" placeholder="如：适合约会、面料很舒服">${wdFormState.editId ? (getCloth(wdFormState.editId)?.note || '') : ''}</textarea></div>
      <div class="wd-form-actions"><button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn" onclick="submitClothForm()">保存</button></div>
    </div>
  `);
  // 绑定文件上传
  const fi = $('#wdFileInput');
  if (fi) fi.addEventListener('change', e => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); });
}

function wdChipSelect(type, val) {
  if (type === 'season') {
    const i = wdFormState.season.indexOf(val);
    if (i >= 0) wdFormState.season.splice(i, 1);
    else wdFormState.season.push(val);
  } else {
    wdFormState[type] = wdFormState[type] === val ? null : val;
  }
  // 更新 UI
  $$('.wd-chip-group').forEach((group, gi) => {
    const typeMap = ['cat','color','season','style'];
    const t = typeMap[gi];
    if (!t) return;
    $$('.wd-chip', group).forEach((chip, ci) => {
      const keys = t === 'season' ? Object.keys(SEASON_LABELS) : t === 'cat' ? Object.keys(CAT_LABELS) : t === 'color' ? Object.keys(COLOR_LABELS) : Object.keys(STYLE_LABELS);
      const k = keys[ci];
      if (!k) return;
      const active = t === 'season' ? wdFormState.season.includes(k) : wdFormState[t] === k;
      chip.classList.toggle('active', active);
    });
  });
}

async function submitClothForm() {
  if (!wdPendingImage) { wdToast('请先上传衣物照片'); return; }
  if (!wdFormState.cat) { wdToast('请选择类别'); return; }
  const note = $('#wdFormNote')?.value.trim() || '';
  if (wdFormState.editId) {
    // 更新：图片存入 IndexedDB，衣物对象存引用 key
    const imgRef = await saveImgToIDB(wdFormState.editId, wdPendingImage);
    updateCloth(wdFormState.editId, { img: imgRef, category: wdFormState.cat, color: wdFormState.color || 'white', season: wdFormState.season, style: wdFormState.style, note });
    wdToast('已更新');
  } else {
    const clothId = 'c_' + Date.now() + '_' + Math.floor(Math.random()*1000);
    const imgRef = await saveImgToIDB(clothId, wdPendingImage);
    const item = { id: clothId, img: imgRef, category: wdFormState.cat, color: wdFormState.color || 'white', season: wdFormState.season, style: wdFormState.style, note, createdAt: Date.now() };
    if (!addCloth(item)) { return; }
    wdToast('已添加');
  }
  closeModal();
  wdSwitchTab(Store.get('wardrobe_tab', 'closet'));
}

/* === 衣物详情 === */
function openClothDetail(id) {
  const c = getCloth(id); if (!c) return;
  const tags = [];
  tags.push(`<span class="wd-detail-tag">${CAT_LABELS[c.category]}</span>`);
  if (c.color) tags.push(`<span class="wd-detail-tag"><span class="wd-color-dot" style="background:${COLOR_SWATCHES[c.color]}"></span>${COLOR_LABELS[c.color]}</span>`);
  (c.season || []).forEach(s => tags.push(`<span class="wd-detail-tag">${SEASON_LABELS[s]}</span>`));
  if (c.style) tags.push(`<span class="wd-detail-tag">${STYLE_LABELS[c.style]}</span>`);
  showModal('衣物详情', `
    <div class="wd-detail">
      <div class="wd-detail-img" data-img="${c.img}"></div>
      <div class="wd-detail-tags">${tags.join('')}</div>
      ${c.note ? `<div class="wd-detail-note">${escapeHtml(c.note)}</div>` : ''}
      <div class="wd-detail-actions">
        <button class="btn btn-soft" onclick="closeModal();openEditForm('${id}')">编辑</button>
        <button class="btn btn-ghost" onclick="confirmDeleteCloth('${id}')">删除</button>
      </div>
    </div>
  `);
  // 异步加载详情图片
  fillImgs([{ el: $('.wd-detail-img[data-img]'), src: c.img }]);
}
function confirmDeleteCloth(id) {
  showModal('确认删除', `
    <div class="wd-confirm">
      <p>确定删除这件衣物吗？关联的穿搭记录也会一并清理。</p>
      <div class="wd-form-actions">
        <button class="btn btn-ghost" onclick="closeModal();openClothDetail('${id}')">取消</button>
        <button class="btn" style="background:var(--red)" onclick="doDeleteCloth('${id}')">确认删除</button>
      </div>
    </div>
  `);
}
async function doDeleteCloth(id) {
  await deleteCloth(id);
  closeModal();
  wdToast('已删除');
  wdSwitchTab(Store.get('wardrobe_tab', 'closet'));
}

/* === Tab 2: 智能搭配 === */
function renderMatchTab() {
  const clothes = getClothes();
  const tops = clothes.filter(c => c.category === 'top' || c.category === 'onesie');
  const bottoms = clothes.filter(c => c.category === 'bottom');
  const styleOpts = `<option value="">全部风格</option>` + Object.entries(STYLE_LABELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');
  const seasonOpts = `<option value="">全部季节</option>` + Object.entries(SEASON_LABELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');
  return `
    <div class="wd-match-page">
      <div class="wd-preview" id="wdPreview">
        <div class="wd-preview-slot" id="wdPreviewTop"><div class="wd-preview-empty">上装</div></div>
        <div class="wd-preview-plus">+</div>
        <div class="wd-preview-slot" id="wdPreviewBottom"><div class="wd-preview-empty">下装</div></div>
      </div>
      <div class="wd-match-hint" id="wdMatchHint"></div>
      <div class="wd-match-actions">
        <button class="btn" onclick="matchRandom()">换一套</button>
        <button class="btn btn-soft" onclick="matchSurprise()">没灵感，帮帮我</button>
        <button class="btn btn-ghost" onclick="matchClear()">清空</button>
      </div>
      <div class="wd-match-filters">
        <select class="input" id="matchFilterStyle" onchange="matchFilterChange()">${styleOpts}</select>
        <select class="input" id="matchFilterSeason" onchange="matchFilterChange()">${seasonOpts}</select>
      </div>
      <div class="wd-match-select">
        <div class="wd-match-col">
          <div class="wd-match-col-title">选择上装（${tops.length}）</div>
          <div class="wd-match-list" id="wdMatchTops">
            ${tops.length === 0 ? '<div class="wd-empty-sm">暂无上装</div>' : tops.map(c => `
              <div class="wd-match-item ${wdMatchState.topId===c.id?'selected':''}" onclick="matchSelect('top','${c.id}')">
                <div class="wd-match-item-img" data-img="${c.img}"></div>
              </div>`).join('')}
          </div>
        </div>
        <div class="wd-match-col">
          <div class="wd-match-col-title">选择下装（${bottoms.length}）</div>
          <div class="wd-match-list" id="wdMatchBottoms">
            ${bottoms.length === 0 ? '<div class="wd-empty-sm">暂无下装</div>' : bottoms.map(c => `
              <div class="wd-match-item ${wdMatchState.bottomId===c.id?'selected':''}" onclick="matchSelect('bottom','${c.id}')">
                <div class="wd-match-item-img" data-img="${c.img}"></div>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <button class="btn wd-save-outfit" onclick="saveTodayOutfit()">今天穿这套</button>
    </div>
  `;
}

function afterMatchTab() {
  loadMatchListImgs();
  updateMatchPreview();
}

function loadMatchListImgs() {
  const entries = $$('#wdTabContent .wd-match-item-img[data-img]').map(el => ({ el, src: el.dataset.img }));
  fillImgs(entries);
}

function getMatchFilters() {
  return {
    style: $('#matchFilterStyle')?.value || '',
    season: $('#matchFilterSeason')?.value || ''
  };
}

// 筛选变化时重新渲染上下装列表
function matchFilterChange() {
  const { style, season } = getMatchFilters();
  const tops = filterClothes('top', style, season);
  const bottoms = filterClothes('bottom', style, season);
  const topsEl = $('#wdMatchTops');
  const bottomsEl = $('#wdMatchBottoms');
  if (topsEl) {
    topsEl.innerHTML = tops.length === 0 ? '<div class="wd-empty-sm">该筛选下暂无上装</div>' : tops.map(c => `
      <div class="wd-match-item ${wdMatchState.topId===c.id?'selected':''}" onclick="matchSelect('top','${c.id}')">
        <div class="wd-match-item-img" data-img="${c.img}"></div>
      </div>`).join('');
  }
  if (bottomsEl) {
    bottomsEl.innerHTML = bottoms.length === 0 ? '<div class="wd-empty-sm">该筛选下暂无下装</div>' : bottoms.map(c => `
      <div class="wd-match-item ${wdMatchState.bottomId===c.id?'selected':''}" onclick="matchSelect('bottom','${c.id}')">
        <div class="wd-match-item-img" data-img="${c.img}"></div>
      </div>`).join('');
  }
  // 异步加载新列表图片
  loadMatchListImgs();
  // 更新标题数量
  const topTitle = $('.wd-match-col:nth-child(1) .wd-match-col-title');
  const bottomTitle = $('.wd-match-col:nth-child(2) .wd-match-col-title');
  if (topTitle) topTitle.textContent = `选择上装（${tops.length}）`;
  if (bottomTitle) bottomTitle.textContent = `选择下装（${bottoms.length}）`;
  // 如果当前选中的衣物不在筛选结果中，清除选中
  if (wdMatchState.topId && !tops.find(c => c.id === wdMatchState.topId)) {
    wdMatchState.topId = null;
  }
  if (wdMatchState.bottomId && !bottoms.find(c => c.id === wdMatchState.bottomId)) {
    wdMatchState.bottomId = null;
  }
  updateMatchPreview();
}
function matchSelect(type, id) {
  if (type === 'top') wdMatchState.topId = (wdMatchState.topId === id ? null : id);
  else wdMatchState.bottomId = (wdMatchState.bottomId === id ? null : id);
  // 更新选中态
  $$('#wdMatchTops .wd-match-item').forEach(el => el.classList.remove('selected'));
  $$('#wdMatchBottoms .wd-match-item').forEach(el => el.classList.remove('selected'));
  updateMatchPreview();
}
function filterClothes(category, style, season) {
  return getClothes().filter(c => {
    if (category === 'top' && !(c.category === 'top' || c.category === 'onesie')) return false;
    if (category === 'bottom' && c.category !== 'bottom') return false;
    if (style && c.style !== style) return false;
    if (season && !(c.season || []).includes(season)) return false;
    return true;
  });
}
function matchRandom() {
  const { style, season } = getMatchFilters();
  let tops = filterClothes('top', style, season);
  let bottoms = filterClothes('bottom', style, season);
  if (!tops.length || !bottoms.length) { wdToast('当前筛选下衣物不足，请先添加或调整筛选'); return; }
  wdMatchState.topId = tops[Math.floor(Math.random()*tops.length)].id;
  wdMatchState.bottomId = bottoms[Math.floor(Math.random()*bottoms.length)].id;
  syncMatchSelection();
  updateMatchPreview();
}
function matchSurprise() {
  const { style, season } = getMatchFilters();
  let tops = filterClothes('top', style, season);
  let bottoms = filterClothes('bottom', style, season);
  if (!tops.length || !bottoms.length) { wdToast('当前筛选下衣物不足，请先添加或调整筛选'); return; }
  // 生成10组取最高分
  let best = null, bestScore = -1;
  for (let i = 0; i < 10; i++) {
    const t = tops[Math.floor(Math.random()*tops.length)];
    const b = bottoms[Math.floor(Math.random()*bottoms.length)];
    const score = colorHarmony(t.color, b.color);
    if (score > bestScore) { bestScore = score; best = { topId: t.id, bottomId: b.id }; }
  }
  wdMatchState = best;
  syncMatchSelection();
  updateMatchPreview(bestScore);
}
function syncMatchSelection() {
  $$('#wdMatchTops .wd-match-item').forEach(el => el.classList.toggle('selected', el.getAttribute('onclick')?.includes(wdMatchState.topId)));
  $$('#wdMatchBottoms .wd-match-item').forEach(el => el.classList.toggle('selected', el.getAttribute('onclick')?.includes(wdMatchState.bottomId)));
}
function matchClear() {
  wdMatchState = { topId: null, bottomId: null };
  $$('#wdMatchTops .wd-match-item, #wdMatchBottoms .wd-match-item').forEach(el => el.classList.remove('selected'));
  updateMatchPreview();
}
function colorHarmony(tc, bc) {
  if (tc === 'multicolor' && bc === 'multicolor') return 20;
  if (tc === bc) return 60;
  if (COLOR_HARMONY[tc]?.includes(bc)) return 80;
  return 30;
}
async function updateMatchPreview(score) {
  const slotTop = $('#wdPreviewTop');
  const slotBot = $('#wdPreviewBottom');
  const hint = $('#wdMatchHint');
  if (!slotTop) return;
  const t = wdMatchState.topId ? getCloth(wdMatchState.topId) : null;
  const b = wdMatchState.bottomId ? getCloth(wdMatchState.bottomId) : null;
  slotTop.innerHTML = t ? `<img data-img="${t.img}" />` : `<div class="wd-preview-empty">上装</div>`;
  slotTop.classList.toggle('has-item', !!t);
  slotBot.innerHTML = b ? `<img data-img="${b.img}" />` : `<div class="wd-preview-empty">下装</div>`;
  slotBot.classList.toggle('has-item', !!b);
  // 异步加载预览图
  const entries = [];
  if (t) entries.push({ el: slotTop.querySelector('img'), src: t.img });
  if (b) entries.push({ el: slotBot.querySelector('img'), src: b.img });
  if (entries.length) fillImgs(entries);
  if (hint) {
    if (score !== undefined && score < 50 && t && b) hint.textContent = '这个组合可能不太搭，仅供参考～';
    else hint.textContent = '';
  }
}
function saveTodayOutfit() {
  if (!wdMatchState.topId && !wdMatchState.bottomId) { wdToast('请先选择搭配'); return; }
  const today = dateKey(new Date());
  saveOutfit({ date: today, topId: wdMatchState.topId, bottomId: wdMatchState.bottomId, onesieId: null, outerwearId: null, shoesId: null, accessoryId: null, note: '', savedAt: Date.now() });
  wdToast('已记录今天穿的搭配');
}

/* === Tab 3: 穿搭日历 === */
function renderCalendarTab() {
  return `
    <div class="wd-cal-wrap">
      <div class="wd-cal-main">
        <div class="cal-header">
          <div class="cal-month" id="wdCalMonth"></div>
          <div class="cal-nav">
            <button onclick="wdCalMove(-1)">‹</button>
            <button onclick="wdCalToday()">·</button>
            <button onclick="wdCalMove(1)">›</button>
          </div>
        </div>
        <div class="cal-grid" id="wdCalGrid"></div>
      </div>
      <div class="wd-cal-detail" id="wdCalDetail"></div>
    </div>
  `;
}
function afterCalendarTab() {
  wdCalCursor = new Date();
  wdCalSelected = dateKey(new Date());
  drawWdCalendar();
  loadWdCalDetail();
}
function drawWdCalendar() {
  const y = wdCalCursor.getFullYear(), m = wdCalCursor.getMonth();
  $('#wdCalMonth').textContent = `${y}年${m+1}月`;
  const first = new Date(y, m, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const outfits = getOutfits();
  const todayK = dateKey(new Date());
  const cells = [];
  ['日','一','二','三','四','五','六'].forEach(w => cells.push(`<div class="cal-weekday">${w}</div>`));
  for (let i = startDay - 1; i >= 0; i--) cells.push(`<div class="cal-day other-month">${prevDays - i}</div>`);
  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${y}-${pad(m+1)}-${pad(d)}`;
    const cls = ['cal-day'];
    if (k === todayK) cls.push('today');
    if (k === wdCalSelected) cls.push('selected');
    if (outfits[k]) cls.push('has-outfit');
    cells.push(`<div class="${cls.join(' ')}" onclick="wdCalSelect('${k}')">${d}</div>`);
  }
  const total = startDay + daysInMonth;
  const fill = (7 - total % 7) % 7;
  for (let i = 1; i <= fill; i++) cells.push(`<div class="cal-day other-month">${i}</div>`);
  $('#wdCalGrid').innerHTML = cells.join('');
}
function wdCalSelect(k) { wdCalSelected = k; drawWdCalendar(); loadWdCalDetail(); }
function wdCalMove(dir) { wdCalCursor.setMonth(wdCalCursor.getMonth() + dir); drawWdCalendar(); }
function wdCalToday() { wdCalCursor = new Date(); wdCalSelected = dateKey(new Date()); drawWdCalendar(); loadWdCalDetail(); }
function loadWdCalDetail() {
  const o = getOutfit(wdCalSelected);
  const el = $('#wdCalDetail');
  if (!el) return;
  const [y, m, d] = wdCalSelected.split('-');
  if (!o) {
    el.innerHTML = `<div class="note-date">${parseInt(m)}月${parseInt(d)}日</div><div class="note-empty">这天没有穿搭记录</div>`;
    return;
  }
  const items = [];
  [['topId','上装'],['bottomId','下装'],['onesieId','连身装'],['outerwearId','外套'],['shoesId','鞋履'],['accessoryId','配饰']].forEach(([k,label]) => {
    if (o[k]) { const c = getCloth(o[k]); if (c) items.push({ label, c }); }
  });
  el.innerHTML = `
    <div class="note-date">${parseInt(m)}月${parseInt(d)}日穿搭</div>
    ${items.map(it => `
      <div class="wd-cal-outfit-item">
        <div class="wd-cal-outfit-img" data-img="${it.c.img}"></div>
        <div class="wd-cal-outfit-label">${it.label}</div>
      </div>`).join('')}
    ${o.note ? `<div class="wd-detail-note">${escapeHtml(o.note)}</div>` : ''}
    <button class="btn btn-ghost btn-sm" style="margin-top:10px;" onclick="wdCalDeleteOutfit()">删除记录</button>
  `;
  // 异步加载日历详情图片
  fillImgs($$('#wdCalDetail .wd-cal-outfit-img[data-img]').map(el => ({ el, src: el.dataset.img })));
}
function wdCalDeleteOutfit() {
  deleteOutfit(wdCalSelected);
  drawWdCalendar();
  loadWdCalDetail();
  wdToast('已删除穿搭记录');
}

/* =========================================================================
 * 模块 3.5：休闲娱乐（热门视频）
 * ========================================================================= */

// 五大分类配置
const VIDEO_CATEGORIES = [
  { key: 'beauty',    label: '美妆', icon: '💄', bili: { rid: 155, filterTname: ['美妆护肤', '仿妆cos'] } },
  { key: 'fashion',  label: '穿搭', icon: '👗', bili: { rid: 155, filterTname: ['穿搭'] } },
  { key: 'game',     label: '游戏', icon: '🎮', bili: { rid: 4,   filterTname: null } },
  { key: 'travel',   label: '旅游', icon: '✈️', bili: { rid: 0,   filterTname: ['出行'] } },
  { key: 'general',  label: '综合', icon: '🔥', bili: { rid: 0,   filterTname: null } },
];

// B站兜底数据（由 GitHub Actions 每日自动更新，真实排行榜视频，每类3个，随机展示1个，均可播放）
// 最后更新: 2026-08-15 22:51:57
const FALLBACK_BILI_VIDEOS = {
  beauty: [
    { bvid: 'BV1EjoXYwECL', title: '“请宿主做好准备”', author: 'Doki蟹泥泥', pic: 'https://i2.hdslb.com/bfs/archive/0492e08433ed30dae978dcfdbbbc656b3f949ccf.jpg', stats: { like: 382208, reply: 1023, favorite: 39890 } },
    { bvid: 'BV1gwXrYMELR', title: '【小马宝莉｜海妖三姐妹】Abracadabra', author: 'llSHEEP-羊ll', pic: 'https://i1.hdslb.com/bfs/archive/41249f7252d92d08bcc74557315064cd397b249a.jpg', stats: { like: 290344, reply: 804, favorite: 64950 } },
    { bvid: 'BV13uQrYzEMW', title: '眼睛不好请捐给有需要的人', author: '幺玖伍195', pic: 'https://i0.hdslb.com/bfs/archive/efea293810ad4f06305b0122050efd441167b656.jpg', stats: { like: 267250, reply: 2325, favorite: 9383 } },
  ],
  fashion: [
    { bvid: 'BV1oWXNYjEr8', title: '意想不到的转场也是被我拍上了…', author: '白昼小熊', pic: 'https://i1.hdslb.com/bfs/archive/ee69586f135f37b0539b0da3f1ec96b42640c3a9.jpg', stats: { like: 222017, reply: 469, favorite: 33259 } },
    { bvid: 'BV1UsoWYAEDX', title: '可露丽风？昭和冷漠萝莉？直井怜REI穿搭灵感2.0来了！', author: 'the_Adrianaloh', pic: 'https://i1.hdslb.com/bfs/archive/369ed9ae8c6d0a1c99db5e2b940404dbf0f97d0f.jpg', stats: { like: 90901, reply: 475, favorite: 26020 } },
    { bvid: 'BV1pEZhY5EsD', title: '「水水」猫猫先起跳再说！', author: '彼岸的水坑-', pic: 'https://i2.hdslb.com/bfs/archive/650c8d6d5237c811fd39e875c545c2786f8cfd8e.jpg', stats: { like: 87303, reply: 304, favorite: 22592 } },
  ],
  game: [
    { bvid: 'BV1GyZYYNErW', title: '我的世界克苏鲁全集：一口气看完', author: '这名玩家', pic: 'https://i1.hdslb.com/bfs/archive/1aa8b3a330458604faf74604d29cf3520983644c.jpg', stats: { like: 352355, reply: 2836, favorite: 756837 } },
    { bvid: 'BV1eqZJYaESc', title: '“我花了5年一个人做的独立像素游戏4月17日就要上线啦！”', author: '换影循迹官方', pic: 'https://i2.hdslb.com/bfs/archive/622e3d9a5d3dd5bbe81eaf137a5adacf5597d432.jpg', stats: { like: 693881, reply: 4407, favorite: 130301 } },
    { bvid: 'BV16io9YTEqH', title: '《崩坏：星穹铁道》动画短片：「那安息的长夜」', author: '崩坏星穹铁道', pic: 'https://i2.hdslb.com/bfs/archive/e1cf64a913adfc4f5270eb8d433fef3fa8ccc6ea.jpg', stats: { like: 517054, reply: 29142, favorite: 183193 } },
  ],
  travel: [
    { bvid: 'BV1F4gK6LE3z', title: '选一颗星球，决定你接下来的旅途', author: '麒麟光谱', pic: 'https://i1.hdslb.com/bfs/archive/b8e7e840e48f07f3f31465194f71aae7770da00d.jpg', stats: { like: 85528, reply: 1810, favorite: 32051 } },
  ],
  general: [
    { bvid: 'BV1mJuB6jEDj', title: '船新版本新宝岛！这个联动怎么说？', author: '不齐舞团', pic: 'https://i0.hdslb.com/bfs/archive/68cd0475b024692bc31adf4d8dea4f95a5f75438.jpg', stats: { like: 951405, reply: 20475, favorite: 96550 } },
    { bvid: 'BV1EAuk6CEfw', title: '《顽童戏老叟》', author: '伤心欲茄222', pic: 'https://i2.hdslb.com/bfs/archive/a5143c68f9716c965782676407edf0d4b6427199.jpg', stats: { like: 735734, reply: 8776, favorite: 54835 } },
    { bvid: 'BV15xgn6GEjH', title: '赛伯朋克之大圣归来：耗时两年半，精品制作，一口气看完。', author: '里无敌本人', pic: 'https://i1.hdslb.com/bfs/archive/1f485ed591088bd2c8dbc107ff5cbecc8ade761c.jpg', stats: { like: 387775, reply: 5619, favorite: 256945 } },
  ],
};

// 抖音兜底数据（由 GitHub Actions 每日自动更新，真实热门视频，每类3个，随机展示1个）
// 最后更新: 2026-08-15 22:52:16
const FALLBACK_DOUYIN_VIDEOS = {
  beauty: [
    { vid: '7671662227880342399', title: '刚逃过了阿那亚的高温 又进入了上海的暴雨圈 这次8月12记得来我直播间#二胎宝妈 #美容仪 #护肤', author: '是静宜（16号hfp&欧佩莱护肤破价专场', stats: { like: 6528, reply: 170, favorite: 189 } },
  ],
  fashion: [
    { vid: '7672704387559630779', title: '', author: '拾晓服装店', stats: { like: 3443, reply: 426, favorite: 50 } },
  ],
  game: [
    { vid: '7670537643835070065', title: '#媒体原创 亚运会电竞参赛代表团公布。中国队将参加4个项目：《王者荣耀》、《和平精英》亚运版本、《永劫无间》、《第五人格', author: '封面新闻', stats: { like: 24519, reply: 6629, favorite: 20406 } },
    { vid: '7664632801181928730', title: '挂玉米钓鲤鱼调漂，只需两步，简单有效 #原来钓鱼才是抖音运动顶流 #当钓鱼的想法达到了顶峰 #沃鼎产品体验官 #沃鼎王者', author: '辛涛钓鱼', stats: { like: 13724, reply: 445, favorite: 1721 } },
    { vid: '7671599085572410643', title: '年少有为用iQOO，选这6款包不会输！ #vivo  #iqoo  #游戏手机排名  #学生党手机推荐  iqoo，iq', author: '霸王茶机（冲50w粉版）', stats: { like: 7048, reply: 1361, favorite: 996 } },
  ],
  travel: [
    { vid: '7672352756137681841', title: '去哪不重要，去才重要！陪你看风景的人，比风景更重要！', author: '人生百味笑着面对', stats: { like: 46740, reply: 770, favorite: 124698 } },
    { vid: '7671931596253022118', title: '宝宝周岁宴圆满落幕！细数一年选奶心得，好的喂养才是底气#a2至初#a2奶粉#转奶攻略#新华社#奶粉推荐', author: '歌歌Abby', stats: { like: 68373, reply: 466, favorite: 921 } },
    { vid: '7667439691200793875', title: '心的假期 正在发生🍃 逃离都市 和爱的人去大自然里呼吸风的味道 带上华为Pura X Max折叠屏手机记录此刻美好 AI', author: '曹甚麼', stats: { like: 49564, reply: 266, favorite: 52 } },
  ],
  general: [
    { vid: '7668896380315897126', title: '重达35吨的大殿悬空1400年，竟全靠一座单孔石桥支撑！ #百young非遗计划 #非遗新青年 #传统文化 #科普', author: '青简', stats: { like: 2054721, reply: 48430, favorite: 186304 } },
    { vid: '7673171245390695718', title: '《反相之地》第三集 #反相之地#即梦AI#AI拍出中国版怪奇物语#抖音AI创作大赛#即梦AI创作者成长计划', author: '潘鱼晏', stats: { like: 1004551, reply: 57137, favorite: 309365 } },
    { vid: '7670775607034786545', title: '这是烈性犬吗？还是牌子狗呀？', author: '張旭家有五十只圣伯纳', stats: { like: 665616, reply: 4180, favorite: 114304 } },
  ],
};

const BILI_API_BASE = 'https://api.bilibili.com/x/web-interface/ranking/v2';
const BILI_CACHE_TTL = 6 * 60 * 60 * 1000; // 6小时

/* --- JSONP 加载器（绕过CORS） --- */
const _jsonpCallbacks = {};
let _jsonpCounter = 0;

function jsonpLoad(url, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const cbName = `__jsonp_cb_${Date.now()}_${_jsonpCounter++}`;
    const script = document.createElement('script');

    function cleanup() {
      if (_jsonpCallbacks[cbName]) {
        clearTimeout(_jsonpCallbacks[cbName].timer);
        delete _jsonpCallbacks[cbName];
      }
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    _jsonpCallbacks[cbName] = {
      timer: setTimeout(() => {
        cleanup();
        reject(new Error('JSONP timeout'));
      }, timeout),
    };

    window[cbName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP network error'));
    };

    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cbName;
    document.head.appendChild(script);
  });
}

/* --- 数字格式化 --- */
function formatNum(n) {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return String(n);
}

/* --- 兜底数据获取 --- */
function getBiliFallbackVideo(catKey) {
  const pool = FALLBACK_BILI_VIDEOS[catKey];
  if (!pool || pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return {
    platform: 'bilibili',
    title: pick.title,
    author: pick.author,
    cover: pick.pic || '',
    playUrl: `https://www.bilibili.com/video/${pick.bvid}`,
    embedSrc: `https://player.bilibili.com/player.html?bvid=${pick.bvid}&autoplay=0&high_quality=1&danmaku=1`,
    stats: pick.stats,
    heatScore: pick.stats.like + pick.stats.reply + pick.stats.favorite,
    category: catKey,
  };
}

function getDouyinVideo(catKey) {
  const pool = FALLBACK_DOUYIN_VIDEOS[catKey];
  if (!pool || pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return {
    platform: 'douyin',
    title: pick.title,
    author: pick.author,
    cover: '',
    playUrl: `https://www.douyin.com/video/${pick.vid}`,
    embedSrc: `https://open.douyin.com/player/video?vid=${pick.vid}&autoplay=0`,
    stats: pick.stats,
    heatScore: pick.stats.like + pick.stats.reply + pick.stats.favorite,
    category: catKey,
  };
}

/* --- B站排行榜获取（带缓存，多CORS代理轮询） --- */
const CORS_PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy/?quest=${url}`,
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

async function fetchViaProxy(apiUrl) {
  for (const makeProxyUrl of CORS_PROXIES) {
    try {
      const proxyUrl = makeProxyUrl(apiUrl);
      const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data && data.code === 0 && data.data && data.data.list) return data;
    } catch (e) { /* 尝试下一个代理 */ }
  }
  // 所有代理失败，尝试 JSONP
  try {
    const jsonpUrl = apiUrl + '&jsonp=jsonp';
    return await jsonpLoad(jsonpUrl);
  } catch (e) {
    return null;
  }
}

async function fetchBiliRankByRid(rid) {
  const cacheKey = `bili_rank_${rid}`;
  const cached = Store.get(cacheKey);
  if (cached && Date.now() - cached.ts < BILI_CACHE_TTL) {
    return cached.list;
  }

  const apiUrl = `${BILI_API_BASE}?rid=${rid}&type=all`;
  const data = await fetchViaProxy(apiUrl);

  if (!data || data.code !== 0 || !data.data || !data.data.list) {
    throw new Error('Bili API error: ' + (data ? data.code : 'no data'));
  }

  const list = data.data.list.map(v => ({
    bvid: v.bvid,
    title: v.title,
    pic: (v.pic || '').replace(/^http:/, 'https:'),
    author: v.owner ? v.owner.name : '',
    tname: v.tname || '',
    like: v.stat ? v.stat.like : 0,
    reply: v.stat ? v.stat.reply : 0,
    favorite: v.stat ? v.stat.favorite : 0,
    view: v.stat ? v.stat.view : 0,
  }));

  Store.set(cacheKey, { list, ts: Date.now() });
  return list;
}

/* --- 从排行榜中筛选热度最高的视频 --- */
function pickBiliVideo(list, filterTname, catKey) {
  let candidates = list;
  if (filterTname && filterTname.length > 0) {
    candidates = list.filter(v => filterTname.some(t => v.tname && v.tname.includes(t)));
  }
  if (candidates.length === 0) candidates = list;

  const sorted = candidates.map(v => ({
    ...v,
    heatScore: (v.like || 0) + (v.reply || 0) + (v.favorite || 0),
  })).sort((a, b) => b.heatScore - a.heatScore);

  const top = sorted[0];
  if (!top) return null;

  return {
    platform: 'bilibili',
    title: top.title,
    author: top.author,
    cover: top.pic || '',
    playUrl: `https://www.bilibili.com/video/${top.bvid}`,
    embedSrc: `https://player.bilibili.com/player.html?bvid=${top.bvid}&autoplay=0&high_quality=1&danmaku=1`,
    stats: { like: top.like, reply: top.reply, favorite: top.favorite, view: top.view },
    heatScore: top.heatScore,
    category: catKey,
  };
}

/* --- 并行加载3个rid，为5个分类各选1个视频 --- */
async function fetchAllBiliVideos() {
  const ridsNeeded = [155, 0, 4];
  const results = await Promise.allSettled(ridsNeeded.map(rid => fetchBiliRankByRid(rid)));

  const ridData = {};
  ridsNeeded.forEach((rid, i) => {
    if (results[i].status === 'fulfilled') ridData[rid] = results[i].value;
  });

  const biliVideos = {};
  for (const cat of VIDEO_CATEGORIES) {
    const list = ridData[cat.bili.rid];
    if (list) {
      biliVideos[cat.key] = pickBiliVideo(list, cat.bili.filterTname, cat.key);
    } else {
      biliVideos[cat.key] = null;
    }
  }
  return biliVideos;
}

/* --- 渲染单个视频卡片 --- */
function renderVideoCard(video, cat, platform) {
  if (!video) {
    return `
      <div class="fun-video-card ${platform}" data-platform="${platform}" data-category="${cat.key}">
        <div class="fun-card-head">
          <span class="fun-platform-tag ${platform}">${platform === 'bilibili' ? 'B站' : '抖音'}</span>
          <span class="fun-category-tag">${cat.icon} ${cat.label}</span>
        </div>
        <div class="fun-card-placeholder">暂无数据</div>
      </div>
    `;
  }

  const coverStyle = video.cover
    ? `background-image:url('${video.cover}')`
    : `background:linear-gradient(135deg,var(--primary-soft),var(--accent-soft))`;

  const canPlay = video.embedSrc ? 'true' : 'false';

  return `
    <div class="fun-video-card ${platform}" data-platform="${platform}" data-category="${cat.key}"
         data-embed="${escapeHtml(video.embedSrc)}" data-play-url="${escapeHtml(video.playUrl)}"
         data-can-play="${canPlay}" onclick="playFunVideo(this)">
      <div class="fun-card-head">
        <span class="fun-platform-tag ${platform}">${platform === 'bilibili' ? 'B站' : '抖音'}</span>
        <span class="fun-category-tag">${cat.icon} ${cat.label}</span>
      </div>
      <div class="fun-card-cover" style="${coverStyle}">
        <div class="fun-play-overlay">
          <div class="fun-play-btn">▶</div>
          <div class="fun-play-text">${canPlay === 'true' ? '点击播放' : '加载中'}</div>
        </div>
      </div>
      <div class="fun-card-info">
        <div class="fun-card-title">${escapeHtml(video.title)}</div>
        <div class="fun-card-meta">
          <span class="fun-author">${escapeHtml(video.author)}</span>
        </div>
        <div class="fun-card-stats">
          <span>👍 ${formatNum(video.stats.like)}</span>
          <span>💬 ${formatNum(video.stats.reply)}</span>
          <span>⭐ ${formatNum(video.stats.favorite)}</span>
        </div>
      </div>
    </div>
  `;
}

/* --- 渲染模块主函数 --- */
function renderFun() {
  const rows = VIDEO_CATEGORIES.map(cat => {
    const biliVideo = getBiliFallbackVideo(cat.key);
    const douyinVideo = getDouyinVideo(cat.key);
    return `
      <div class="fun-video-row" data-category="${cat.key}">
        ${renderVideoCard(biliVideo, cat, 'bilibili')}
        ${renderVideoCard(douyinVideo, cat, 'douyin')}
      </div>
    `;
  }).join('');

  return `
    <div class="fun-page">
      <div class="fun-header">
        <div class="fun-header-title">🎬 热门视频</div>
        <div class="fun-header-sub">B站 × 抖音 · 五大分类当日最火 · 综合点赞/评论/收藏排序</div>
        <button class="btn btn-soft btn-sm fun-refresh" onclick="refreshFunVideos()">🔄 刷新</button>
      </div>
      <div class="fun-video-table" id="funVideoTable">
        ${rows}
      </div>
      <div class="fun-footer-note">💡 点击视频卡片即可播放 · B站数据来自官方排行榜 · 抖音为精选推荐</div>
    </div>
  `;
}

afterRender.fun = () => { loadFunVideos(); };

/* --- 异步加载B站实时数据，替换初始兜底渲染 --- */
async function loadFunVideos() {
  try {
    const biliVideos = await fetchAllBiliVideos();
    for (const cat of VIDEO_CATEGORIES) {
      const video = biliVideos[cat.key];
      if (video) {
        const card = document.querySelector(`#funVideoTable .fun-video-card[data-platform="bilibili"][data-category="${cat.key}"]`);
        if (card) {
          const newHtml = renderVideoCard(video, cat, 'bilibili');
          card.outerHTML = newHtml;
        }
      }
    }
  } catch (e) {
    console.warn('B站实时数据获取失败，使用预置数据:', e);
  }
}

/* --- 点击播放：替换封面为iframe --- */
function playFunVideo(card) {
  const embedSrc = card.dataset.embed;
  if (!embedSrc) return;
  const cover = card.querySelector('.fun-card-cover');
  if (!cover || cover.classList.contains('played')) return;

  const platform = card.dataset.platform;
  const referrerAttr = platform === 'douyin' ? 'referrerpolicy="unsafe-url"' : '';
  const frameHtml = `
    <div class="fun-video-frame ${platform}">
      <iframe src="${escapeHtml(embedSrc)}"
        scrolling="no" border="0" frameborder="no" framespacing="0"
        allowfullscreen="true" width="100%" height="100%" ${referrerAttr}>
      </iframe>
    </div>
  `;

  cover.outerHTML = frameHtml;
  card.classList.add('played');
  card.onclick = null;
}

/* --- 刷新：清除缓存重新渲染 --- */
function refreshFunVideos() {
  [0, 4, 155].forEach(rid => localStorage.removeItem(`bili_rank_${rid}`));
  renderModule('fun');
}

/* =========================================================================
 * 模块 4：均衡膳食
 * ========================================================================= */
function renderMeal() {
  const daily = getDailyMeals();
  const totalCal = daily.reduce((sum, m) => {
    const n = parseInt((m.cal.match(/\d+/) || [0])[0]);
    return sum + n;
  }, 0);
  // 搜索关键词
  const searchKey = Store.get('meal_search', '');
  const dislikes = Store.get('meal_dislikes', []); // 不喜欢的菜名列表
  // 过滤
  let displayMeals = daily;
  if (searchKey) {
    const allMatches = MEALS.filter(m => m.name.includes(searchKey) || m.desc.includes(searchKey));
    if (allMatches.length > 0) {
      // 按餐次替换
      const byType = { breakfast: [], lunch: [], dinner: [] };
      allMatches.forEach(m => byType[m.meal]?.push(m));
      displayMeals = [
        ...(byType.breakfast[0] ? [{ ...byType.breakfast[0], mealLabel: '早餐' }] : []),
        ...(byType.lunch[0] ? [{ ...byType.lunch[0], mealLabel: '午餐' }] : []),
        ...(byType.dinner[0] ? [{ ...byType.dinner[0], mealLabel: '晚餐' }] : []),
      ];
      if (displayMeals.length === 0) displayMeals = daily;
    }
  }
  // 标记不喜欢
  const isDisliked = (name) => dislikes.includes(name);

  return `
    <div class="card">
      <div class="card-title"><span class="ico">♥</span>今日三餐推荐</div>
      <div class="meal-day-info">每日根据日期自动更换 · 共 ${MEALS.length} 道菜 · 今日合计约 ${totalCal} 千卡</div>
      <div class="meal-search">
        <input class="input" id="mealSearchInput" placeholder="搜索菜品名称或关键词…" value="${escapeAttr(searchKey)}" oninput="MealSearch(this.value)" />
      </div>
      <div class="meal-pref-chips">
        ${displayMeals.map(m => `
          <button class="meal-pref-chip ${isDisliked(m.name)?'dislike':''}" onclick="MealToggleDislike('${escapeAttr(m.name)}')">${isDisliked(m.name) ? '👎' : '👍'} ${escapeHtml(m.name)}</button>
        `).join('')}
      </div>
      <div class="meal-grid">
        ${displayMeals.map(m => `
          <div class="meal-card">
            <div class="meal-tag">${m.mealLabel}</div>
            <div class="meal-img" style="background:linear-gradient(135deg, ${m.grad[0]}, ${m.grad[1]});"><span style="font-size:20px;color:rgba(255,255,255,0.9);font-weight:700;">${escapeHtml(m.name[0])}</span></div>
            <div class="meal-body">
              <div class="meal-name">${escapeHtml(m.name)}</div>
              <div class="meal-cal">${escapeHtml(m.cal)}</div>
              <div class="meal-desc">${escapeHtml(m.desc)}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="btn wd-refresh-meal" onclick="refreshMeal()">换一批推荐</button>
    </div>
  `;
}

// 搜索菜品
function MealSearch(v) {
  Store.set('meal_search', v);
  // 延迟渲染避免频繁刷新
  clearTimeout(window._mealSearchTimer);
  window._mealSearchTimer = setTimeout(() => {
    const content = $('#content');
    if (content) content.innerHTML = renderMeal();
  }, 300);
}
// 标记不喜欢
function MealToggleDislike(name) {
  const dislikes = Store.get('meal_dislikes', []);
  const i = dislikes.indexOf(name);
  if (i >= 0) dislikes.splice(i, 1);
  else dislikes.push(name);
  Store.set('meal_dislikes', dislikes);
  const content = $('#content');
  if (content) content.innerHTML = renderMeal();
}

// 手动换一批：用随机种子重新渲染
let mealShuffle = 0;
function refreshMeal() {
  mealShuffle++;
  window._mealOverride = dateKey(new Date()) + '-s' + mealShuffle;
  Store.set('meal_search', ''); // 清除搜索
  const content = $('#content');
  content.innerHTML = renderMeal();
}

afterRender.meal = () => {
  // 每次切换进入模块时重置为当天推荐
  window._mealOverride = null;
};

/* =========================================================================
 * 模块 5：经期记录
 * ========================================================================= */
let calCursor = new Date();
let calSelected = dateKey(new Date());

function renderPeriod() {
  return `
    <div class="calendar-wrap">
      <div class="calendar-main">
        <div class="cal-header">
          <div class="cal-month" id="calMonth"></div>
          <div class="cal-nav">
            <button onclick="CalMove(-1)" aria-label="上个月">‹</button>
            <button onclick="CalMove(1)" aria-label="下个月">›</button>
            <button onclick="CalToday()" title="回到今天" aria-label="回到今天">·</button>
          </div>
        </div>
        <div class="cal-grid" id="calGrid"></div>
      </div>
      <div class="calendar-note">
        <div class="note-date" id="noteDateLabel"></div>
        <div class="period-predict" id="periodPredict"></div>
        <div class="flow-selector" id="flowSelector">
          <button class="flow-btn" data-flow="light" onclick="FlowSet('light')">量少</button>
          <button class="flow-btn" data-flow="medium" onclick="FlowSet('medium')">适中</button>
          <button class="flow-btn" data-flow="heavy" onclick="FlowSet('heavy')">量多</button>
        </div>
        <div class="period-symptoms" id="symptomChips"></div>
        <textarea class="textarea note-area" id="noteArea" placeholder="记下当天的身体感受或备注…"></textarea>
        <div class="note-actions">
          <button class="btn btn-sm" onclick="NoteSave()">保存笔记</button>
          <button class="btn btn-ghost btn-sm" onclick="NoteClear()">清除</button>
        </div>
      </div>
    </div>
  `;
}

// 经期症状列表
const PERIOD_SYMPTOMS = ['痛经', '头痛', '腰酸', '情绪波动', '疲劳', '腹胀', '胸部胀痛', '失眠', '食欲变化'];
// 经期周期计算
const PERIOD_CYCLE_DEFAULT = 28; // 默认周期天数

afterRender.period = () => {
  calCursor = new Date();
  calSelected = dateKey(new Date());
  drawCalendar();
  loadNote();
};

function getPeriodNotes() { return Store.get('period_notes', {}); }
function setPeriodNotes(v) { Store.set('period_notes', v); }
// 获取经期标记日（有 flow 记录的日期）
function getPeriodDays() {
  const notes = getPeriodNotes();
  return Object.keys(notes).filter(k => notes[k] && typeof notes[k] === 'object' && notes[k].flow).sort();
}
// 周期预测
function predictPeriod() {
  const days = getPeriodDays();
  if (days.length < 1) return null;
  const last = days[days.length - 1];
  const lastDate = new Date(last);
  // 计算平均周期
  let avgCycle = PERIOD_CYCLE_DEFAULT;
  if (days.length >= 2) {
    const cycles = [];
    for (let i = 1; i < days.length; i++) {
      const diff = (new Date(days[i]) - new Date(days[i-1])) / (1000 * 60 * 60 * 24);
      if (diff > 15 && diff < 60) cycles.push(diff); // 过滤异常值
    }
    if (cycles.length > 0) avgCycle = Math.round(cycles.reduce((a,b) => a+b, 0) / cycles.length);
  }
  const nextDate = new Date(lastDate);
  nextDate.setDate(nextDate.getDate() + avgCycle);
  const today = new Date();
  today.setHours(0,0,0,0);
  const daysUntil = Math.round((nextDate - today) / (1000 * 60 * 60 * 24));
  return { last, next: dateKey(nextDate), avgCycle, daysUntil };
}

function drawCalendar() {
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  $('#calMonth').textContent = `${y}年${m+1}月`;
  const first = new Date(y, m, 1);
  const startDay = first.getDay(); // 0=日
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const notes = getPeriodNotes();
  const todayK = dateKey(new Date());
  const periodDays = getPeriodDays();

  // 预测下次经期
  const pred = predictPeriod();
  let predRange = [];
  if (pred) {
    // 预测经期前后5天标记
    const predStart = new Date(pred.next);
    predStart.setDate(predStart.getDate() - 2);
    for (let i = 0; i < 7; i++) {
      const d = new Date(predStart);
      d.setDate(d.getDate() + i);
      predRange.push(dateKey(d));
    }
  }

  const cells = [];
  // 星期表头
  ['日','一','二','三','四','五','六'].forEach(w => cells.push(`<div class="cal-weekday">${w}</div>`));
  // 上月填充
  for (let i = startDay - 1; i >= 0; i--) {
    cells.push(`<div class="cal-day other-month">${prevDays - i}</div>`);
  }
  // 本月
  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${y}-${pad(m+1)}-${pad(d)}`;
    const cls = ['cal-day'];
    if (k === todayK) cls.push('today');
    if (k === calSelected) cls.push('selected');
    const note = notes[k];
    if (note) {
      if (typeof note === 'string') cls.push('has-note');
      else if (note.flow || note.symptoms?.length || note.text) cls.push('has-note');
    }
    // 经期标记日
    if (periodDays.includes(k)) cls.push('has-period');
    // 预测经期日
    if (predRange.includes(k) && !periodDays.includes(k)) cls.push('predicted-period');
    cells.push(`<div class="${cls.join(' ')}" onclick="CalSelect('${k}')" tabindex="0" role="button" aria-label="${k}">${d}</div>`);
  }
  // 下月填充
  const total = startDay + daysInMonth;
  const fill = (7 - total % 7) % 7;
  for (let i = 1; i <= fill; i++) cells.push(`<div class="cal-day other-month">${i}</div>`);

  $('#calGrid').innerHTML = cells.join('');
}

function CalSelect(k) {
  calSelected = k;
  drawCalendar();
  loadNote();
}
function CalMove(dir) {
  calCursor.setMonth(calCursor.getMonth() + dir);
  drawCalendar();
}
function CalToday() {
  calCursor = new Date();
  calSelected = dateKey(new Date());
  drawCalendar();
  loadNote();
}
function loadNote() {
  const notes = getPeriodNotes();
  const note = notes[calSelected];
  // 兼容旧数据（纯字符串）和新数据（对象）
  const noteText = typeof note === 'string' ? note : (note?.text || '');
  const flow = typeof note === 'object' ? (note?.flow || '') : '';
  const symptoms = typeof note === 'object' ? (note?.symptoms || []) : [];

  $('#noteArea').value = noteText;
  const [y, m, d] = calSelected.split('-');
  $('#noteDateLabel').textContent = `${y}年${parseInt(m)}月${parseInt(d)}日`;

  // 流量选中
  $$('#flowSelector .flow-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.flow === flow));

  // 症状标签
  $('#symptomChips').innerHTML = PERIOD_SYMPTOMS.map(s =>
    `<button class="symptom-chip ${symptoms.includes(s)?'active':''}" onclick="SymptomToggle('${s}')">${s}</button>`
  ).join('');

  // 周期预测
  const pred = predictPeriod();
  const predEl = $('#periodPredict');
  if (pred && predEl) {
    if (pred.daysUntil > 0) {
      predEl.innerHTML = `🔮 预计下次经期：<b>${pred.next}</b>（约 <b>${pred.daysUntil}</b> 天后）· 平均周期 <b>${pred.avgCycle}</b> 天`;
    } else if (pred.daysUntil === 0) {
      predEl.innerHTML = `🔮 预计今天可能开始经期 · 平均周期 <b>${pred.avgCycle}</b> 天`;
    } else if (pred.daysUntil > -7) {
      predEl.innerHTML = `🔮 经期可能已开始（已过 <b>${-pred.daysUntil}</b> 天）· 平均周期 <b>${pred.avgCycle}</b> 天`;
    } else {
      predEl.innerHTML = `🔮 上次经期：<b>${pred.last}</b> · 平均周期 <b>${pred.avgCycle}</b> 天`;
    }
  }
}
function FlowSet(flow) {
  const notes = getPeriodNotes();
  const note = notes[calSelected];
  if (typeof note === 'string' || !note) {
    notes[calSelected] = { text: typeof note === 'string' ? note : '', flow, symptoms: [] };
  } else {
    note.flow = note.flow === flow ? '' : flow;
  }
  setPeriodNotes(notes);
  loadNote();
  drawCalendar();
}
function SymptomToggle(symptom) {
  const notes = getPeriodNotes();
  let note = notes[calSelected];
  if (typeof note === 'string' || !note) {
    note = { text: typeof note === 'string' ? note : '', flow: '', symptoms: [] };
  }
  if (!note.symptoms) note.symptoms = [];
  const i = note.symptoms.indexOf(symptom);
  if (i >= 0) note.symptoms.splice(i, 1);
  else note.symptoms.push(symptom);
  notes[calSelected] = note;
  setPeriodNotes(notes);
  loadNote();
  drawCalendar();
}
function NoteSave() {
  const notes = getPeriodNotes();
  const text = $('#noteArea')?.value.trim() || '';
  const existing = notes[calSelected];
  const flow = typeof existing === 'object' ? (existing?.flow || '') : '';
  const symptoms = typeof existing === 'object' ? (existing?.symptoms || []) : [];
  if (text || flow || symptoms.length) {
    notes[calSelected] = { text, flow, symptoms };
  } else {
    delete notes[calSelected];
  }
  setPeriodNotes(notes);
  drawCalendar();
  flashSaved(event.target);
}
function NoteClear() {
  const notes = getPeriodNotes();
  delete notes[calSelected];
  setPeriodNotes(notes);
  $('#noteArea').value = '';
  drawCalendar();
  loadNote();
}
function flashSaved(btn) {
  const orig = btn.textContent;
  btn.textContent = '✓ 已保存';
  btn.style.background = 'var(--green)';
  setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1200);
}

/* =========================================================================
 * 模块 6~11：学习模块
 * ========================================================================= */
function renderLearn(key) {
  const data = LEARN_DATA[key];
  // 合并自定义任务
  const customKey = 'learn_custom_' + key;
  const customTasks = Store.get(customKey, {}); // { phaseIndex: [{t, v}] }
  const done = Store.get('learn_' + key, {});
  // 构建合并后的 phases（深拷贝 + 自定义任务）
  const phases = data.phases.map((p, pi) => ({
    title: p.title,
    tasks: [...p.tasks, ...(customTasks[pi] || [])],
  }));
  // 计算总进度
  let total = 0, completed = 0;
  phases.forEach((p, pi) => {
    p.tasks.forEach((t, ti) => {
      total++;
      if (done[`${pi}_${ti}`]) completed++;
    });
  });
  const totalPct = total ? Math.round(completed / total * 100) : 0;

  return `
    <div class="total-progress">
      <span class="total-progress-label">${escapeHtml(data.name)}总进度</span>
      <div class="total-progress-bar"><div class="total-progress-fill" style="width:${totalPct}%"></div></div>
      <span class="total-progress-text">${completed}/${total}</span>
    </div>
    ${phases.map((p, pi) => {
      let pTotal = p.tasks.length, pDone = p.tasks.filter((t, ti) => done[`${pi}_${ti}`]).length;
      const pct = pTotal ? Math.round(pDone / pTotal * 100) : 0;
      const isCustom = (ti) => ti >= (data.phases[pi]?.tasks.length || 0);
      return `
        <div class="phase" id="phase_${key}_${pi}">
          <div class="phase-header" onclick="PhaseToggle('${key}',${pi})" role="button" tabindex="0">
            <div class="phase-title"><span class="phase-arrow">▼</span>${escapeHtml(p.title)}</div>
            <div class="phase-progress">
              <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
              <span class="progress-text">${pDone}/${pTotal}</span>
            </div>
          </div>
          <div class="phase-body">
            ${p.tasks.map((t, ti) => `
              <div class="task ${done[`${pi}_${ti}`]?'done':''}">
                <div class="checkbox ${done[`${pi}_${ti}`]?'checked':''}" role="checkbox" tabindex="0" aria-checked="${!!done[`${pi}_${ti}`]}" onclick="TaskToggle('${key}',${pi},${ti})" onkeydown="if(event.key===' '||event.key==='Enter'){event.preventDefault();TaskToggle('${key}',${pi},${ti})}"></div>
                <span class="task-text">${escapeHtml(t.t)}</span>
                ${t.v ? `<a class="task-video" href="${safeUrl(t.v)}" target="_blank" rel="noopener">▶ 视频</a>` : ''}
                ${isCustom(ti) ? `<span class="learn-task-delete" onclick="LearnDelTask('${key}',${pi},${ti})" title="删除">✕</span>` : ''}
              </div>
            `).join('')}
            <div class="learn-add-task">
              <input class="input" placeholder="添加自定义任务…" onkeydown="if(event.key==='Enter')LearnAddTask('${key}',${pi},this)" />
              <button class="btn btn-soft btn-sm" onclick="LearnAddTaskInput('${key}',${pi},this)">+ 添加</button>
            </div>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

function LearnAddTask(key, pi, inputEl) {
  const v = inputEl.value.trim();
  if (!v) return;
  const customKey = 'learn_custom_' + key;
  const custom = Store.get(customKey, {});
  if (!custom[pi]) custom[pi] = [];
  custom[pi].push({ t: v, v: '' });
  Store.set(customKey, custom);
  renderModule(currentModule);
}
function LearnAddTaskInput(key, pi, btnEl) {
  const input = btnEl.previousElementSibling;
  if (input) LearnAddTask(key, pi, input);
}
function LearnDelTask(key, pi, ti) {
  const data = LEARN_DATA[key];
  const customKey = 'learn_custom_' + key;
  const custom = Store.get(customKey, {});
  if (!custom[pi]) return;
  const customIdx = ti - (data.phases[pi]?.tasks.length || 0);
  if (customIdx >= 0 && customIdx < custom[pi].length) {
    custom[pi].splice(customIdx, 1);
    Store.set(customKey, custom);
    // 清理对应的 done 状态
    const doneKey = 'learn_' + key;
    const done = Store.get(doneKey, {});
    delete done[`${pi}_${ti}`];
    Store.set(doneKey, done);
  }
  renderModule(currentModule);
}

function PhaseToggle(key, pi) {
  const el = document.getElementById(`phase_${key}_${pi}`);
  if (el) el.classList.toggle('collapsed');
}

function TaskToggle(key, pi, ti) {
  const k = 'learn_' + key;
  const done = Store.get(k, {});
  const id = `${pi}_${ti}`;
  done[id] = !done[id];
  Store.set(k, done);
  // 局部更新：重新渲染该模块
  renderModule(currentModule);
}

/* =========================================================================
 * 模块：数据统计（汇总各模块数据，可视化展示）
 * ========================================================================= */
function renderStats() {
  // ===== 1. 收集最近7天打卡数据 =====
  const today = new Date();
  const days7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const todos = Store.get('daily_' + key + '_todos', []);
    const done = todos.filter(t => t.done).length;
    const total = todos.length;
    const water = Store.get('daily_' + key + '_water', 0);
    const words = Store.get('daily_' + key + '_words', 0);
    const sports = Store.get('daily_' + key + '_sports', []);
    days7.push({ date: key, label: `${d.getMonth()+1}/${d.getDate()}`, done, total, water, words, sports: sports.length });
  }

  // ===== 2. 学习进度 =====
  const learnStats = {};
  let learnTotalAll = 0, learnDoneAll = 0;
  Object.keys(LEARN_DATA).forEach(key => {
    const d = LEARN_DATA[key];
    const done = Store.get('learn_' + key, {});
    let total = 0, doneCount = 0;
    d.phases.forEach((p, pi) => p.tasks.forEach((t, ti) => {
      total++;
      if (done[`${pi}_${ti}`]) doneCount++;
    }));
    // 加上自定义任务
    const custom = Store.get('learn_custom_' + key, {});
    Object.entries(custom).forEach(([pi, arr]) => {
      if (Array.isArray(arr)) {
        arr.forEach((_, ci) => {
          const baseLen = d.phases[pi]?.tasks.length || 0;
          const ti = baseLen + ci;
          total++;
          if (done[`${pi}_${ti}`]) doneCount++;
        });
      }
    });
    learnStats[key] = { name: d.name, done: doneCount, total, pct: total > 0 ? Math.round(doneCount / total * 100) : 0 };
    learnTotalAll += total;
    learnDoneAll += doneCount;
  });

  // ===== 3. 衣橱统计 =====
  const clothes = Store.get('wardrobe_items', []);
  const wardrobeByCategory = {};
  clothes.forEach(c => {
    const cat = c.category || '未分类';
    wardrobeByCategory[cat] = (wardrobeByCategory[cat] || 0) + 1;
  });

  // ===== 4. 经期统计 =====
  const periodNotes = Store.get('period_notes', {});
  const periodDays = Object.keys(periodNotes).filter(k => periodNotes[k] && typeof periodNotes[k] === 'object' && periodNotes[k].flow);
  const periodPredict = predictPeriod();

  // ===== 5. 待办完成率（近7天） =====
  const totalTodos7 = days7.reduce((s, d) => s + d.total, 0);
  const doneTodos7 = days7.reduce((s, d) => s + d.done, 0);
  const todoRate = totalTodos7 > 0 ? Math.round(doneTodos7 / totalTodos7 * 100) : 0;

  // ===== 6. 总字数 =====
  const totalWords = days7.reduce((s, d) => s + d.words, 0);

  // ===== 7. 喝水达标天数 =====
  const waterGoal = Store.get('water_goal', 6);
  const waterMetDays = days7.filter(d => d.water >= waterGoal).length;

  // ===== 渲染 =====
  const maxTodos = Math.max(...days7.map(d => d.total), 1);
  const maxWater = Math.max(...days7.map(d => d.water), waterGoal, 1);

  return `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-title"><span class="ico">📈</span>总览</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-icon">✅</div>
          <div class="stat-card-num">${todoRate}%</div>
          <div class="stat-card-label">近7天待办完成率</div>
          <div class="stat-card-sub">${doneTodos7}/${totalTodos7} 件</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">💧</div>
          <div class="stat-card-num">${waterMetDays}/7</div>
          <div class="stat-card-label">喝水达标天数</div>
          <div class="stat-card-sub">目标 ${waterGoal} 杯/天</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">📚</div>
          <div class="stat-card-num">${learnDoneAll}/${learnTotalAll}</div>
          <div class="stat-card-label">学习任务完成</div>
          <div class="stat-card-sub">${learnTotalAll > 0 ? Math.round(learnDoneAll/learnTotalAll*100) : 0}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">✍️</div>
          <div class="stat-card-num">${totalWords}</div>
          <div class="stat-card-label">近7天码字总数</div>
          <div class="stat-card-sub">字</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">👗</div>
          <div class="stat-card-num">${clothes.length}</div>
          <div class="stat-card-label">衣橱单品</div>
          <div class="stat-card-sub">${Object.keys(wardrobeByCategory).length} 个分类</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">🌸</div>
          <div class="stat-card-num">${periodDays.length}</div>
          <div class="stat-card-label">经期记录天数</div>
          <div class="stat-card-sub">${periodPredict ? `下次约 ${periodPredict.daysUntil > 0 ? periodPredict.daysUntil + '天后' : '已过期'}` : '暂无预测'}</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="card-title"><span class="ico">📚</span>学习进度</div>
      ${learnTotalAll > 0 ? `
        <div class="stats-progress-ring" style="margin-bottom:16px;">
          ${Object.entries(learnStats).map(([key, s]) => {
            const r = 38, c = 2 * Math.PI * r;
            const offset = c - (s.pct / 100) * c;
            return `
              <div class="stats-ring-item">
                <div class="stats-ring">
                  <svg width="100" height="100">
                    <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--card-soft)" stroke-width="6"/>
                    <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--primary)" stroke-width="6"
                      stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
                  </svg>
                  <div class="stats-ring-text">${s.pct}%</div>
                </div>
                <div class="stats-ring-label">${escapeHtml(s.name)}</div>
              </div>
            `;
          }).join('')}
        </div>
      ` : '<div class="stats-empty">暂无学习数据</div>'}
    </div>

    ${Object.keys(wardrobeByCategory).length > 0 ? `
      <div class="card">
        <div class="card-title"><span class="ico">👗</span>衣橱分类</div>
        <div class="stats-bar-chart">
          ${Object.entries(wardrobeByCategory).sort((a,b) => b[1] - a[1]).map(([cat, count]) => {
            const maxCat = Math.max(...Object.values(wardrobeByCategory), 1);
            return `
              <div class="stats-bar-row">
                <div class="stats-bar-label">${escapeHtml(cat)}</div>
                <div class="stats-bar-track">
                  <div class="stats-bar-fill accent" style="width:${Math.max(count / maxCat * 100, 8)}%;">${count}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}
  `;
}
