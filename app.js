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
  { id: 'calli',    icon: '书', label: '行楷书法' },
  { id: 'sketch',   icon: '✐', label: '素描学习' },
  { id: 'dance',    icon: '✦', label: '舞蹈学习' },
  { id: 'sew',      icon: '✂', label: '裁剪学习' },
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

const MEALS = [
  // 早餐
  { name: '燕麦牛奶杯', cal: '约 250 千卡', desc: '高纤维燕麦搭配牛奶，饱腹持久。', grad: ['#ffd6a5','#caffbf'], meal: 'breakfast' },
  { name: '全麦三明治', cal: '约 320 千卡', desc: '全麦面包夹蛋生菜，营养均衡。', grad: ['#ff9a9e','#fad0c4'], meal: 'breakfast' },
  { name: '小米南瓜粥', cal: '约 180 千卡', desc: '暖胃养胃，低卡好消化。', grad: ['#fccb90','#d57eeb'], meal: 'breakfast' },
  { name: '紫薯豆浆', cal: '约 220 千卡', desc: '花青素加植物蛋白，抗氧化。', grad: ['#a18cd1','#fbc2eb'], meal: 'breakfast' },
  { name: '鸡蛋蔬菜卷饼', cal: '约 280 千卡', desc: '蛋白质加膳食纤维，方便快手。', grad: ['#84fab0','#8fd3f4'], meal: 'breakfast' },
  { name: '玉米虾仁粥', cal: '约 240 千卡', desc: '鲜虾优质蛋白，玉米甜香。', grad: ['#e0c3fc','#8ec5fc'], meal: 'breakfast' },
  { name: '酸奶水果碗', cal: '约 200 千卡', desc: '益生菌加维生素，清爽开胃。', grad: ['#ffecd2','#fcb69f'], meal: 'breakfast' },
  // 午餐
  { name: '鸡胸肉蔬菜沙拉', cal: '约 280 千卡', desc: '高蛋白低脂，搭配时令蔬菜，清爽饱腹。', grad: ['#ffd6a5','#caffbf'], meal: 'lunch' },
  { name: '糙米三文鱼饭', cal: '约 420 千卡', desc: '优质碳水加Omega-3，营养均衡。', grad: ['#a18cd1','#fbc2eb'], meal: 'lunch' },
  { name: '荞麦冷面', cal: '约 320 千卡', desc: '低GI主食，搭配蛋丝黄瓜，夏日清爽。', grad: ['#e0c3fc','#8ec5fc'], meal: 'lunch' },
  { name: '清蒸鲈鱼', cal: '约 200 千卡', desc: '优质蛋白，原汁原味，低脂健康。', grad: ['#fccb90','#d57eeb'], meal: 'lunch' },
  { name: '番茄牛腩饭', cal: '约 480 千卡', desc: '番茄酸甜开胃，牛腩补铁。', grad: ['#ff9a9e','#fad0c4'], meal: 'lunch' },
  { name: '藜麦鸡肉碗', cal: '约 380 千卡', desc: '超级谷物搭配嫩滑鸡胸。', grad: ['#84fab0','#8fd3f4'], meal: 'lunch' },
  { name: '日式照烧鸡饭', cal: '约 450 千卡', desc: '甜咸酱汁配米饭，满足不腻。', grad: ['#ffecd2','#fcb69f'], meal: 'lunch' },
  // 晚餐
  { name: '番茄豆腐汤', cal: '约 150 千卡', desc: '酸甜开胃，豆腐补钙，低卡暖胃。', grad: ['#ff9a9e','#fad0c4'], meal: 'dinner' },
  { name: '清炒西兰花', cal: '约 90 千卡', desc: '高纤维维C丰富，简单快炒保留营养。', grad: ['#84fab0','#8fd3f4'], meal: 'dinner' },
  { name: '蒜蓉菠菜', cal: '约 80 千卡', desc: '补铁绿叶菜，清淡少油。', grad: ['#84fab0','#8fd3f4'], meal: 'dinner' },
  { name: '冬瓜虾仁汤', cal: '约 120 千卡', desc: '消水肿低热量，鲜美暖身。', grad: ['#a18cd1','#fbc2eb'], meal: 'dinner' },
  { name: '凉拌木耳', cal: '约 70 千卡', desc: '清肠排毒，脆爽可口。', grad: ['#e0c3fc','#8ec5fc'], meal: 'dinner' },
  { name: '蒸蛋羹', cal: '约 130 千卡', desc: '嫩滑易消化，老少皆宜。', grad: ['#ffd6a5','#caffbf'], meal: 'dinner' },
  { name: '紫菜蛋花汤', cal: '约 100 千卡', desc: '补碘低卡，简单快手。', grad: ['#fccb90','#d57eeb'], meal: 'dinner' },
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
  { tag: '国内', cls: 'tag-domestic', title: '国务院发布新一轮稳就业稳经济政策举措', url: 'https://www.gov.cn/zhengce/content/202507/content_7031215.htm' },
  { tag: '国际', cls: 'tag-intl', title: '多国央行行长就全球通胀形势展开磋商', url: 'https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/2026041710335851816/index.html' },
  { tag: '财经', cls: 'tag-finance', title: 'A股三大指数集体收涨，科技板块领涨', url: 'https://www.cs.com.cn/gppd/gsyj/202303/t20230303_6326834.html' },
  { tag: '科技', cls: 'tag-tech', title: '国产大模型迭代升级，多模态能力提升', url: 'https://news.cctv.com/2026/05/17/ARTIUUekaDVugGawlh5fLIjH260517.shtml' },
  { tag: '体育', cls: 'tag-sports', title: '中国女排备战世界锦标赛集训名单公布', url: 'https://www.peopleapp.com/column/30051793293-500007424021' },
  { tag: '娱乐', cls: 'tag-entertain', title: '暑期档电影票房持续走高，多部新片定档', url: 'http://www.xinhuanet.com/ent/20260707/362a0203ee804cd59a2041955a972075/c.html' },
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
      <div class="card-title"><span class="ico">☰</span>新闻速览</div>
      <div class="news-list">
        ${NEWS.map(n => `
          <a class="news-item" href="${n.url}" target="_blank" rel="noopener">
            <span class="news-tag ${n.cls}">${n.tag}</span>
            <span class="news-title">${n.title}</span>
          </a>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="ico">▲</span>股市行情</div>
      <div class="market-grid" id="marketGrid">
        ${MARKET_CODES.map(m => `
          <div class="market-card" data-code="${m.code}">
            <div class="market-name">${m.name}</div>
            <div class="market-value">加载中…</div>
            <div class="market-change">—</div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--text-mute);">数据实时更新，仅供参考</div>
    </div>
  `;
}

afterRender.headline = fetchMarkets;

// 拉取实时行情
function fetchMarkets() {
  MARKET_CODES.forEach(m => {
    const url = `https://qt.gtimg.cn/q=${m.code}`;
    fetch(url)
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
function deleteCloth(id) {
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
    const ratio = getStorageRatio();
    let maxDim = 600, quality = 0.7;
    if (ratio > 0.85) { maxDim = 400; quality = 0.3; }
    else if (ratio > 0.7) { maxDim = 500; quality = 0.5; }
    let result = await compressImage(reader.result, maxDim, quality);
    if (!result) { wdToast('图片处理失败'); return; }
    // 逐级降级
    while (estimateBase64Size(result) > 50) {
      if (quality > 0.4) { quality -= 0.2; }
      else if (maxDim > 300) { maxDim -= 100; quality = 0.5; }
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
  // 存储用量
  const usageKB = getStorageUsage();
  const usagePct = Math.round(usageKB / 5120 * 100);
  const usageMB = (usageKB / 1024).toFixed(1);

  return `
    <div class="wd-stats">
      <div class="wd-stat-item"><span class="wd-stat-num">${stats.total}</span><span class="wd-stat-label">件单品</span></div>
      ${Object.entries(stats.cats).map(([k,v]) => `<div class="wd-stat-item"><span class="wd-stat-num">${v}</span><span class="wd-stat-label">${CAT_LABELS[k]}</span></div>`).join('')}
      ${topColor ? `<div class="wd-stat-item"><span class="wd-stat-label">主色</span><span class="wd-stat-num" style="font-size:14px;">${COLOR_LABELS[topColor[0]]}</span></div>` : ''}
    </div>
    <div class="wd-storage-bar ${usagePct>85?'danger':usagePct>70?'warn':''}">
      <span>存储 ${usageMB}MB / 5MB</span>
      <div class="wd-storage-track"><div class="wd-storage-fill" style="width:${usagePct}%"></div></div>
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
            <div class="wd-card-img" style="background-image:url('${c.img}')"></div>
            <div class="wd-card-info">
              <span class="wd-card-cat">${CAT_LABELS[c.category]}</span>
              <span class="wd-card-color" style="background:${COLOR_SWATCHES[c.color]}"></span>
            </div>
          </div>`).join('')
      }
    </div>
  `;
}

function afterClosetTab() {}

function wdFilterSet(type, val) {
  const filter = Store.get('wardrobe_filter', { category: 'all', color: 'all' });
  filter[type] = val;
  Store.set('wardrobe_filter', filter);
  wdSwitchTab('closet');
}

/* === 添加/编辑表单 === */
function openAddForm() {
  if (getStorageRatio() > 0.95) { wdToast('存储空间已满，请先删除旧衣物'); return; }
  wdPendingImage = null;
  wdFormState = { cat: null, color: null, season: [], style: null, editId: null };
  showClothForm('添加衣物');
}
function openEditForm(id) {
  const c = getCloth(id); if (!c) return;
  wdPendingImage = c.img;
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

function submitClothForm() {
  if (!wdPendingImage) { wdToast('请先上传衣物照片'); return; }
  if (!wdFormState.cat) { wdToast('请选择类别'); return; }
  const note = $('#wdFormNote')?.value.trim() || '';
  if (wdFormState.editId) {
    updateCloth(wdFormState.editId, { img: wdPendingImage, category: wdFormState.cat, color: wdFormState.color || 'white', season: wdFormState.season, style: wdFormState.style, note });
    wdToast('已更新');
  } else {
    const item = { id: 'c_' + Date.now() + '_' + Math.floor(Math.random()*1000), img: wdPendingImage, category: wdFormState.cat, color: wdFormState.color || 'white', season: wdFormState.season, style: wdFormState.style, note, createdAt: Date.now() };
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
      <div class="wd-detail-img" style="background-image:url('${c.img}')"></div>
      <div class="wd-detail-tags">${tags.join('')}</div>
      ${c.note ? `<div class="wd-detail-note">${escapeHtml(c.note)}</div>` : ''}
      <div class="wd-detail-actions">
        <button class="btn btn-soft" onclick="closeModal();openEditForm('${id}')">编辑</button>
        <button class="btn btn-ghost" onclick="confirmDeleteCloth('${id}')">删除</button>
      </div>
    </div>
  `);
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
function doDeleteCloth(id) {
  deleteCloth(id);
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
                <div class="wd-match-item-img" style="background-image:url('${c.img}')"></div>
              </div>`).join('')}
          </div>
        </div>
        <div class="wd-match-col">
          <div class="wd-match-col-title">选择下装（${bottoms.length}）</div>
          <div class="wd-match-list" id="wdMatchBottoms">
            ${bottoms.length === 0 ? '<div class="wd-empty-sm">暂无下装</div>' : bottoms.map(c => `
              <div class="wd-match-item ${wdMatchState.bottomId===c.id?'selected':''}" onclick="matchSelect('bottom','${c.id}')">
                <div class="wd-match-item-img" style="background-image:url('${c.img}')"></div>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <button class="btn wd-save-outfit" onclick="saveTodayOutfit()">今天穿这套</button>
    </div>
  `;
}

function afterMatchTab() { updateMatchPreview(); }

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
        <div class="wd-match-item-img" style="background-image:url('${c.img}')"></div>
      </div>`).join('');
  }
  if (bottomsEl) {
    bottomsEl.innerHTML = bottoms.length === 0 ? '<div class="wd-empty-sm">该筛选下暂无下装</div>' : bottoms.map(c => `
      <div class="wd-match-item ${wdMatchState.bottomId===c.id?'selected':''}" onclick="matchSelect('bottom','${c.id}')">
        <div class="wd-match-item-img" style="background-image:url('${c.img}')"></div>
      </div>`).join('');
  }
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
function updateMatchPreview(score) {
  const slotTop = $('#wdPreviewTop');
  const slotBot = $('#wdPreviewBottom');
  const hint = $('#wdMatchHint');
  if (!slotTop) return;
  const t = wdMatchState.topId ? getCloth(wdMatchState.topId) : null;
  const b = wdMatchState.bottomId ? getCloth(wdMatchState.bottomId) : null;
  slotTop.innerHTML = t ? `<img src="${t.img}" />` : `<div class="wd-preview-empty">上装</div>`;
  slotTop.classList.toggle('has-item', !!t);
  slotBot.innerHTML = b ? `<img src="${b.img}" />` : `<div class="wd-preview-empty">下装</div>`;
  slotBot.classList.toggle('has-item', !!b);
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
        <div class="wd-cal-outfit-img" style="background-image:url('${it.c.img}')"></div>
        <div class="wd-cal-outfit-label">${it.label}</div>
      </div>`).join('')}
    ${o.note ? `<div class="wd-detail-note">${escapeHtml(o.note)}</div>` : ''}
    <button class="btn btn-ghost btn-sm" style="margin-top:10px;" onclick="wdCalDeleteOutfit()">删除记录</button>
  `;
}
function wdCalDeleteOutfit() {
  deleteOutfit(wdCalSelected);
  drawWdCalendar();
  loadWdCalDetail();
  wdToast('已删除穿搭记录');
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
  return `
    <div class="card">
      <div class="card-title"><span class="ico">♥</span>今日三餐推荐</div>
      <div class="meal-day-info">每日根据日期自动更换 · 今日合计约 ${totalCal} 千卡</div>
      <div class="meal-grid">
        ${daily.map(m => `
          <div class="meal-card">
            <div class="meal-tag">${m.mealLabel}</div>
            <div class="meal-img" style="background:linear-gradient(135deg, ${m.grad[0]}, ${m.grad[1]});"><span style="font-size:20px;color:rgba(255,255,255,0.9);font-weight:700;">${m.name[0]}</span></div>
            <div class="meal-body">
              <div class="meal-name">${m.name}</div>
              <div class="meal-cal">${m.cal}</div>
              <div class="meal-desc">${m.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="btn wd-refresh-meal" onclick="refreshMeal()">换一批推荐</button>
    </div>
  `;
}

// 手动换一批：用随机种子重新渲染
let mealShuffle = 0;
function refreshMeal() {
  mealShuffle++;
  window._mealOverride = dateKey(new Date()) + '-s' + mealShuffle;
  const content = $('#content');
  content.innerHTML = renderMeal();
  // 注意：不调用 afterRender.meal，否则会重置 _mealOverride
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
