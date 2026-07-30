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
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
};

const fmtDate = d => {
  const w = ['日','一','二','三','四','五','六'][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 星期${w}`;
};
const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

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
    try { localStorage.setItem('wardrobe_items', JSON.stringify(arr)); } catch {}
  }
}

/* ---------- 模块配置 ---------- */
const MODULES = [
  { id: 'home',     icon: '🏠', label: '首页' },
  { id: 'daily',    icon: '✅', label: '每日打卡' },
  { id: 'headline', icon: '📰', label: '今日头条' },
  { id: 'wardrobe', icon: '👗', label: '电子衣橱' },
  { id: 'fun',      icon: '🎮', label: '休闲娱乐' },
  { id: 'meal',     icon: '🍱', label: '均衡膳食' },
  { id: 'period',   icon: '🌸', label: '经期记录' },
  { id: 'piano',    icon: '🎹', label: '钢琴学习' },
  { id: 'chess',    icon: '♟️', label: '象棋学习' },
  { id: 'calli',    icon: '✒️', label: '行楷书法' },
  { id: 'sketch',   icon: '✏️', label: '素描学习' },
  { id: 'dance',    icon: '💃', label: '舞蹈学习' },
  { id: 'sew',      icon: '✂️', label: '裁剪学习' },
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
  };
  content.innerHTML = (map[id] || (() => '<p>模块开发中…</p>'))();
  // 模块特定绑定
  afterRender[id] && afterRender[id]();
}

const afterRender = {};

/* =========================================================================
 * 模块 0：首页（Hi OnePiece + 日期 + 天气 + 每日金句）
 * ========================================================================= */
function renderHome() {
  return `
    <div class="home-page">
      <div class="home-card">
        <div class="home-greeting">Hi, OnePiece</div>
        <div class="home-date" id="homeDate"></div>
        <div class="home-weather" id="homeWeather">
          <span class="home-weather-loading">天气加载中…</span>
        </div>
        <div class="home-divider"></div>
        <div class="home-quote" id="homeQuote">
          <span class="home-quote-loading">正在获取今日金句…</span>
        </div>
      </div>
    </div>
  `;
}

afterRender.home = () => {
  const d = new Date();
  $('#homeDate').textContent = fmtDate(d);
  fetchHomeWeather();
  fetchHomeQuote();
};

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
    // 上海经纬度，取当前天气
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=31.23&longitude=121.47&current=temperature_2m,weather_code&timezone=Asia/Shanghai';
    const res = await fetch(url);
    const data = await res.json();
    const temp = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;
    const desc = WMO_WEATHER[code] || ['未知','🌡️'];
    el.innerHTML = `<span class="home-weather-icon">${desc[1]}</span><span>上海 · ${desc[0]} ${temp}°C</span>`;
  } catch (e) {
    el.innerHTML = `<span class="home-weather-icon">🌡️</span><span>上海 · 天气获取失败</span>`;
  }
}

async function fetchHomeQuote() {
  const el = $('#homeQuote');
  if (!el) return;
  try {
    // 一言接口：c=i 诗词, c=k 哲理，随机取
    const res = await fetch('https://v1.hitokoto.cn/?c=i&c=k');
    const data = await res.json();
    const text = data.hitokoto || '今天永远是昨天死去的人所期待的明天';
    const from = data.from ? `—— ${data.from_who ? data.from_who + '·' : ''}${data.from}` : '';
    el.innerHTML = `<div class="home-quote-text">「${text}」</div>${from ? `<div class="home-quote-from">${from}</div>` : ''}`;
  } catch (e) {
    // 降级金句
    const fallback = '今天永远是昨天死去的人所期待的明天';
    el.innerHTML = `<div class="home-quote-text">「${fallback}」</div><div class="home-quote-from">—— 每日金句</div>`;
  }
}


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
  $('#waterCups').innerHTML = Array.from({length: 6}, (_, i) =>
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
  const key = dateKey(new Date());
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed += key.charCodeAt(i) * (i + 1);
  const poem = poems[seed % poems.length];
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
  { title: '红楼梦', author: '曹雪芹', wiki: '红楼梦', desc: '中国古典四大名著之首，以贾宝玉、林黛玉、薛宝钗的爱情婚姻悲剧为主线，深刻描写了贾府由盛转衰的过程。全书塑造了数百个栩栩如生的人物形象，是中国封建社会的百科全书，被誉为中国文学的巅峰之作。' },
  { title: '百年孤独', author: '加西亚·马尔克斯', wiki: '百年孤独', desc: '魔幻现实主义文学的代表作，讲述了布恩迪亚家族七代人的传奇故事和马孔多小镇的百年兴衰。作品融合神话、民间故事与现实主义，展现了拉丁美洲的历史文化与孤独宿命。1982年诺贝尔文学奖获奖作品。' },
  { title: '活着', author: '余华', wiki: '活着_(小说)', desc: '一部讲述苦难与生命韧性的当代经典。主人公福贵经历了从地主少爷到普通农民的人生巨变，亲人相继离世，却始终坚强地活着。小说以平实的笔触揭示了生命的本质——活着本身就是意义。' },
  { title: '小王子', author: '安托万·德·圣埃克苏佩里', wiki: '小王子', desc: '一部写给大人的童话。小王子从自己的星球出发，游历各星球，最终来到地球。通过与飞行员的对话，揭示了爱、责任与生命的真谛。"真正重要的东西，用眼睛是看不见的"成为经典名言。' },
  { title: '三国演义', author: '罗贯中', wiki: '三国演义', desc: '中国第一部长篇章回体历史演义小说，描写了东汉末年至西晋初年间近百年的历史风云。塑造了曹操、刘备、诸葛亮、关羽等鲜明人物形象，智谋交锋、忠义精神影响深远，是了解中国传统文化的必读之作。' },
  { title: '简·爱', author: '夏洛蒂·勃朗特', wiki: '简·爱', desc: '一部具有自传色彩的女性成长小说。简·爱自幼寄人篱下，历经磨难却始终保持独立人格与尊严。她与罗切斯特的爱情故事，传递了女性追求平等、自由与真爱的精神，是英国文学史上的经典之作。' },
  { title: '水浒传', author: '施耐庵', wiki: '水浒传', desc: '中国四大名著之一，讲述了北宋末年以宋江为首的一百零八位好汉被逼上梁山、替天行道的故事。塑造了武松、林冲、鲁智深等英雄形象，展现了"官逼民反"的社会现实，侠义精神深入人心。' },
  { title: '骆驼祥子', author: '老舍', wiki: '骆驼祥子', desc: '老舍代表作，讲述北平人力车夫祥子从满怀希望到最终堕落的人生历程。祥子三起三落的买车梦，折射出旧社会底层劳动人民的苦难命运。语言京味浓郁，是中国现代文学的现实主义杰作。' },
  { title: '平凡的世界', author: '路遥', wiki: '平凡的世界', desc: '以陕北农村为背景，描绘了孙少安、孙少平兄弟为代表的青年在时代变革中的奋斗历程。全景式展现了中国七八十年代城乡社会变迁，讴歌了普通人在困境中不屈不挠的精神，获茅盾文学奖。' },
  { title: '西游记', author: '吴承恩', wiki: '西游记', desc: '中国四大名著之一，讲述唐僧师徒四人西天取经、历经九九八十一难的故事。孙悟空的形象深入人心，全书想象力丰富、语言幽默，融神话、寓言与哲理于一体，是中国浪漫主义文学的瑰宝。' },
  { title: '围城', author: '钱钟书', wiki: '围城_(小说)', desc: '一部讽刺小说经典。以方鸿渐留学归国后的爱情与事业经历为主线，描绘了抗战时期知识分子的众生相。"婚姻是一座围城，城外的人想进去，城里的人想出来"成为传世名言，语言机智幽默、比喻精妙。' },
  { title: '老人与海', author: '海明威', wiki: '老人与海', desc: '海明威获诺贝尔奖的代表作。老渔夫圣地亚哥在海上与大马林鱼搏斗数日，最终拖回一副鱼骨架。故事简练有力，诠释了"人可以被毁灭，但不能被打败"的硬汉精神，是20世纪最伟大的中篇小说之一。' },
  { title: '城南旧事', author: '林海音', wiki: '城南旧事', desc: '以小女孩英子的视角，回忆上世纪二十年代北京城南的童年往事。透过英子纯真的眼光，呈现了成人世界的悲欢离合。文笔温柔细腻，乡愁弥漫，是台湾文学的经典之作，也是了解老北京的风情画卷。' },
  { title: '了不起的盖茨比', author: '菲茨杰拉德', wiki: '了不起的盖茨比', desc: '美国"爵士时代"的挽歌。盖茨比致富后苦恋旧爱黛西，最终梦想破灭。小说以唯美笔调揭示了"美国梦"的虚幻与物质时代的空虚，被公认为美国文学经典，多次被改编为电影。' },
];

async function fetchDailyBook() {
  const el = $('#dailyBook');
  if (!el) return;
  // 用日期种子选书，同一天同一本
  const key = dateKey(new Date());
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed += key.charCodeAt(i) * (i + 1);
  const book = CLASSIC_BOOKS[seed % CLASSIC_BOOKS.length];
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
      <div class="card-title"><span class="ico">📰</span>新闻速览 <span style="font-size:11px;color:var(--text-mute);font-weight:400;margin-left:6px;" id="newsStatus">加载中…</span></div>
      <div class="news-list" id="newsList">
        ${FALLBACK_NEWS.map(n => `
          <a class="news-item" href="${n.url}" target="_blank" rel="noopener">
            <span class="news-tag ${n.cls}">${n.tag}</span>
            <span class="news-title">${n.title}</span>
          </a>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="ico">📈</span>股市行情</div>
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

afterRender.headline = () => { fetchMarkets(); fetchNews(); };

// 拉取实时新闻：优先读取同源 news.json（由 GitHub Actions 每小时更新）
async function fetchNews() {
  const list = $('#newsList');
  const status = $('#newsStatus');
  if (!list) return;
  try {
    const res = await fetch('news.json?t=' + Date.now());
    if (!res.ok) throw new Error('news.json fetch failed');
    const data = await res.json();
    const news = data.news || [];
    if (news.length < 3) throw new Error('not enough news');
    list.innerHTML = news.map(n => `
      <a class="news-item" href="${n.url}" target="_blank" rel="noopener">
        <span class="news-tag ${n.cls}">${n.tag}</span>
        <span class="news-title">${escapeHtml(n.title)}</span>
      </a>
    `).join('');
    if (status) status.textContent = '· 更新于 ' + (data.updated || '未知');
  } catch (e) {
    // 降级：尝试通过 rss2json 在线获取（备选方案）
    try {
      const news = await fetchNewsViaRSS();
      if (news.length >= 3) {
        list.innerHTML = news.map(n => `
          <a class="news-item" href="${n.url}" target="_blank" rel="noopener">
            <span class="news-tag ${n.cls}">${n.tag}</span>
            <span class="news-title">${escapeHtml(n.title)}</span>
          </a>
        `).join('');
        if (status) status.textContent = '· 在线获取';
        return;
      }
    } catch (e2) {}
    // 最终降级：保留 FALLBACK_NEWS
    if (status) status.textContent = '· 请稍后刷新';
  }
}

// 备选方案：通过 rss2json 代理获取中新网 RSS
async function fetchNewsViaRSS() {
  const feeds = [
    { rss: 'https://www.chinanews.com.cn/rss/world.xml', tag: '国际', cls: 'tag-intl' },
  ];
  let allNews = [];
  for (const feed of feeds) {
    try {
      const url = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed.rss);
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.items) {
        allNews = allNews.concat(data.items.slice(0, 4).map(item => ({
          title: item.title, url: item.link, tag: feed.tag, cls: feed.cls,
        })));
      }
    } catch (e) { continue; }
  }
  return allNews;
}

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
  try { await ImageDB.del(id); } catch {}
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
 * 模块 3.5：休闲娱乐（折扣游戏）
 * ========================================================================= */

// 本地降级数据：6 款经典 2D 游戏（API 异常时显示）
const FALLBACK_GAMES = [
  { title: 'Hollow Knight', normalPrice: '14.99', salePrice: '7.49', savings: 50, thumb: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/367520/capsule_236x167.jpg', desc: '一款极具深度的 2D 动作冒险游戏，探索广阔的虫族王国，挑战凶猛的Boss，揭开古老的秘密。' },
  { title: 'Stardew Valley', normalPrice: '14.99', salePrice: '9.99', savings: 33, thumb: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/413150/capsule_236x167.jpg', desc: '继承爷爷的农场，开始全新的乡村生活。种植作物、养殖动物、钓鱼挖矿、结交村民，体验放松治愈的农场模拟。' },
  { title: 'Celeste', normalPrice: '19.99', salePrice: '4.99', savings: 75, thumb: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/504230/capsule_236x167.jpg', desc: '帮助玛德琳攀登塞莱斯特山，克服内心恐惧。一款关于自我挑战的精品 2D 平台跳跃游戏，关卡设计精妙绝伦。' },
  { title: 'Dead Cells', normalPrice: '24.99', salePrice: '12.49', savings: 50, thumb: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/588650/capsule_236x167.jpg', desc: 'Roguelite + 银河恶魔城玩法，快节奏 2D 战斗，每次死亡后重新探索不断变化的城堡，武器丰富、打击感极佳。' },
  { title: 'Undertale', normalPrice: '9.99', salePrice: '4.99', savings: 50, thumb: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/391540/capsule_236x167.jpg', desc: '一款颠覆传统的 RPG 游戏，你可以选择不战斗而用对话化解冲突。幽默感人的剧情、经典像素风格、神级配乐。' },
  { title: 'Ori and the Blind Forest', normalPrice: '19.99', salePrice: '4.99', savings: 75, thumb: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/261570/capsule_236x167.jpg', desc: '一款画面绝美的 2D 平台冒险游戏，操控白色精灵奥里拯救濒死的森林。视觉效果震撼，配乐催泪，关卡精巧。' },
];

function renderFun() {
  return `
    <div class="fun-page">
      <div class="fun-header">
        <div class="fun-header-title">🎮 折扣游戏推荐</div>
        <div class="fun-header-sub">实时获取热门折扣游戏，每日精选 · 价格单位：美元</div>
        <button class="btn btn-soft btn-sm fun-refresh" onclick="fetchFunGames()">🔄 刷新</button>
      </div>
      <div class="fun-grid" id="funGrid">
        <div class="fun-loading">正在获取折扣信息…</div>
      </div>
    </div>
  `;
}

afterRender.fun = () => { fetchFunGames(); };

async function fetchFunGames() {
  const grid = $('#funGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="fun-loading">正在获取折扣信息…</div>';
  try {
    // CheapShark 全平台折扣游戏，按折扣幅度排序
    const url = 'https://www.cheapshark.com/api/1.0/deals?pageSize=24&sortBy=Savings&desc=1&onSale=1';
    const res = await fetch(url);
    if (!res.ok) throw new Error('API error');
    let deals = await res.json();
    // 过滤掉折扣为0或太小的，取前6款折扣最大的
    deals = deals.filter(d => parseFloat(d.savings) > 0).slice(0, 6);
    if (deals.length < 6) throw new Error('not enough');
    const games = deals.map(d => ({
      title: d.title,
      normalPrice: parseFloat(d.normalPrice).toFixed(2),
      salePrice: parseFloat(d.salePrice).toFixed(2),
      savings: Math.round(parseFloat(d.savings)),
      thumb: d.thumb || '',
      desc: d.steamRatingText ? `Steam 评价：${d.steamRatingText}（${d.steamRatingPercent || 'N/A'}%）` : '热门折扣游戏，限时优惠中',
    }));
    renderFunGames(games);
  } catch (e) {
    // 降级为本地预设数据
    renderFunGames(FALLBACK_GAMES);
  }
}

function renderFunGames(games) {
  const grid = $('#funGrid');
  if (!grid) return;
  grid.innerHTML = games.map(g => `
    <div class="fun-card">
      <div class="fun-card-img" style="background-image:url('${g.thumb}')" onerror="this.style.background='linear-gradient(135deg,var(--primary-soft),var(--accent-soft))';this.innerHTML='<span class=\\'fun-img-fallback\\'>🎮</span>'">
        ${g.savings >= 70 ? '<span class="fun-badge-hot">🔥超值</span>' : ''}
      </div>
      <div class="fun-card-body">
        <div class="fun-card-title">${escapeHtml(g.title)}</div>
        <div class="fun-card-prices">
          <span class="fun-price-old">$${g.normalPrice}</span>
          <span class="fun-price-new">$${g.salePrice}</span>
          <span class="fun-price-off">-${g.savings}%</span>
        </div>
        <div class="fun-card-desc">${escapeHtml(g.desc)}</div>
      </div>
    </div>
  `).join('');
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
      <div class="meal-day-info">每日根据日期自动更换 · 共 ${MEALS.length} 道菜 · 今日合计约 ${totalCal} 千卡</div>
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
