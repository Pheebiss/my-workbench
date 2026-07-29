/* =========================================================================
 * 我的工作台 - 主应用脚本
 * 数据持久化：localStorage
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
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
};

const fmtDate = d => {
  const w = ['日','一','二','三','四','五','六'][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 星期${w}`;
};
const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

/* ---------- 模块配置 ---------- */
const MODULES = [
  { id: 'daily',    icon: '✓', label: '每日打卡' },
  { id: 'headline', icon: '☰', label: '今日头条' },
  { id: 'wardrobe', icon: '◇', label: '电子衣橱' },
  { id: 'meal',     icon: '○', label: '均衡膳食' },
  { id: 'period',   icon: '●', label: '经期记录' },
  { id: 'piano',    icon: '♫', label: '钢琴学习' },
  { id: 'chess',    icon: '♞', label: '象棋学习' },
  { id: 'calli',    icon: '✍', label: '行楷书法' },
  { id: 'sketch',   icon: '✐', label: '素描学习' },
  { id: 'dance',    icon: '✦', label: '舞蹈学习' },
  { id: 'sew',      icon: '✂', label: '裁剪学习' },
];

const LEARN_DATA = {
  piano: {
    name: '钢琴',
    phases: [
      { title: '第一阶段·基础入门', tasks: [
        { t: '认识钢琴键盘与中央C', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '正确坐姿与手型', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '学习五线谱基础', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '练习右手单音弹奏', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
      { title: '第二阶段·节奏训练', tasks: [
        { t: '学习四分、八分音符', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '节拍器配合练习', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '《小星星》完整弹奏', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
      { title: '第三阶段·双手协调', tasks: [
        { t: '左手和弦伴奏练习', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '《欢乐颂》双手弹奏', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '简单指法转换训练', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
    ],
  },
  chess: {
    name: '象棋',
    phases: [
      { title: '第一阶段·认识棋盘', tasks: [
        { t: '棋盘各线与九宫认识', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '各棋子走法：车马炮', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '各棋子走法：相士帅', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '兵卒规则与过河', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
      { title: '第二阶段·基本杀法', tasks: [
        { t: '马后炮杀法', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '双将杀与闷杀', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '铁门栓杀法', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
      { title: '第三阶段·开局原理', tasks: [
        { t: '中炮开局学习', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '屏风马应对', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '仙人指路开局', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
    ],
  },
  calli: {
    name: '行楷书法',
    phases: [
      { title: '第一阶段·用笔基础', tasks: [
        { t: '毛笔/钢笔执笔姿势', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '中锋与侧锋练习', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '基本笔画：横竖撇捺', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
      { title: '第二阶段·行楷笔法', tasks: [
        { t: '连笔与牵丝练习', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '偏旁部首写法', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '常用字结构训练', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
      { title: '第三阶段·篇章练习', tasks: [
        { t: '临摹《兰亭序》片段', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '行楷作品创作', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
    ],
  },
  sketch: {
    name: '素描',
    phases: [
      { title: '第一阶段·线条与透视', tasks: [
        { t: '排线练习：横竖斜', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '一点透视原理', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '两点透视原理', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
      { title: '第二阶段·明暗关系', tasks: [
        { t: '三大面五调子', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '球体明暗素描', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '正方体明暗素描', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
      { title: '第三阶段·静物组合', tasks: [
        { t: '单体静物：苹果', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '组合静物写生', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '质感表现练习', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
    ],
  },
  dance: {
    name: '中国舞',
    phases: [
      { title: '第一阶段·基本功', tasks: [
        { t: '热身与软开度训练', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '下腰与压腿', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '基本手位与脚位', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
      { title: '第二阶段·身韵训练', tasks: [
        { t: '提、沉、冲、靠', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '云手与风火轮', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '圆场步练习', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
      { title: '第三阶段·剧目片段', tasks: [
        { t: '学习扇子舞片段', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '水袖基本动作', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '完整剧目跟练', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
    ],
  },
  sew: {
    name: '裁缝',
    phases: [
      { title: '第一阶段·工具与针法', tasks: [
        { t: '认识缝纫工具与布料', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '平针缝与回针缝', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '锁边缝与藏针缝', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
      { title: '第二阶段·量体与制版', tasks: [
        { t: '人体测量方法', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '基础裙装制版', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '纸样转印到布料', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
      { title: '第三阶段·成衣制作', tasks: [
        { t: '缝制简易束口袋', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '半身裙缝制', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
        { t: '缝纫机使用入门', v: 'https://www.bilibili.com/video/BV1T4411A7cN' },
      ]},
    ],
  },
};

const WARDROBE = {
  tops: [
    { emoji: '▣', name: '白衬衫' },
    { emoji: '▢', name: '条纹T恤' },
    { emoji: '◇', name: '雪纺衫' },
    { emoji: '▤', name: '针织毛衣' },
    { emoji: '▦', name: '风衣外套' },
    { emoji: '▪', name: '背心' },
  ],
  bottoms: [
    { emoji: '▩', name: '牛仔裤' },
    { emoji: '▧', name: '黑色西裤' },
    { emoji: '▭', name: '短裤' },
    { emoji: '△', name: '半身裙' },
    { emoji: '▰', name: '连衣裙' },
    { emoji: '▬', name: '阔腿裤' },
  ],
};

const MEALS = [
  { name: '鸡胸肉蔬菜沙拉', cal: '约 280 千卡', desc: '高蛋白低脂，搭配时令蔬菜，清爽饱腹。', grad: ['#ffd6a5','#caffbf'] },
  { name: '番茄豆腐汤', cal: '约 150 千卡', desc: '酸甜开胃，豆腐补钙，低卡暖胃。', grad: ['#ff9a9e','#fad0c4'] },
  { name: '糙米三文鱼饭', cal: '约 420 千卡', desc: '优质碳水加Omega-3，营养均衡。', grad: ['#a18cd1','#fbc2eb'] },
  { name: '清炒西兰花', cal: '约 90 千卡', desc: '高纤维维C丰富，简单快炒保留营养。', grad: ['#84fab0','#8fd3f4'] },
  { name: '荞麦冷面', cal: '约 320 千卡', desc: '低GI主食，搭配蛋丝黄瓜，夏日清爽。', grad: ['#e0c3fc','#8ec5fc'] },
  { name: '清蒸鲈鱼', cal: '约 200 千卡', desc: '优质蛋白，原汁原味，低脂健康。', grad: ['#fccb90','#d57eeb'] },
];

/* ---------- 应用状态 ---------- */
let currentModule = 'daily';

/* ---------- 初始化 ---------- */
document.addEventListener('DOMContentLoaded', () => {
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

  // 大屏自动收起（桌面体验）—— 默认不收起，保持完整显示
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
    daily: renderDaily,
    headline: renderHeadline,
    wardrobe: renderWardrobe,
    meal: renderMeal,
    period: renderPeriod,
    piano: () => renderLearn('piano'),
    chess: () => renderLearn('chess'),
    calli: () => renderLearn('calli'),
    sketch: () => renderLearn('sketch'),
    dance: () => renderLearn('dance'),
    sew: () => renderLearn('sew'),
  };
  content.innerHTML = (map[id] || (() => '<p>模块开发中…</p>'))();
  // 模块特定绑定
  afterRender[id] && afterRender[id]();
}

const afterRender = {};

/* =========================================================================
 * 模块 1：每日打卡
 * ========================================================================= */
function renderDaily() {
  return `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-title"><span class="ico">☑</span>待办事项</div>
        <div class="input-group" style="margin-bottom:12px;">
          <input class="input" id="todoInput" placeholder="添加任务，如：写周报" onkeydown="if(event.key==='Enter')TodoAdd()">
          <button class="btn" onclick="TodoAdd()">添加</button>
        </div>
        <div class="todo-list" id="todoList"></div>
      </div>

      <div class="card">
        <div class="card-title"><span class="ico">≋</span>喝水记录</div>
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
  `;
}

const todayKey = () => 'daily_' + dateKey(new Date());

afterRender.daily = () => {
  renderTodos();
  renderWater();
  renderSports();
  renderWords();
};

/* --- 待办 --- */
function getTodos() { return Store.get(todayKey() + '_todos', []); }
function setTodos(v) { Store.set(todayKey() + '_todos', v); }

function renderTodos() {
  const list = $('#todoList');
  const todos = getTodos();
  if (!todos.length) { list.innerHTML = '<div class="empty-hint">还没有任务，添加一个吧～</div>'; return; }
  list.innerHTML = todos.map((t, i) => `
    <div class="todo-item ${t.done?'done':''}">
      <div class="checkbox ${t.done?'checked':''}" onclick="TodoToggle(${i})"></div>
      <span class="todo-text">${escapeHtml(t.text)}</span>
      <span class="todo-delete" onclick="TodoDel(${i})">✕</span>
    </div>
  `).join('');
}
function TodoAdd() {
  const inp = $('#todoInput');
  const v = inp.value.trim();
  if (!v) return;
  const todos = getTodos();
  todos.push({ text: v, done: false });
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
  $('#waterCount').textContent = n;
  $('#waterCups').innerHTML = Array.from({length: 8}, (_, i) =>
    `<div class="cup ${i < n ? 'filled' : ''}" title="${i+1}杯" onclick="WaterSet(${i+1})"></div>`
  ).join('');
}
function WaterSet(n) {
  const cur = getWater();
  setWater(n === cur ? n - 1 : n);
  renderWater();
}
function WaterReset() { setWater(0); renderWater(); }

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

/* =========================================================================
 * 模块 2：今日头条
 * ========================================================================= */
const NEWS = [
  { tag: '国内', cls: 'tag-domestic', title: '国务院发布新一轮稳就业稳经济政策举措' },
  { tag: '国际', cls: 'tag-intl', title: '多国央行行长就全球通胀形势展开磋商' },
  { tag: '财经', cls: 'tag-finance', title: 'A股三大指数集体收涨，科技板块领涨' },
  { tag: '科技', cls: 'tag-tech', title: '国产大模型迭代升级，多模态能力提升' },
  { tag: '体育', cls: 'tag-sports', title: '中国女排备战世界锦标赛集训名单公布' },
  { tag: '娱乐', cls: 'tag-entertain', title: '暑期档电影票房持续走高，多部新片定档' },
];

const MARKETS = [
  { name: '上证指数', value: '3,187.42', change: '+1.23%', up: true },
  { name: '深证成指', value: '10,526.18', change: '+1.56%', up: true },
  { name: '黄金价格', value: '568.30 元/克', change: '-0.42%', up: false },
  { name: '美元/人民币', value: '7.1985', change: '-0.18%', up: false },
];

function renderHeadline() {
  return `
    <div class="card">
      <div class="card-title"><span class="ico">☰</span>新闻速览</div>
      <div class="news-list">
        ${NEWS.map(n => `
          <div class="news-item" onclick="alert('示例新闻：${n.title}')">
            <span class="news-tag ${n.cls}">${n.tag}</span>
            <span class="news-title">${n.title}</span>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--text-lighter);">* 数据为示例，可在 app.js 中修改</div>
    </div>

    <div class="card">
      <div class="card-title"><span class="ico">▲</span>金价 & 股市</div>
      <div class="market-grid">
        ${MARKETS.map(m => `
          <div class="market-card ${m.up?'up':'down'}">
            <div class="market-name">${m.name}</div>
            <div class="market-value">${m.value}</div>
            <div class="market-change">${m.up?'▲':'▼'} ${m.change}</div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--text-lighter);">* 示例数据，涨为绿，跌为红</div>
    </div>
  `;
}

/* =========================================================================
 * 模块 3：电子衣橱
 * ========================================================================= */
function renderWardrobe() {
  return `
    <div class="card">
      <div class="card-title"><span class="ico">♦</span>今日穿搭</div>
      <div class="outfit-result" id="outfitResult">请选择上衣和下装～</div>
      <div class="outfit-actions" style="margin-bottom:16px;">
        <button class="btn" onclick="ClothRandom()">随机搭配</button>
        <button class="btn btn-ghost" onclick="ClothClear()">清空选择</button>
      </div>
      <div class="wardrobe-layout">
        <div>
          <div style="font-size:13px;color:var(--text-light);margin-bottom:8px;font-weight:500;">上衣</div>
          <div class="clothes-list" id="topsList">
            ${WARDROBE.tops.map((c,i) => `
              <div class="clothing-item" data-type="top" data-i="${i}" onclick="ClothToggle('top',${i})">
                <span class="clothing-emoji">${c.emoji}</span><span>${c.name}</span>
              </div>`).join('')}
          </div>
        </div>
        <div>
          <div style="font-size:13px;color:var(--text-light);margin-bottom:8px;font-weight:500;">下装</div>
          <div class="clothes-list" id="bottomsList">
            ${WARDROBE.bottoms.map((c,i) => `
              <div class="clothing-item" data-type="bottom" data-i="${i}" onclick="ClothToggle('bottom',${i})">
                <span class="clothing-emoji">${c.emoji}</span><span>${c.name}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

let selTop = null, selBottom = null;

afterRender.wardrobe = () => {
  selTop = Store.get('wardrobe_top', null);
  selBottom = Store.get('wardrobe_bottom', null);
  updateClothUI();
};

function ClothToggle(type, i) {
  if (type === 'top') selTop = (selTop === i ? null : i);
  else selBottom = (selBottom === i ? null : i);
  Store.set('wardrobe_top', selTop);
  Store.set('wardrobe_bottom', selBottom);
  updateClothUI();
}
function ClothClear() {
  selTop = null; selBottom = null;
  Store.set('wardrobe_top', null);
  Store.set('wardrobe_bottom', null);
  updateClothUI();
}
function ClothRandom() {
  selTop = Math.floor(Math.random() * WARDROBE.tops.length);
  selBottom = Math.floor(Math.random() * WARDROBE.bottoms.length);
  Store.set('wardrobe_top', selTop);
  Store.set('wardrobe_bottom', selBottom);
  updateClothUI();
}
function updateClothUI() {
  $$('#topsList .clothing-item').forEach(el => el.classList.toggle('selected', +el.dataset.i === selTop));
  $$('#bottomsList .clothing-item').forEach(el => el.classList.toggle('selected', +el.dataset.i === selBottom));
  const r = $('#outfitResult');
  if (selTop !== null && selBottom !== null) {
    const t = WARDROBE.tops[selTop], b = WARDROBE.bottoms[selBottom];
    r.innerHTML = `今日穿搭：<b>${t.emoji} ${t.name}</b> + <b>${b.emoji} ${b.name}</b>`;
  } else {
    r.textContent = '请选择上衣和下装～';
  }
}

/* =========================================================================
 * 模块 4：均衡膳食
 * ========================================================================= */
function renderMeal() {
  return `
    <div class="card">
      <div class="card-title"><span class="ico">♥</span>低卡菜式推荐</div>
      <div class="meal-grid">
        ${MEALS.map(m => `
          <div class="meal-card">
            <div class="meal-img" style="background:linear-gradient(135deg, ${m.grad[0]}, ${m.grad[1]});"><span style="font-size:20px;color:rgba(255,255,255,0.9);font-weight:700;">${m.name[0]}</span></div>
            <div class="meal-body">
              <div class="meal-name">${m.name}</div>
              <div class="meal-cal">${m.cal}</div>
              <div class="meal-desc">${m.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

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
            <button onclick="CalMove(-1)">‹</button>
            <button onclick="CalMove(1)">›</button>
            <button onclick="CalToday()" title="回到今天">·</button>
          </div>
        </div>
        <div class="cal-grid" id="calGrid"></div>
      </div>
      <div class="calendar-note">
        <div class="note-date" id="noteDateLabel"></div>
        <textarea class="textarea note-area" id="noteArea" placeholder="记下当天的身体感受或备注…如：量少、腹痛"></textarea>
        <div class="note-actions">
          <button class="btn btn-sm" onclick="NoteSave()">保存笔记</button>
          <button class="btn btn-ghost btn-sm" onclick="NoteClear()">清除</button>
        </div>
      </div>
    </div>
  `;
}

afterRender.period = () => {
  calCursor = new Date();
  calSelected = dateKey(new Date());
  drawCalendar();
  loadNote();
};

function getPeriodNotes() { return Store.get('period_notes', {}); }
function setPeriodNotes(v) { Store.set('period_notes', v); }

function drawCalendar() {
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  $('#calMonth').textContent = `${y}年${m+1}月`;
  const first = new Date(y, m, 1);
  const startDay = first.getDay(); // 0=日
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const notes = getPeriodNotes();
  const todayK = dateKey(new Date());

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
    if (notes[k]) cls.push('has-note');
    cells.push(`<div class="${cls.join(' ')}" onclick="CalSelect('${k}')">${d}</div>`);
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
  const v = notes[calSelected] || '';
  $('#noteArea').value = v;
  $('#noteDateLabel').textContent = calSelected.replace(/-/g, '年').replace(/年/, '年').replace(/年(.+?)$/, '月$1').replace(/$/, '') ;
  // 简化格式化
  const [y, m, d] = calSelected.split('-');
  $('#noteDateLabel').textContent = `${y}年${parseInt(m)}月${parseInt(d)}日`;
}
function NoteSave() {
  const notes = getPeriodNotes();
  const v = $('#noteArea').value.trim();
  if (v) notes[calSelected] = v;
  else delete notes[calSelected];
  setPeriodNotes(notes);
  drawCalendar();
  // 轻提示
  flashSaved(event.target);
}
function NoteClear() {
  const notes = getPeriodNotes();
  delete notes[calSelected];
  setPeriodNotes(notes);
  $('#noteArea').value = '';
  drawCalendar();
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
  const done = Store.get('learn_' + key, {});
  // 计算总进度
  let total = 0, completed = 0;
  data.phases.forEach((p, pi) => {
    p.tasks.forEach((t, ti) => {
      total++;
      if (done[`${pi}_${ti}`]) completed++;
    });
  });
  const totalPct = total ? Math.round(completed / total * 100) : 0;

  return `
    <div class="total-progress">
      <span class="total-progress-label">${data.name}总进度</span>
      <div class="total-progress-bar"><div class="total-progress-fill" style="width:${totalPct}%"></div></div>
      <span class="total-progress-text">${completed}/${total}</span>
    </div>
    ${data.phases.map((p, pi) => {
      let pTotal = p.tasks.length, pDone = p.tasks.filter((t, ti) => done[`${pi}_${ti}`]).length;
      const pct = pTotal ? Math.round(pDone / pTotal * 100) : 0;
      return `
        <div class="phase" id="phase_${key}_${pi}">
          <div class="phase-header" onclick="PhaseToggle('${key}',${pi})">
            <div class="phase-title"><span class="phase-arrow">▼</span>${p.title}</div>
            <div class="phase-progress">
              <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
              <span class="progress-text">${pDone}/${pTotal}</span>
            </div>
          </div>
          <div class="phase-body">
            ${p.tasks.map((t, ti) => `
              <div class="task ${done[`${pi}_${ti}`]?'done':''}">
                <div class="checkbox ${done[`${pi}_${ti}`]?'checked':''}" onclick="TaskToggle('${key}',${pi},${ti})"></div>
                <span class="task-text">${t.t}</span>
                ${t.v ? `<a class="task-video" href="${t.v}" target="_blank">▶ 视频</a>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('')}
  `;
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

/* ---------- 辅助 ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
