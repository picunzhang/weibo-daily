function WeatherManager(paintManager) {
    this.pm = paintManager;
    this.ctx = paintManager.ctx;
    this.canvas = paintManager.canvas;
    this.weatherData = null;
    this.weatherStyle = 'full';
}

WeatherManager.prototype.initPanel = function() {
    const fetchBtn = document.getElementById('weather-fetch-btn');
    const styleSel = document.getElementById('weather-style');
    const hostInput = document.getElementById('weather-api-host');
    const apiKeyInput = document.getElementById('weather-api-key');
    const cityInput = document.getElementById('weather-city');

    const savedHost = localStorage.getItem('qweather_api_host') || '';
    const savedKey = localStorage.getItem('qweather_api_key') || '';
    const savedCity = localStorage.getItem('qweather_city') || '北京';
    if (hostInput) hostInput.value = savedHost;
    if (apiKeyInput) apiKeyInput.value = savedKey;
    if (cityInput) cityInput.value = savedCity;

    if (fetchBtn && !fetchBtn.dataset.bound) {
        fetchBtn.dataset.bound = '1';
        fetchBtn.addEventListener('click', () => this.fetchWeather());
    }
    if (styleSel && !styleSel.dataset.bound) {
        styleSel.dataset.bound = '1';
        styleSel.addEventListener('change', () => {
            this.weatherStyle = styleSel.value;
            if (this.weatherData) this.draw();
        });
    }
};

WeatherManager.prototype.getApiHost = function() {
    let host = document.getElementById('weather-api-host').value.trim();
    if (!host) {
        host = localStorage.getItem('qweather_api_host') || '';
    }
    if (!host) return null;
    if (!/^https?:\/\//i.test(host)) {
        host = 'https://' + host;
    }
    return host.replace(/\/$/, '');
};

WeatherManager.prototype.getApiKey = function() {
    return document.getElementById('weather-api-key').value.trim()
        || localStorage.getItem('qweather_api_key') || '';
};

WeatherManager.prototype.apiRequest = async function(path, params) {
    const host = this.getApiHost();
    const key = this.getApiKey();
    if (!host) throw new Error('请先设置 API Host');
    if (!key) throw new Error('请先设置 API Key');

    const url = host + path + '?' + new URLSearchParams(params).toString();
    const resp = await fetch(url, {
        headers: { 'X-QW-Api-Key': key }
    });
    if (!resp.ok) {
        throw new Error('HTTP ' + resp.status);
    }
    return await resp.json();
};

WeatherManager.prototype.fetchWeather = async function() {
    const host = this.getApiHost();
    const key = this.getApiKey();
    const city = document.getElementById('weather-city').value.trim();

    if (!host) { alert('请输入 API Host（在和风天气控制台获取）'); return; }
    if (!key) { alert('请输入 API Key'); return; }
    if (!city) { alert('请输入城市名称'); return; }

    localStorage.setItem('qweather_api_host', host.replace(/^https?:\/\//, '').replace(/\/$/, ''));
    localStorage.setItem('qweather_api_key', key);
    localStorage.setItem('qweather_city', city);

    setCanvasTitle('正在获取天气数据...');

    try {
        const geoData = await this.apiRequest('/geo/v2/city/lookup', { location: city });
        if (geoData.code !== '200' || !geoData.location || geoData.location.length === 0) {
            throw new Error('城市未找到，code=' + geoData.code);
        }
        const cityId = geoData.location[0].id;
        const cityName = geoData.location[0].name;
        const adm1 = geoData.location[0].adm1 || '';

        const [nowData, dailyData] = await Promise.all([
            this.apiRequest('/v7/weather/now', { location: cityId }),
            this.apiRequest('/v7/weather/7d', { location: cityId })
        ]);

        if (nowData.code !== '200' || dailyData.code !== '200') {
            throw new Error('天气数据获取失败，code=' + (nowData.code || dailyData.code));
        }

        let airData = null;
        try {
            const airResult = await this.apiRequest('/v7/air/now', { location: cityId });
            if (airResult.code === '200') airData = airResult.now;
        } catch (e) { console.warn('空气质量获取失败', e); }

        let hourlyData = null;
        try {
            const hResult = await this.apiRequest('/v7/weather/24h', { location: cityId });
            if (hResult.code === '200') hourlyData = hResult.hourly;
        } catch (e) { console.warn('24小时预报获取失败', e); }

        this.pm.lineSegments = [];
        this.pm.textElements = [];
        this.pm.scheduleData = null;
        this.pm.todoData = null;
        this.pm.cardData = null;
        this.pm.wifiData = null;
        this.pm.calendarData = null;

        this.weatherData = {
            city: cityName,
            adm1: adm1,
            now: nowData.now,
            daily: dailyData.daily,
            air: airData,
            hourly: hourlyData,
            updateTime: nowData.updateTime || new Date().toISOString()
        };
        this.pm.weatherData = this.weatherData;

        this.weatherStyle = document.getElementById('weather-style').value;
        this.pm.weatherStyle = this.weatherStyle;

        this.draw();
        this.pm.saveToHistory();
        setCanvasTitle('天气数据已加载');
    } catch (err) {
        console.error('天气获取失败:', err);
        setCanvasTitle('天气获取失败: ' + err.message);
        alert('天气获取失败: ' + err.message);
    }
};

WeatherManager.prototype.getWeatherIconText = function(code) {
    const map = {
        '100':'晴','101':'多云','102':'少云','103':'晴间多云','104':'阴',
        '150':'晴','151':'多云','152':'少云','153':'晴间多云','154':'阴',
        '300':'阵雨','301':'强阵雨','302':'雷阵雨','303':'强雷阵雨','304':'雷阵雨伴有冰雹',
        '305':'小雨','306':'中雨','307':'大雨','308':'极端降雨','309':'毛毛雨',
        '310':'暴雨','311':'大暴雨','312':'特大暴雨','313':'冻雨',
        '350':'阵雨','351':'强阵雨','399':'雨',
        '400':'小雪','401':'中雪','402':'大雪','403':'暴雪',
        '404':'雨夹雪','405':'雨雪天气','406':'阵雨夹雪','407':'阵雪','499':'雪',
        '500':'浮尘','501':'扬沙','502':'沙尘暴','503':'强沙尘暴',
        '504':'霾','507':'雾','508':'霾','509':'浓雾','510':'强浓雾',
        '511':'中度霾','512':'重度霾','513':'严重霾','514':'大雾','515':'特强浓雾',
        '600':'热','601':'热','602':'酷热',
        '701':'冷','702':'冷',
        '800':'飓风','801':'热带风暴','802':'台风','803':'强台风','804':'超强台风',
        '805':'热带低压','806':'风暴','807':'龙卷风',
        '900':'浮尘','901':'扬沙','902':'沙尘暴','999':'未知'
    };
    return map[code] || '未知';
};

WeatherManager.prototype.getWeatherEmoji = function(code, isNight) {
    const c = parseInt(code);
    if (c === 100 || c === 150) return isNight ? '🌙' : '☀️';
    if (c === 101 || c === 102 || c === 103 || c === 151 || c === 152 || c === 153) return isNight ? '☁️' : '⛅';
    if (c === 104 || c === 154) return '☁️';
    if (c >= 300 && c <= 399) return '🌧️';
    if (c >= 400 && c <= 499) return '❄️';
    if (c >= 500 && c <= 515) return (c >= 507 && c <= 515) ? '🌫️' : '🌪️';
    if (c >= 600 && c <= 602) return '🔥';
    if (c >= 701 && c <= 702) return '🥶';
    if (c >= 800 && c <= 807) return '🌀';
    return '🌤️';
};

WeatherManager.prototype.getAirQualityLevel = function(aqi) {
    const v = parseInt(aqi);
    if (v <= 50) return { level: '优', color: 'GREEN' };
    if (v <= 100) return { level: '良', color: 'YELLOW' };
    if (v <= 150) return { level: '轻度', color: 'ORANGE' };
    if (v <= 200) return { level: '中度', color: 'RED' };
    if (v <= 300) return { level: '重度', color: 'RED' };
    return { level: '严重', color: 'BLACK' };
};

WeatherManager.prototype.draw = function() {
    if (!this.weatherData) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const COLORS = {
        BLACK:  '#000000', WHITE:  '#FFFFFF',
        RED:    '#E53935', YELLOW: '#FDD835',
        GREEN:  '#43A047', BLUE:   '#1E88E5', ORANGE: '#FB8C00'
    };
    this.ctx.clearRect(0, 0, W, H);
    this.ctx.fillStyle = COLORS.WHITE;
    this.ctx.fillRect(0, 0, W, H);
    if (this.weatherStyle === 'simple') {
        this.drawSimple(W, H, COLORS);
    } else {
        this.drawFull(W, H, COLORS);
    }
};

WeatherManager.prototype.drawSimple = function(W, H, COLORS) {
    const d = this.weatherData;
    const now = d.now;
    const today = d.daily && d.daily[0];
    const ctx = this.ctx;
    const px = 24, py = 12;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // ============================================================
    // 几何装饰元素 - 构成主义风格
    // ============================================================
    // 左上角
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(0, 0, 8, 32);
    ctx.fillRect(0, 0, 32, 8);
    ctx.fillStyle = COLORS.RED;
    ctx.fillRect(8, 8, 10, 4);
    ctx.fillRect(8, 8, 4, 10);

    // 右上角
    ctx.fillStyle = COLORS.BLUE;
    ctx.fillRect(W - 8, 0, 8, 32);
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(W - 32, 0, 24, 8);
    ctx.fillStyle = COLORS.YELLOW;
    ctx.fillRect(W - 18, 8, 10, 4);

    // 左下角
    ctx.fillStyle = COLORS.GREEN;
    ctx.fillRect(0, H - 8, 32, 8);
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(0, H - 32, 8, 24);

    // 右下角
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(W - 32, H - 8, 32, 8);
    ctx.fillRect(W - 8, H - 32, 8, 24);
    ctx.fillStyle = COLORS.ORANGE;
    ctx.fillRect(W - 18, H - 18, 10, 10);

    // ============================================================
    // 顶部：城市 + 更新时间
    // ============================================================
    // 城市名 - 大号
    ctx.font = "bold 24px 'SimHei', sans-serif";
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillText(d.city, px, py);

    // 省份
    if (d.adm1) {
        ctx.font = "12px 'SimHei', sans-serif";
        const w = ctx.measureText(d.city).width;
        ctx.fillStyle = COLORS.BLACK;
        ctx.fillText(d.adm1, px + w + 24, py + 8);
    }

    // 更新时间
    const upd = new Date(d.updateTime);
    const updStr = upd.getHours().toString().padStart(2,'0') + ':' + upd.getMinutes().toString().padStart(2,'0');
    ctx.font = "11px 'SimHei', sans-serif";
    ctx.fillStyle = COLORS.BLUE;
    const updW = ctx.measureText('更新 ' + updStr).width;
    ctx.fillText('更新 ' + updStr, W - px - updW, py + 10);

    // 顶部黑色分隔线
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(px, py + 36, W - px * 2, 2);
    // 彩色小方块
    ctx.fillStyle = COLORS.RED;
    ctx.fillRect(px, py + 41, 8, 3);
    ctx.fillStyle = COLORS.YELLOW;
    ctx.fillRect(px + 10, py + 41, 5, 3);
    ctx.fillStyle = COLORS.BLUE;
    ctx.fillRect(W - px - 8, py + 41, 8, 3);

    // ============================================================
    // 主体：大温度 + 天气图标
    // ============================================================
    const bigY = py + 52;

    // 天气图标 - 大号emoji
    ctx.font = "72px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
    const bigEmoji = this.getWeatherEmoji(now.icon, false);
    ctx.fillText(bigEmoji, px + 5, bigY);

    // 大温度数字
    const tempX = px + 130;
    ctx.font = "bold 72px 'SimHei', sans-serif";
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillText(now.temp + '°', tempX, bigY);

    // 天气描述 - 蓝色
    ctx.font = "bold 18px 'SimHei', sans-serif";
    ctx.fillStyle = COLORS.BLUE;
    ctx.fillText(this.getWeatherIconText(now.icon), tempX, bigY + 88);

    // 右侧：日出日落信息卡
    if (today && today.sunrise && today.sunset) {
        const cardX = px + 480;
        const cardY = bigY;
        const cardW = 220;
        const cardH = 96;

        // 卡片背景 - 黄色
        ctx.fillStyle = COLORS.YELLOW;
        ctx.fillRect(cardX, cardY, cardW, cardH);
        // 黑色边框
        ctx.strokeStyle = COLORS.BLACK;
        ctx.lineWidth = 2;
        ctx.strokeRect(cardX, cardY, cardW, cardH);

        // 左上角红方块
        ctx.fillStyle = COLORS.RED;
        ctx.fillRect(cardX, cardY, 20, 20);
        // 右上角蓝方块
        ctx.fillStyle = COLORS.BLUE;
        ctx.fillRect(cardX + cardW - 20, cardY, 20, 20);

        // 日出
        ctx.font = "32px 'Segoe UI Emoji', sans-serif";
        ctx.fillStyle = COLORS.BLACK;
        ctx.fillText('🌅', cardX + 14, cardY + 24);
        ctx.font = "bold 16px 'SimHei', sans-serif";
        ctx.textBaseline = 'middle';
        ctx.fillText('日出 ' + today.sunrise, cardX + 54, cardY + 36);
        ctx.textBaseline = 'top';

        // 日落
        ctx.font = "32px 'Segoe UI Emoji', sans-serif";
        ctx.fillText('🌇', cardX + 14, cardY + 56);
        ctx.font = "bold 16px 'SimHei', sans-serif";
        ctx.textBaseline = 'middle';
        ctx.fillText('日落 ' + today.sunset, cardX + 54, cardY + 68);
        ctx.textBaseline = 'top';

        // 底部绿色条
        ctx.fillStyle = COLORS.GREEN;
        ctx.fillRect(cardX, cardY + cardH - 3, cardW, 3);
    }

    // ============================================================
    // 详细信息行 - 几何色块
    // ============================================================
    const detailY = bigY + 140;

    const items = [
        { label: '体感', value: now.feelsLike + '°', color: 'BLACK' },
        { label: now.windDir, value: now.windScale + '级', color: 'BLACK' },
        { label: '湿度', value: now.humidity + '%', color: 'BLUE' },
        { label: '气压', value: (now.pressure || '--') + 'hPa', color: 'BLACK' }
    ];
    if (d.air) {
        const aqi = parseInt(d.air.aqi);
        const aqiInfo = this.getAirQualityLevel(aqi);
        items.push({ label: '空气', value: aqi + ' ' + aqiInfo.level, color: aqiInfo.color });
    }
    if (now.vis) {
        items.push({ label: '能见度', value: now.vis + 'km', color: 'BLACK' });
    }

    const itemW = (W - px * 2) / items.length;
    items.forEach(function(item, i) {
        const cx = px + itemW * i + itemW / 2;
        const bgX = px + itemW * i + 4;
        const bgW = itemW - 8;

        // 边框
        ctx.strokeStyle = COLORS.BLACK;
        ctx.lineWidth = 1;
        ctx.strokeRect(bgX, detailY, bgW, 42);

        // 顶部彩色小条
        ctx.fillStyle = COLORS[item.color];
        ctx.fillRect(bgX, detailY, bgW, 2);

        ctx.textAlign = 'center';
        ctx.font = "11px 'SimHei', sans-serif";
        ctx.fillStyle = COLORS.BLACK;
        ctx.fillText(item.label, cx, detailY + 7);
        ctx.font = "bold 16px 'SimHei', sans-serif";
        ctx.fillStyle = COLORS[item.color];
        ctx.fillText(item.value, cx, detailY + 22);
    });

    // ============================================================
    // 3天预报
    // ============================================================
    const dayY = detailY + 80;

    // 标题
    ctx.font = "bold 14px 'SimHei', sans-serif";
    ctx.fillStyle = COLORS.BLACK;
    ctx.textAlign = 'left';
    // 红方块前缀
    ctx.fillStyle = COLORS.RED;
    ctx.fillRect(px, dayY + 6, 3, 14);
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillText('3天预报', px + 8, dayY + 4);

    if (d.daily && d.daily.length > 0) {
        const dStartY = dayY + 28;
        const days = Math.min(3, d.daily.length);
        const colW = (W - px * 2) / days;
        const weekNames = ['周日','周一','周二','周三','周四','周五','周六'];

        for (let i = 0; i < days; i++) {
            const day = d.daily[i];
            const cx = px + colW * i + colW / 2;
            const cardX = px + colW * i + 5;
            const cardW = colW - 10;

            // 卡片背景 - 白色带边框
            ctx.strokeStyle = COLORS.BLACK;
            ctx.lineWidth = 2;
            ctx.strokeRect(cardX, dStartY, cardW, 80);

            // 顶部色条
            if (i === 0) {
                ctx.fillStyle = COLORS.RED;
            } else if (i === 1) {
                ctx.fillStyle = COLORS.BLUE;
            } else {
                ctx.fillStyle = COLORS.GREEN;
            }
            ctx.fillRect(cardX, dStartY, cardW, 3);

            const date = new Date(day.fxDate);
            const label = i === 0 ? '今天' : weekNames[date.getDay()];
            ctx.textAlign = 'center';
            ctx.font = "bold 14px 'SimHei', sans-serif";
            ctx.fillStyle = COLORS.BLACK;
            ctx.fillText(label, cx, dStartY + 10);

            ctx.font = "32px 'Segoe UI Emoji', sans-serif";
            ctx.fillText(this.getWeatherEmoji(day.iconDay, false), cx, dStartY + 28);

            ctx.font = "bold 16px 'SimHei', sans-serif";
            ctx.fillStyle = COLORS.RED;
            ctx.fillText(day.tempMax + '°', cx - 18, dStartY + 62);
            ctx.fillStyle = COLORS.BLUE;
            ctx.fillText(day.tempMin + '°', cx + 18, dStartY + 62);
        }
    }

    // ============================================================
    // 底部标识
    // ============================================================
    const bottomY = H - py;
    ctx.font = "10px 'SimHei', sans-serif";
    ctx.fillStyle = COLORS.BLACK;
    ctx.textAlign = 'left';
    ctx.fillText('和风天气', px, bottomY);
    ctx.textAlign = 'right';
    ctx.fillText('7.3" EPD', W - px, bottomY);

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
};

WeatherManager.prototype.drawFull = function(W, H, COLORS) {
    const d = this.weatherData;
    const now = d.now;
    const today = d.daily && d.daily[0];
    const ctx = this.ctx;
    const px = 20, py = 10;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // ============================================================
    // 几何装饰元素 - 构成主义风格
    // ============================================================
    // 左上角
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(0, 0, 8, 28);
    ctx.fillRect(0, 0, 28, 8);
    ctx.fillStyle = COLORS.RED;
    ctx.fillRect(8, 8, 8, 3);
    ctx.fillRect(8, 8, 3, 8);

    // 右上角
    ctx.fillStyle = COLORS.BLUE;
    ctx.fillRect(W - 8, 0, 8, 28);
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(W - 28, 0, 20, 8);
    ctx.fillStyle = COLORS.YELLOW;
    ctx.fillRect(W - 16, 8, 8, 3);

    // 左下角
    ctx.fillStyle = COLORS.GREEN;
    ctx.fillRect(0, H - 8, 28, 8);
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(0, H - 28, 8, 20);

    // 右下角
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(W - 28, H - 8, 28, 8);
    ctx.fillRect(W - 8, H - 28, 8, 20);
    ctx.fillStyle = COLORS.ORANGE;
    ctx.fillRect(W - 16, H - 16, 8, 8);

    // ============================================================
    // 顶部：城市 + 更新时间
    // ============================================================
    // 城市名 - 大号
    ctx.font = "bold 26px 'SimHei', sans-serif";
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillText(d.city, px, py);

    // 省份
    if (d.adm1) {
        ctx.font = "13px 'SimHei', sans-serif";
        const w = ctx.measureText(d.city).width;
        ctx.fillStyle = COLORS.BLACK;
        ctx.fillText(d.adm1, px + w + 26, py + 9);
    }

    // 更新时间
    const upd = new Date(d.updateTime);
    const updStr = upd.getHours().toString().padStart(2,'0') + ':' + upd.getMinutes().toString().padStart(2,'0');
    ctx.font = "11px 'SimHei', sans-serif";
    ctx.fillStyle = COLORS.BLUE;
    const updW = ctx.measureText('更新 ' + updStr).width;
    ctx.fillText('更新 ' + updStr, W - px - updW, py + 12);

    // 顶部黑色分隔线
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(px, py + 38, W - px * 2, 3);
    // 彩色小方块
    ctx.fillStyle = COLORS.RED;
    ctx.fillRect(px, py + 44, 8, 3);
    ctx.fillStyle = COLORS.YELLOW;
    ctx.fillRect(px + 10, py + 44, 5, 3);
    ctx.fillStyle = COLORS.BLUE;
    ctx.fillRect(W - px - 8, py + 44, 8, 3);

    // ============================================================
    // 主体：大温度 + 天气图标
    // ============================================================
    const bigY = py + 44;

    // 天气图标 - 大号emoji
    ctx.font = "64px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
    const bigEmoji = this.getWeatherEmoji(now.icon, false);
    ctx.fillText(bigEmoji, px + 5, bigY);

    // 大温度数字
    const tempX = px + 115;
    ctx.font = "bold 64px 'SimHei', sans-serif";
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillText(now.temp + '°', tempX, bigY);

    // 天气描述 - 蓝色
    ctx.font = "bold 16px 'SimHei', sans-serif";
    ctx.fillStyle = COLORS.BLUE;
    ctx.fillText(this.getWeatherIconText(now.icon), tempX, bigY + 78);

    // 右侧：日出日落信息卡
    if (today && today.sunrise && today.sunset) {
        const cardX = px + 460;
        const cardY = bigY;
        const cardW = 210;
        const cardH = 88;

        // 卡片背景 - 黄色
        ctx.fillStyle = COLORS.YELLOW;
        ctx.fillRect(cardX, cardY, cardW, cardH);
        // 黑色边框
        ctx.strokeStyle = COLORS.BLACK;
        ctx.lineWidth = 2;
        ctx.strokeRect(cardX, cardY, cardW, cardH);

        // 左上角红方块
        ctx.fillStyle = COLORS.RED;
        ctx.fillRect(cardX, cardY, 20, 20);
        // 右上角蓝方块
        ctx.fillStyle = COLORS.BLUE;
        ctx.fillRect(cardX + cardW - 20, cardY, 20, 20);

        // 日出
        ctx.font = "30px 'Segoe UI Emoji', sans-serif";
        ctx.fillStyle = COLORS.BLACK;
        ctx.fillText('🌅', cardX + 14, cardY + 22);
        ctx.font = "bold 15px 'SimHei', sans-serif";
        ctx.textBaseline = 'middle';
        ctx.fillText('日出 ' + today.sunrise, cardX + 52, cardY + 32);
        ctx.textBaseline = 'top';

        // 日落
        ctx.font = "30px 'Segoe UI Emoji', sans-serif";
        ctx.fillText('🌇', cardX + 14, cardY + 52);
        ctx.font = "bold 15px 'SimHei', sans-serif";
        ctx.textBaseline = 'middle';
        ctx.fillText('日落 ' + today.sunset, cardX + 52, cardY + 62);
        ctx.textBaseline = 'top';

        // 底部绿色条
        ctx.fillStyle = COLORS.GREEN;
        ctx.fillRect(cardX, cardY + cardH - 3, cardW, 3);
    }

    // ============================================================
    // 详细信息行 - 几何色块
    // ============================================================
    const detailY = bigY + 120;

    const items = [
        { label: '体感', value: now.feelsLike + '°', color: 'BLACK' },
        { label: now.windDir, value: now.windScale + '级', color: 'BLACK' },
        { label: '湿度', value: now.humidity + '%', color: 'BLUE' },
        { label: '气压', value: (now.pressure || '--') + 'hPa', color: 'BLACK' }
    ];
    if (d.air) {
        const aqi = parseInt(d.air.aqi);
        const aqiInfo = this.getAirQualityLevel(aqi);
        items.push({ label: '空气', value: aqi + ' ' + aqiInfo.level, color: aqiInfo.color });
    }
    if (now.vis) {
        items.push({ label: '能见度', value: now.vis + 'km', color: 'BLACK' });
    }

    const itemW = (W - px * 2) / items.length;
    items.forEach(function(item, i) {
        const cx = px + itemW * i + itemW / 2;
        const bgX = px + itemW * i + 3;
        const bgW = itemW - 6;

        // 边框
        ctx.strokeStyle = COLORS.BLACK;
        ctx.lineWidth = 1;
        ctx.strokeRect(bgX, detailY, bgW, 44);

        // 顶部彩色小条
        ctx.fillStyle = COLORS[item.color];
        ctx.fillRect(bgX, detailY, bgW, 3);

        ctx.textAlign = 'center';
        ctx.font = "11px 'SimHei', sans-serif";
        ctx.fillStyle = COLORS.BLACK;
        ctx.fillText(item.label, cx, detailY + 8);
        ctx.font = "bold 16px 'SimHei', sans-serif";
        ctx.fillStyle = COLORS[item.color];
        ctx.fillText(item.value, cx, detailY + 24);
    });

    // ============================================================
    // 24小时预报
    // ============================================================
    const hourlyY = detailY + 70;

    // 标题
    ctx.font = "bold 14px 'SimHei', sans-serif";
    ctx.fillStyle = COLORS.BLACK;
    ctx.textAlign = 'left';
    // 标题前的红方块
    ctx.fillStyle = COLORS.RED;
    ctx.fillRect(px, hourlyY + 6, 4, 14);
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillText('24小时预报', px + 10, hourlyY + 4);

    if (d.hourly && d.hourly.length > 0) {
        const hStartY = hourlyY + 26;
        const points = 12;
        const step = Math.floor(d.hourly.length / points) || 1;
        const selected = [];
        for (let i = 0; i < d.hourly.length && selected.length < points; i += step) {
            selected.push(d.hourly[i]);
        }
        if (selected.length > 0 && selected[selected.length-1] !== d.hourly[d.hourly.length-1]) {
            selected[selected.length-1] = d.hourly[d.hourly.length-1];
        }
        const chartW = W - px * 2;
        const chartH = 42;
        const colW = chartW / selected.length;
        let minT = 999, maxT = -999;
        selected.forEach(function(h) { var t = parseInt(h.temp); if (t < minT) minT = t; if (t > maxT) maxT = t; });
        if (minT === maxT) { minT -= 1; maxT += 1; }

        // 温度折线
        ctx.strokeStyle = COLORS.RED;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        var temps = [];
        var self = this;
        selected.forEach(function(h, i) {
            var t = parseInt(h.temp);
            var x = px + colW * i + colW / 2;
            var y = hStartY + chartH - ((t - minT) / (maxT - minT)) * chartH;
            temps.push({x: x, y: y, t: t, time: h.fxTime, icon: h.icon});
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        temps.forEach(function(p) {
            // 数据点 - 方块代替圆点
            ctx.fillStyle = COLORS.RED;
            ctx.fillRect(p.x - 3, p.y - 3, 6, 6);

            ctx.font = "10px 'SimHei', sans-serif";
            ctx.fillStyle = COLORS.RED;
            ctx.textAlign = 'center';
            ctx.fillText(p.t + '°', p.x, p.y - 12);
            ctx.fillStyle = COLORS.BLACK;
            var dt = new Date(p.time);
            ctx.fillText(dt.getHours() + '时', p.x, hStartY + chartH + 4);
        });
    }

    // ============================================================
    // 7天预报
    // ============================================================
    const dailyY = hourlyY + 100;

    // 分隔线
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(px, dailyY, W - px * 2, 2);

    // 标题
    ctx.font = "bold 14px 'SimHei', sans-serif";
    ctx.fillStyle = COLORS.BLACK;
    ctx.textAlign = 'left';
    // 标题前的蓝方块
    ctx.fillStyle = COLORS.BLUE;
    ctx.fillRect(px, dailyY + 8, 4, 14);
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillText('7天预报', px + 10, dailyY + 8);

    if (d.daily && d.daily.length > 0) {
        const dStartY = dailyY + 26;
        const days = Math.min(7, d.daily.length);
        const colW = (W - px * 2) / days;
        const weekNames = ['周日','周一','周二','周三','周四','周五','周六'];

        for (let i = 0; i < days; i++) {
            const day = d.daily[i];
            const cx = px + colW * i + colW / 2;
            const cardX = px + colW * i + 3;
            const cardW = colW - 6;

            // 卡片边框
            ctx.strokeStyle = COLORS.BLACK;
            ctx.lineWidth = 1;
            ctx.strokeRect(cardX, dStartY, cardW, 72);

            // 顶部色条
            if (i === 0) {
                ctx.fillStyle = COLORS.RED;
            } else if (i === 6) {
                ctx.fillStyle = COLORS.ORANGE;
            } else {
                ctx.fillStyle = COLORS.BLUE;
            }
            ctx.fillRect(cardX, dStartY, cardW, 3);

            const date = new Date(day.fxDate);
            const label = i === 0 ? '今天' : weekNames[date.getDay()];
            ctx.textAlign = 'center';
            ctx.font = "bold 12px 'SimHei', sans-serif";
            ctx.fillStyle = COLORS.BLACK;
            ctx.fillText(label, cx, dStartY + 8);

            ctx.font = "24px 'Segoe UI Emoji', sans-serif";
            ctx.fillText(this.getWeatherEmoji(day.iconDay, false), cx, dStartY + 22);

            ctx.font = "bold 13px 'SimHei', sans-serif";
            ctx.fillStyle = COLORS.RED;
            ctx.fillText(day.tempMax + '°', cx - 14, dStartY + 52);
            ctx.fillStyle = COLORS.BLUE;
            ctx.fillText(day.tempMin + '°', cx + 14, dStartY + 52);
        }
    }

    // ============================================================
    // 底部标识
    // ============================================================
    const bottomY = H - py;
    ctx.font = "10px 'SimHei', sans-serif";
    ctx.fillStyle = COLORS.BLACK;
    ctx.textAlign = 'left';
    ctx.fillText('和风天气', px, bottomY);
    ctx.textAlign = 'right';
    ctx.fillText('7.3" EPD', W - px, bottomY);

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
};
