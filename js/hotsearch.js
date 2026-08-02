/**
 * 每日热搜模块
 * 支持多个免费公开热搜榜单（微博/百度/抖音/知乎/B站），
 * 解析多种返回格式；联网失败时回退到内置示例数据，保证离线可用。
 *
 * 用法：
 *   const hs = new HotSearchManager(ctx, canvas);
 *   await hs.fetch('weibo');   // 拉取数据
 *   hs.draw();                 // 渲染到 ctx (800x480)
 */

function HotSearchManager(ctx, canvas) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.data = null;          // [{title, hot, url}]
    this.platform = 'weibo';
    this.lastSource = '';      // 'api' | 'offline'
    this.error = null;
}

// 平台定义：免费聚合 API（vvhan，通常允许跨域）
HotSearchManager.prototype.PLATFORMS = {
    weibo:  { name: '微博热搜', api: 'https://api.vvhan.com/api/hotlist/wbHot' },
    baidu:  { name: '百度热搜', api: 'https://api.vvhan.com/api/hotlist/baiduRD' },
    douyin: { name: '抖音热搜', api: 'https://api.vvhan.com/api/hotlist/douyinHot' },
    zhihu:  { name: '知乎热榜', api: 'https://api.vvhan.com/api/hotlist/zhihuHot' },
    bili:   { name: 'B站热搜',  api: 'https://api.vvhan.com/api/hotlist/bili' }
};

// 内置示例数据（离线兜底，避免空白屏）
HotSearchManager.prototype.SAMPLE = [
    { title: '示例：七色墨水屏正式投产，功耗再创新低', hot: '9999999' },
    { title: '示例：冷空气来袭，多地开启降温模式', hot: '8888888' },
    { title: '示例：人工智能助手走进千家万户', hot: '7777777' },
    { title: '示例：新能源汽车销量连续三月增长', hot: '6666666' },
    { title: '示例：城市夜经济焕发新活力', hot: '5555555' },
    { title: '示例：国产科幻电影票房破纪录', hot: '4444444' },
    { title: '示例：航天新任务圆满成功', hot: '3333333' },
    { title: '示例：全民健身热潮持续升温', hot: '2222222' },
    { title: '示例：智慧农业助力乡村振兴', hot: '1111111' },
    { title: '示例：开源社区迎来爆发式增长', hot: '1000000' },
    { title: '示例：极地科考取得重大突破', hot: '900000' },
    { title: '示例：绿色能源占比持续提升', hot: '800000' }
];

// 七色墨水屏调色板（与 main.js 一致）
HotSearchManager.prototype.COLORS = {
    BLACK:  '#000000',
    WHITE:  '#FFFFFF',
    RED:    '#E53935',
    YELLOW: '#FDD835',
    GREEN:  '#43A047',
    BLUE:   '#1E88E5',
    ORANGE: '#FB8C00'
};

HotSearchManager.prototype.getPlatformName = function(p) {
    return (this.PLATFORMS[p] || this.PLATFORMS.weibo).name;
};

/**
 * 拉取热搜数据
 * @param {string} platform 平台 key
 * @param {string} [apiOverride] 自定义 API 地址（覆盖默认）
 */
HotSearchManager.prototype.fetch = async function(platform, apiOverride) {
    this.platform = platform || this.platform;
    this.error = null;
    const def = this.PLATFORMS[this.platform] || this.PLATFORMS.weibo;
    const api = apiOverride || def.api;

    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const resp = await fetch(api, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(timer);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const json = await resp.json();
        const items = this._normalize(json);
        if (!items || items.length === 0) throw new Error('返回数据为空');
        this.data = items.slice(0, 20);
        this.lastSource = 'api';
        return this.data;
    } catch (e) {
        this.error = e.message || String(e);
        console.warn('[HotSearch] 在线获取失败，使用离线示例：', this.error);
        this.data = this.SAMPLE.slice(0, 20);
        this.lastSource = 'offline';
        return this.data;
    }
};

// 兼容多种返回结构
HotSearchManager.prototype._normalize = function(json) {
    if (!json) return null;
    let arr = null;
    if (Array.isArray(json)) arr = json;
    else if (Array.isArray(json.data)) arr = json.data;
    else if (json.data && Array.isArray(json.data.list)) arr = json.data.list;
    else if (Array.isArray(json.list)) arr = json.list;
    else if (json.result && Array.isArray(json.result.list)) arr = json.result.list;
    if (!arr) return null;

    return arr.map((it, i) => {
        if (typeof it === 'string') return { title: it, hot: '', url: '' };
        return {
            title: it.title || it.word || it.name || it.t || ('条目' + (i + 1)),
            hot:   it.hot || it.hotScore || it.score || it.num || it.count || '',
            url:   it.url || it.link || it.mobiUrl || ''
        };
    }).filter(it => it.title);
};

// 数字格式化（如 12345 -> 1.2万）
HotSearchManager.prototype._fmtHot = function(hot) {
    if (!hot) return '';
    const n = parseInt(String(hot).replace(/[^\d]/g, ''), 10);
    if (isNaN(n)) return String(hot);
    if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return String(n);
};

// 文本截断（按像素宽度）
HotSearchManager.prototype._truncate = function(text, maxWidth) {
    const ctx = this.ctx;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) {
        s = s.slice(0, -1);
    }
    return s + '…';
};

/**
 * 渲染热搜榜到当前 canvas
 */
HotSearchManager.prototype.draw = function() {
    if (!this.data) this.data = this.SAMPLE.slice(0, 20);
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const C = this.COLORS;

    ctx.fillStyle = C.WHITE;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekStr = weekNames[now.getDay()];

    // ---------- 顶部标题区 ----------
    // 左上角装饰
    ctx.fillStyle = C.BLACK;
    ctx.fillRect(0, 0, 8, 36);
    ctx.fillRect(0, 0, 36, 8);
    ctx.fillStyle = C.RED;
    ctx.fillRect(8, 8, 10, 4);
    ctx.fillRect(8, 8, 4, 10);
    // 右上角装饰
    ctx.fillStyle = C.BLUE;
    ctx.fillRect(W - 8, 0, 8, 36);
    ctx.fillStyle = C.BLACK;
    ctx.fillRect(W - 36, 0, 28, 8);
    ctx.fillStyle = C.YELLOW;
    ctx.fillRect(W - 20, 8, 12, 4);

    // 平台名
    const pName = this.getPlatformName(this.platform);
    ctx.font = "bold 30px 'SimHei', sans-serif";
    ctx.fillStyle = C.BLACK;
    ctx.fillText(pName, 20, 26);

    // 日期 + 星期（右侧）
    ctx.font = "14px 'SimHei', sans-serif";
    ctx.fillStyle = C.BLUE;
    const ds = `${dateStr} ${weekStr}`;
    const dsw = ctx.measureText(ds).width;
    ctx.fillText(ds, W - 20 - dsw, 28);

    // 来源标识
    ctx.font = "11px 'SimHei', sans-serif";
    ctx.fillStyle = this.lastSource === 'offline' ? C.ORANGE : C.GREEN;
    ctx.textAlign = 'right';
    ctx.fillText(this.lastSource === 'offline' ? '离线示例' : '实时', W - 20, 46);
    ctx.textAlign = 'left';

    // 分隔线
    ctx.fillStyle = C.BLACK;
    ctx.fillRect(20, 54, W - 40, 3);

    // ---------- 榜单列表 ----------
    const listTop = 66;
    const rowH = 22;
    const leftX = 22;
    const rankW = 34;            // 排名区宽度
    const hotW = 86;             // 热度区宽度
    const titleX = leftX + rankW;
    const titleMaxW = W - titleX - hotW - 16;

    const items = this.data.slice(0, Math.min(18, this.data.length));
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const y = listTop + i * rowH + rowH / 2;

        // 排名数字
        ctx.font = "bold 18px 'SimHei', sans-serif";
        let rankColor = C.BLACK;
        if (i === 0) rankColor = C.RED;
        else if (i === 1) rankColor = C.ORANGE;
        else if (i === 2) rankColor = C.YELLOW;
        ctx.fillStyle = rankColor;
        const rankStr = String(i + 1).padStart(2, '0');
        ctx.fillText(rankStr, leftX, y);

        // 标题（截断）
        ctx.font = "16px 'SimHei', sans-serif";
        ctx.fillStyle = C.BLACK;
        const t = this._truncate(item.title, titleMaxW);
        ctx.fillText(t, titleX, y);

        // 热度（右对齐）
        if (item.hot) {
            ctx.font = "12px 'SimHei', sans-serif";
            ctx.fillStyle = C.BLUE;
            const hs = this._fmtHot(item.hot);
            const hsw = ctx.measureText(hs).width;
            ctx.fillText(hs, W - 22 - hsw, y);
        }
    }

    // 底部标识
    ctx.font = "10px 'SimHei', sans-serif";
    ctx.fillStyle = C.BLACK;
    ctx.textAlign = 'left';
    ctx.fillText(pName, 20, H - 12);
    ctx.textAlign = 'right';
    ctx.fillText('7.3" EPD', W - 20, H - 12);
    ctx.textAlign = 'left';

    ctx.textBaseline = 'alphabetic';
};

if (typeof window !== 'undefined') window.HotSearchManager = HotSearchManager;
