/**
 * 每日热搜模块（纯在线）
 * 支持多个免费公开热搜榜单（微博/百度/抖音/知乎/B站），
 * 解析多种返回格式。所有数据均来自在线接口，不内置任何示例/假数据。
 *
 * 取数策略（保证「真·在线」）：
 *   1) 直连免费聚合 API（vvhan，通常允许跨域）；
 *   2) 若直连因 CORS / 网络失败，自动经 CORS 代理再取一次（仍是真实在线数据）；
 *   3) 若全部失败，明确标记「获取失败」，绝不显示假榜单。
 *
 * 用法：
 *   const hs = new HotSearchManager(ctx, canvas);
 *   const data = await hs.fetch('weibo');   // 拉取数据（在线）
 *   hs.draw();                               // 渲染到 ctx (800x480)
 */

function HotSearchManager(ctx, canvas) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.data = null;          // [{title, hot, url}]
    this.platform = 'weibo';
    this.lastSource = '';      // 'api' | ''（失败）
    this.error = null;
    this.sourceUrl = '';       // 实际取数地址（用于调试）
}

// 平台定义：免费聚合 API（vvhan）
HotSearchManager.prototype.PLATFORMS = {
    weibo:  { name: '微博热搜', api: 'https://api.vvhan.com/api/hotlist/wbHot' },
    baidu:  { name: '百度热搜', api: 'https://api.vvhan.com/api/hotlist/baiduRD' },
    douyin: { name: '抖音热搜', api: 'https://api.vvhan.com/api/hotlist/douyinHot' },
    zhihu:  { name: '知乎热榜', api: 'https://api.vvhan.com/api/hotlist/zhihuHot' },
    bili:   { name: 'B站热搜',  api: 'https://api.vvhan.com/api/hotlist/bili' }
};

// CORS 代理（直连被跨域拦截时，经这些代理再取一次真实数据；仍是线上实时数据）
HotSearchManager.prototype.PROXIES = [
    (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
    (u) => 'https://thingproxy.freeboard.io/fetch/' + u
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
 * 在线拉取热搜数据
 * @param {string} platform 平台 key
 * @param {string} [apiOverride] 自定义 API 地址（覆盖默认）
 * @returns {Array|null} 成功返回条目数组；全部来源失败返回 null
 */
HotSearchManager.prototype.fetch = async function(platform, apiOverride) {
    this.platform = platform || this.platform;
    this.error = null;
    this.data = null;
    this.lastSource = '';
    this.sourceUrl = '';

    const def = this.PLATFORMS[this.platform] || this.PLATFORMS.weibo;
    const direct = apiOverride || def.api;

    // 构造候选地址：直连优先，其次各 CORS 代理
    const candidates = [direct].concat(this.PROXIES.map(p => p(direct)));

    for (let i = 0; i < candidates.length; i++) {
        const api = candidates[i];
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 9000);
            const resp = await fetch(api, { signal: ctrl.signal, cache: 'no-store' });
            clearTimeout(timer);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const json = await resp.json();
            const items = this._normalize(json);
            if (!items || items.length === 0) throw new Error('返回数据为空');
            this.data = items.slice(0, 20);
            this.lastSource = 'api';
            this.sourceUrl = api;
            return this.data;
        } catch (e) {
            this.error = e.message || String(e);
            console.warn('[HotSearch] 来源失败（' + (i === 0 ? '直连' : '代理' + i) + '）：', this.error);
            // 继续尝试下一个候选来源
        }
    }
    // 所有在线来源均失败
    this.lastSource = '';
    return null;
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

// 文本截断（按像素宽度，左对齐测量，与 textAlign 无关）
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
 * 无数据（在线获取失败）时渲染明确的失败提示，绝不绘制假榜单。
 */
HotSearchManager.prototype.draw = function() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const C = this.COLORS;

    ctx.fillStyle = C.WHITE;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'middle';

    // ---------- 失败态 ----------
    if (!this.data || this.data.length === 0) {
        ctx.textAlign = 'center';
        ctx.fillStyle = C.RED;
        ctx.font = "bold 30px 'SimHei', sans-serif";
        ctx.fillText('热搜获取失败', W / 2, H / 2 - 24);
        ctx.fillStyle = C.BLACK;
        ctx.font = "15px 'SimHei', sans-serif";
        const msg = '请检查网络 / 接口（' + (this.error || '未知错误') + '）';
        ctx.fillText(this._truncate(msg, W - 80), W / 2, H / 2 + 14);
        ctx.fillStyle = C.BLUE;
        ctx.font = "13px 'SimHei', sans-serif";
        ctx.fillText('本模块仅显示在线实时数据', W / 2, H / 2 + 44);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        return;
    }

    ctx.textAlign = 'left';

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekStr = weekNames[now.getDay()];

    // ---------- 顶部标题区 ----------
    ctx.fillStyle = C.BLACK;
    ctx.fillRect(0, 0, 8, 36);
    ctx.fillRect(0, 0, 36, 8);
    ctx.fillStyle = C.RED;
    ctx.fillRect(8, 8, 10, 4);
    ctx.fillRect(8, 8, 4, 10);
    ctx.fillStyle = C.BLUE;
    ctx.fillRect(W - 8, 0, 8, 36);
    ctx.fillStyle = C.BLACK;
    ctx.fillRect(W - 36, 0, 28, 8);
    ctx.fillStyle = C.YELLOW;
    ctx.fillRect(W - 20, 8, 12, 4);

    const pName = this.getPlatformName(this.platform);
    ctx.font = "bold 30px 'SimHei', sans-serif";
    ctx.fillStyle = C.BLACK;
    ctx.fillText(pName, 20, 26);

    ctx.font = "14px 'SimHei', sans-serif";
    ctx.fillStyle = C.BLUE;
    const ds = `${dateStr} ${weekStr}`;
    const dsw = ctx.measureText(ds).width;
    ctx.fillText(ds, W - 20 - dsw, 28);

    // 来源标识（始终「实时在线」）
    ctx.font = "11px 'SimHei', sans-serif";
    ctx.fillStyle = C.GREEN;
    ctx.textAlign = 'right';
    ctx.fillText('实时在线', W - 20, 46);
    ctx.textAlign = 'left';

    ctx.fillStyle = C.BLACK;
    ctx.fillRect(20, 54, W - 40, 3);

    // ---------- 榜单列表 ----------
    const listTop = 66;
    const rowH = 22;
    const leftX = 22;
    const rankW = 34;
    const hotW = 86;
    const titleX = leftX + rankW;
    const titleMaxW = W - titleX - hotW - 16;

    const items = this.data.slice(0, Math.min(18, this.data.length));
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const y = listTop + i * rowH + rowH / 2;

        ctx.font = "bold 18px 'SimHei', sans-serif";
        let rankColor = C.BLACK;
        if (i === 0) rankColor = C.RED;
        else if (i === 1) rankColor = C.ORANGE;
        else if (i === 2) rankColor = C.YELLOW;
        ctx.fillStyle = rankColor;
        const rankStr = String(i + 1).padStart(2, '0');
        ctx.fillText(rankStr, leftX, y);

        ctx.font = "16px 'SimHei', sans-serif";
        ctx.fillStyle = C.BLACK;
        const t = this._truncate(item.title, titleMaxW);
        ctx.fillText(t, titleX, y);

        if (item.hot) {
            ctx.font = "12px 'SimHei', sans-serif";
            ctx.fillStyle = C.BLUE;
            const hs = this._fmtHot(item.hot);
            const hsw = ctx.measureText(hs).width;
            ctx.fillText(hs, W - 22 - hsw, y);
        }
    }

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
