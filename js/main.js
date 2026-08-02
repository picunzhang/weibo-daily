/**
 * 7.3寸七色墨水屏控制台主模块
 * 仅支持7.3寸七色墨水屏（Spectra 6）
 * 支持蓝牙传图、图片裁剪、抖动处理、A/B面同步
 */

// ==================== 全局变量 ====================
let bleDevice, gattServer;
let epdService, epdCharacteristic, txCharacteristic, cmdCharacteristic;
let startTime, msgIndex, appVersion;
let canvas, ctx, textDecoder;
let paintManager, cropManager;

const APP_VERSION = '2.1.0';
const APP_BUILD_DATE = '2026-06-29';

const PALETTE_COLORS = {
    blackWhiteColor: [
        { r: 0,   g: 0,   b: 0,   value: 0x00 },
        { r: 255, g: 255, b: 255, value: 0xFF }
    ],
    threeColor: [
        { r: 0,   g: 0,   b: 0,   value: 0x00 },
        { r: 255, g: 255, b: 255, value: 0xFF },
        { r: 229, g: 57,  b: 53,  value: 0x4C }
    ],
    fourColor: [
        { r: 0,   g: 0,   b: 0,   value: 0x00 },
        { r: 255, g: 255, b: 255, value: 0xFF },
        { r: 229, g: 57,  b: 53,  value: 0x4C },
        { r: 253, g: 216, b: 53,  value: 0xE2 }
    ],
    sixColor: [
        { r: 0,   g: 0,   b: 0,   value: 0x00 },
        { r: 255, g: 255, b: 255, value: 0xFF },
        { r: 229, g: 57,  b: 53,  value: 0x4C },
        { r: 253, g: 216, b: 53,  value: 0xE2 },
        { r: 67,  g: 160, b: 71,  value: 0x96 },
        { r: 30,  g: 136, b: 229, value: 0x1D }
    ],
    sevenColor: [
        { r: 0,   g: 0,   b: 0,   value: 0x00 },
        { r: 255, g: 255, b: 255, value: 0x01 },
        { r: 229, g: 57,  b: 53,  value: 0x04 },
        { r: 253, g: 216, b: 53,  value: 0x05 },
        { r: 67,  g: 160, b: 71,  value: 0x02 },
        { r: 30,  g: 136, b: 229, value: 0x03 },
        { r: 251, g: 140, b: 0,   value: 0x06 }
    ]
};

function colorDistance(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dr * dr + dg * dg + db * db;
}

function findClosestColor(r, g, b, mode) {
    const palette = PALETTE_COLORS[mode] || PALETTE_COLORS.blackWhiteColor;
    let minDist = Infinity;
    let closest = palette[0];
    for (const color of palette) {
        const dist = colorDistance(r, g, b, color.r, color.g, color.b);
        if (dist < minDist) {
            minDist = dist;
            closest = color;
        }
    }
    return closest;
}

// 蓝牙命令定义
const EpdCmd = {
    SET_PINS: 0x00,
    INIT: 0x01,
    CLEAR: 0x02,
    SEND_CMD: 0x03,
    SEND_DATA: 0x04,
    REFRESH: 0x05,
    SLEEP: 0x06,
    WRITE_IMG: 0x30,
    WRITE_BLOCK: 0x31,
    QUERY_STATUS: 0x32,
    RESET_TRANSFER: 0x33,
    SET_CONFIG: 0x90,
    SYS_RESET: 0x91,
    SYS_SLEEP: 0x92,
    CFG_ERASE: 0x99
};

// ==================== 双协议支持 ====================
let appModeEnabled = false;
let compressEnabled = false;
let storedImageDataA = null;
let storedImageDataB = null;

// ==================== 工具函数 ====================
function hex2bytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return new Uint8Array(bytes);
}

function bytes2hex(data) {
    return new Uint8Array(data).reduce((memo, i) => memo + ("0" + i.toString(16)).slice(-2), "");
}

function resetVariables() {
    gattServer = null;
    epdService = null;
    epdCharacteristic = null;
    txCharacteristic = null;
    cmdCharacteristic = null;
    msgIndex = 0;
    const logEl = document.getElementById("log");
    if (logEl) logEl.innerHTML = '';
}

// ==================== 蓝牙写入（带防冲突锁）====================
let writeInProgress = false;
const WRITE_DELAY_MS = 50;
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function write(cmd, data, withResponse = true) {
    while (writeInProgress) await sleep(10);
    if (!epdCharacteristic) {
        addLog("服务不可用，请检查蓝牙连接");
        return false;
    }
    writeInProgress = true;
    try {
        const payload = [cmd];
        if (data) {
            if (typeof data === 'string') data = hex2bytes(data);
            if (data instanceof Uint8Array) data = Array.from(data);
            payload.push(...data);
        }
        addLog(bytes2hex(payload), '⇑');
        const dataBuffer = Uint8Array.from(payload);
        
        if (withResponse) {
            if (epdCharacteristic.writeValueWithResponse) {
                await epdCharacteristic.writeValueWithResponse(dataBuffer);
            } else {
                await epdCharacteristic.writeValue(dataBuffer);
            }
        } else {
            if (epdCharacteristic.writeValueWithoutResponse) {
                await epdCharacteristic.writeValueWithoutResponse(dataBuffer);
            } else {
                await epdCharacteristic.writeValue(dataBuffer);
            }
        }
        await sleep(WRITE_DELAY_MS);
        return true;
    } catch (e) {
        console.error(e);
        if (e.message) addLog("write: " + e.message);
        return false;
    } finally {
        writeInProgress = false;
    }
}

// ==================== APP模式专用函数 ====================
async function sendimgAppMode() {
    const epdIndex = parseInt(document.getElementById('abSelect')?.value || '1');
    const compressEnabled = document.getElementById('compressEnable')?.checked || false;
    const epdTypeVal = 0x06;

    addLog(`🔄 APP模式发送开始 (模式: ${epdIndex})`);

    if (epdIndex === 1) {
        if (!storedImageDataA) {
            addLog("❌ A面数据为空，请先点击「从主画布同步到 A 面」");
            return;
        }
    } else if (epdIndex === 2) {
        if (!storedImageDataB) {
            addLog("❌ B面数据为空，请先点击「从主画布同步到 B 面」");
            return;
        }
    } else if (epdIndex === 3) {
        if (!storedImageDataA) {
            addLog("❌ A面数据为空，请先点击「从主画布同步到 A 面」");
            return;
        }
    } else if (epdIndex === 7) {
        if (!storedImageDataA || !storedImageDataB) {
            addLog("❌ AB异显模式需要同时具备A面和B面数据，请分别同步");
            return;
        }
    } else {
        addLog("⚠️ 未知模式，默认为A面");
        if (!storedImageDataA) {
            addLog("❌ A面数据为空，请先同步A面");
            return;
        }
    }

    const sourceImageDataA = storedImageDataA;
    const sourceImageDataB = storedImageDataB;

    let dataA = null, dataB = null;
    try {
        if (sourceImageDataA) {
            dataA = EpdFormat.convertWithType(epdTypeVal, canvas.width, canvas.height, sourceImageDataA, findClosestColor);
        }
        if (sourceImageDataB) {
            dataB = EpdFormat.convertWithType(epdTypeVal, canvas.width, canvas.height, sourceImageDataB, findClosestColor);
        }
    } catch (e) {
        addLog("❌ 格式转换失败: " + e.message);
        console.error(e);
        return;
    }

    let finalData = null;
    if (epdIndex === 1) {
        finalData = dataA;
        addLog(`单面模式（A面）：发送 A 面数据，长度 ${dataA ? dataA.length : 0} 字节`);
    } else if (epdIndex === 2) {
        finalData = dataB;
        addLog(`单面模式（B面）：发送 B 面数据，长度 ${dataB ? dataB.length : 0} 字节`);
    } else if (epdIndex === 3) {
        finalData = dataA;
        addLog(`同显模式：发送 A 面数据，长度 ${dataA ? dataA.length : 0} 字节`);
    } else if (epdIndex === 7) {
        if (!dataA || !dataB) {
            addLog("❌ 异显模式数据转换失败，缺少A或B面数据");
            return;
        }
        finalData = new Uint8Array(dataA.length + dataB.length);
        finalData.set(dataA, 0);
        finalData.set(dataB, dataA.length);
        addLog(`异显模式：发送 A+B 面数据，总长度 ${finalData.length} 字节`);
    } else {
        addLog("⚠️ 未知模式，默认发送A面");
        finalData = dataA;
    }

    if (!finalData) {
        addLog("❌ 未生成有效的设备数据，请检查图像内容");
        return;
    }

    startTime = Date.now();
    const statusEl = document.getElementById("status");
    statusEl.parentElement.style.display = "block";

    try {
        AppProtocol.setEpdType(epdTypeVal);
        AppProtocol.setEpdIndex(epdIndex);
        AppProtocol.setCompress(compressEnabled);
        AppProtocol.setProgressCallback((sent, total) => {
            const elapsed = (Date.now() - startTime) / 1000;
            setStatus(`发送图片: ${sent}/${total} 包, 用时 ${elapsed.toFixed(1)}s`);
        });
        AppProtocol.setCompleteCallback(() => {
            if (bleDevice && bleDevice.gatt && bleDevice.gatt.connected) {
                addLog("✅ APP模式传输完成（刷新等待时间长, 请耐心等待设备刷新）");
            }
        });

        addLog(`准备发送图片，模式: 七色, 压缩: ${compressEnabled}, 驱动: 0x${epdTypeVal.toString(16)}`);
        await AppProtocol.sendFullImage(finalData, 'sevenColor', epdTypeVal, compressEnabled);
        const elapsed = (Date.now() - startTime) / 1000;
        addLog(`✅ APP 模式发送完成！耗时: ${elapsed.toFixed(2)}s`);
    } catch (e) {
        addLog(`❌ APP 模式发送失败: ${e.message}`);
        console.error(e);
    } finally {
        updateButtonStatus();
        setTimeout(() => { statusEl.parentElement.style.display = "none"; }, 5000);
    }
}

// ==================== 发送图片（支持双协议）====================
async function sendimg() {
    if (cropManager.isCropMode()) {
        alert("请先完成图片裁剪！发送已取消。");
        return;
    }

    if (appModeEnabled) {
        await sendimgAppMode();
        return;
    }

    startTime = Date.now();
    const statusEl = document.getElementById("status");
    statusEl.parentElement.style.display = "block";

    updateButtonStatus(true);
    await write(EpdCmd.INIT);

    addLog("当前固件不支持APP模式，仅支持APP协议连接");
    updateButtonStatus();
    statusEl.parentElement.style.display = "none";
}

// ==================== UI 辅助 ====================
function updateButtonStatus(forceDisabled = false) {
    const connected = gattServer && gattServer.connected;
    const disabled = forceDisabled || !connected ? 'disabled' : null;
    document.getElementById("reconnectbutton").disabled = (gattServer && gattServer.connected) ? 'disabled' : null;
    document.getElementById("sendimgbutton").disabled = disabled;
}

function disconnect() {
    updateButtonStatus();
    resetVariables();
    addLog('已断开连接.');
    document.getElementById("connectbutton").innerHTML = '连接';
}

// ==================== 根据协议显示/隐藏功能区 ====================
function updateUIBasedOnProtocol() {
    const appOnlyIds = ['abSelectGroup','compressOptionGroup','doubleImagePanel'];
    const protocolSpan = document.getElementById('protocolStatus');
    if (protocolSpan) {
        if (appModeEnabled) {
            protocolSpan.textContent = 'APP 模式';
            protocolSpan.style.color = '#4CAF50';
        } else {
            protocolSpan.textContent = '网页模式 (Web)';
            protocolSpan.style.color = '#2196F3';
        }
    }

    if (appModeEnabled) {
        appOnlyIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = '';
        });
        const imagePanel = document.getElementById('image-panel');
        const imageModeBtn = document.getElementById('image-mode');
        if (imagePanel && imagePanel.style.display === 'none') {
            imagePanel.style.display = '';
            if (imageModeBtn) imageModeBtn.classList.add('active');
        }
    } else {
        appOnlyIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }
    const statusBar = document.getElementById('appModeStatusBar');
    if (statusBar) {
        if (appModeEnabled) {
            statusBar.style.display = 'block';
            statusBar.innerHTML = `📌 APP 模式：当前画布尺寸 ${canvas.width}x${canvas.height} | A面${storedImageDataA ? '已设置' : '未设置'} | B面${storedImageDataB ? '已设置' : '未设置'}`;
        } else {
            statusBar.style.display = 'none';
        }
    }
}

// ==================== 蓝牙连接相关 ====================
async function filterConnect() {
    await preConnect(true, true);
}

async function preConnect(useFilter = false, forceNew = false) {
    if (gattServer && gattServer.connected) {
        if (bleDevice && bleDevice.gatt.connected) bleDevice.gatt.disconnect();
        if (!forceNew) return; await sleep(300);
    }
    resetVariables();
    try {
        const filterInput = document.getElementById('blenamefilter');
        const filterValue = filterInput?.value.trim();
        if (filterInput) filterInput.blur();
        const options = {
            optionalServices: [
                '62750001-d828-918d-fb46-b6c11c675aec', 
                '0000ff01-0000-1000-8000-00805f9b34fb'
            ] };
        if (useFilter && filterValue && filterValue.length > 0) {
            const prefix = filterValue.toUpperCase();
            options.filters = [{ namePrefix: 'NRF_EPD_' + prefix }, { namePrefix: 'EPD_' + prefix },{ namePrefix: 'YSBadge2'}];
            addLog(`按名称过滤: NRF_EPD_${prefix} 或 EPD_${prefix} 或 YSBadge2`);
        } else {
            options.acceptAllDevices = true;
        }
        bleDevice = await navigator.bluetooth.requestDevice(options);
        addLog(`已选择设备: ${bleDevice.name || bleDevice.id}`);
    } catch (e) {
        if (e.name === 'NotFoundError' || (e.message && e.message.includes('User cancelled'))) addLog("已取消设备选择。");
        else {
            console.error(e); 
            if (e.message) addLog("requestDevice: " + e.message); 
            addLog("请检查蓝牙是否已开启，且使用的浏览器支持蓝牙！建议使用以下浏览器：");
            addLog("• 电脑: Chrome/Edge");
            addLog("• Android: Chrome/Edge");
            addLog("• iOS: Bluefy 浏览器");
        }
        return;
    }
    bleDevice.addEventListener('gattserverdisconnected', disconnect);
    setTimeout(async () => { await connect(); }, 300);
}

async function reConnect() {
    if (bleDevice && bleDevice.gatt.connected) bleDevice.gatt.disconnect();
    resetVariables();
    addLog("正在重连");
    setTimeout(async () => { await connect(); }, 300);
}

async function connect() {
    if (!bleDevice || epdCharacteristic) return;
    try {
        addLog("正在连接: " + bleDevice.name);
        gattServer = await bleDevice.gatt.connect();
        addLog("  找到 GATT Server");
        try {
            epdService = await gattServer.getPrimaryService('62750001-d828-918d-fb46-b6c11c675aec');
            addLog("  找到 EPD Service (Web 协议)");
            epdCharacteristic = await epdService.getCharacteristic('62750002-d828-918d-fb46-b6c11c675aec');
            addLog("  找到 RX Characteristic");
            txCharacteristic = await epdService.getCharacteristic('62750003-d828-918d-fb46-b6c11c675aec');
            addLog("  找到 TX Characteristic");
            await epdCharacteristic.startNotifications();
            epdCharacteristic.addEventListener('characteristicvaluechanged', (event) => { handleNotify(event.target.value, msgIndex++); });
            addLog("  通知已开启");
            await sleep(50);
            appModeEnabled = false;
            addLog("📡 协议模式: 网页模式");
        } catch (e) {
            addLog("Web 协议识别失败，尝试 APP 协议...");
            try {
                epdService = await gattServer.getPrimaryService('0000ff01-0000-1000-8000-00805f9b34fb');
                addLog("  找到 EPD Service (APP 协议)");
                cmdCharacteristic = await epdService.getCharacteristic('0000ff03-0000-1000-8000-00805f9b34fb');
                addLog("  找到 WriteCMD Characteristic (0000ff03)");
                epdCharacteristic = await epdService.getCharacteristic('0000ff02-0000-1000-8000-00805f9b34fb');
                addLog("  找到 WritePic Characteristic (0000ff02)");
                txCharacteristic = await epdService.getCharacteristic('0000ff04-0000-1000-8000-00805f9b34fb');
                addLog("  找到 Notify Characteristic (0000ff04)");

                try { 
                    await txCharacteristic.startNotifications(); 
                    txCharacteristic.addEventListener('characteristicvaluechanged', (event) => { 
                        handleNotify(event.target.value, msgIndex++); 
                    }); 
                    addLog("  通知已开启");
                } catch(e2){ 
                    addLog("  通知开启失败（不影响写操作）: "+e2.message);
                }
                appModeEnabled = true;
                addLog("📡 协议模式: APP 模式");

                if (typeof AppProtocol !== 'undefined') {
                    AppProtocol.setCharacteristics(cmdCharacteristic, epdCharacteristic);
                    AppProtocol.setNotifyCharacteristic(txCharacteristic);
                    AppProtocol.setLogCallback(addLog);

                    let actualMtu = 23;
                    try {
                        await gattServer.requestMTU(256);
                        addLog("  已请求 MTU=256");
                        await sleep(500);
                        if (gattServer.mtu) {
                            actualMtu = gattServer.mtu;
                            addLog(`  协商实际 MTU (gattServer.mtu) = ${actualMtu}`);
                         } else if (cmdCharacteristic.service.device.gatt && cmdCharacteristic.service.device.gatt.mtu) {
                             actualMtu = cmdCharacteristic.service.device.gatt.mtu;
                             addLog(`  协商实际 MTU (device.gatt.mtu) = ${actualMtu}`);
                         } else {
                             addLog(`  ⚠️ 无法获取实际 MTU，使用默认 23`);
                         }
                    } catch(mtuErr) {
                         addLog(`  MTU 协商失败: ${mtuErr.message}，使用默认 23`);
                    }
                    AppProtocol.setMtuSize(actualMtu);
                    addLog(`  ✅ APP模式数据包负载大小 = ${actualMtu - 3} 字节`);
                    
                    AppProtocol.setEpdType(0x06);
                    const abSelect = document.getElementById('abSelect');
                    AppProtocol.setEpdIndex(abSelect ? parseInt(abSelect.value) : 1);
                    const compressCheck = document.getElementById('compressEnable');
                    AppProtocol.setCompress(compressCheck ? compressCheck.checked : false);
                    addLog("  AppProtocol 初始化完成");
                } else { addLog("  警告：AppProtocol 未加载，APP 模式无法发送图片"); }
            } catch (e2) { throw new Error("无法识别设备协议，请确认设备固件是否支持"); }
        }
        updateUIBasedOnProtocol();
        if (!appModeEnabled) {
            try { const versionData = await txCharacteristic.readValue(); appVersion = versionData.getUint8(0); addLog(`固件版本: 0x${appVersion.toString(16)}`); addLog(`APP版本: v${APP_VERSION} (${APP_BUILD_DATE})`); } catch(e){ appVersion=0x15; }
            if (typeof BleTransfer !== 'undefined') BleTransfer.init();
            await write(EpdCmd.INIT);
        } else {
            appVersion = 0x20;
            addLog("APP 模式：固件版本假定为 0x20");
        }
        document.getElementById("connectbutton").innerHTML = '断开';
        updateButtonStatus();
        addLog("✅ 连接成功，可以发送指令或图片");
    } catch (e) {
        console.error(e);
        if (e.message) addLog("connect: " + e.message);
        disconnect();
        return;
    }
}

function handleNotify(value, idx) {
    const data = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

    if (appModeEnabled) {
        return;
    }

    if (data.length >= 1 && (data[0] === 0xA0 || data[0] === 0xA1)) {
        if (typeof BleTransfer !== 'undefined') BleTransfer.handleNotification(value);
        return;
    }

    if (idx === 0) {
        addLog(`收到配置：${bytes2hex(data)}`);
    } else {
        if (!textDecoder) textDecoder = new TextDecoder();
        const msg = textDecoder.decode(data);
        addLog(msg, '⇓');
    }
}

// ==================== 日志和状态 ====================
function setStatus(text) {
    const el = document.getElementById("status");
    if (el) el.innerHTML = text;
}

function addLog(msg, action = '') {
    const logDiv = document.getElementById("log");
    if (!logDiv) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} `;
    const line = document.createElement('div');
    line.className = 'log-line';
    const timeSpan = document.createElement('span');
    timeSpan.className = 'time';
    timeSpan.textContent = timeStr;
    line.appendChild(timeSpan);
    if (action) {
        const actionSpan = document.createElement('span');
        actionSpan.className = 'action';
        actionSpan.innerHTML = action;
        line.appendChild(actionSpan);
    }
    line.appendChild(document.createTextNode(msg));
    logDiv.appendChild(line);
    logDiv.scrollTop = logDiv.scrollHeight;
    while (logDiv.childNodes.length > 200) logDiv.removeChild(logDiv.firstChild);
}

function clearLog() {
    const logDiv = document.getElementById("log");
    if (logDiv) logDiv.innerHTML = '';
}

// ==================== 画布操作 ====================
function fillCanvas(style) {
    ctx.fillStyle = style;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function setCanvasTitle(title) {
    const titleEl = document.querySelector('.canvas-title');
    if (titleEl) {
        titleEl.innerText = title;
        titleEl.style.display = title && title !== '' ? 'block' : 'none';
    }
}

function updateImage() {
    const fileInput = document.getElementById('imageFile');
    if (!fileInput.files.length) {
        fillCanvas('white');
        return;
    }
    const img = new Image();
    img.onload = () => {
        URL.revokeObjectURL(img.src);
        if (img.width / img.height === canvas.width / canvas.height) {
            if (cropManager.isCropMode()) cropManager.exitCropMode();
            ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);
        } else {
            alert(`图片宽高比例与画布不匹配，将进入裁剪模式。\n请放大图片后移动图片使其充满画布, 再点击"完成"按钮。`);
            if (paintManager) paintManager.setActiveTool(null, '');
            cropManager.initializeCrop();
        }
    };
    img.src = URL.createObjectURL(fileInput.files[0]);
}

function clearCanvas() {
    if (!confirm('清除画布内容?')) return false;
    fillCanvas('white');
    if (paintManager) {
        paintManager.clearElements();
        if (cropManager.isCropMode()) cropManager.exitCropMode();
        paintManager.saveToHistory();
    }
    return true;
}

// ==================== 编辑器初始化 ====================
function initImageEditor() {
    const imageModeBtn = document.getElementById('image-mode');
    const imagePanel = document.getElementById('image-panel');

    if (imageModeBtn && imagePanel) {
        imageModeBtn.addEventListener('click', () => {
            const visible = imagePanel.style.display !== 'none';
            imagePanel.style.display = visible ? 'none' : '';
            imageModeBtn.classList.toggle('active', !visible);
            if (visible) {
                if (paintManager) {
                    paintManager.saveToHistory();
                }
            }
        });
    }
}

/**
 * 将当前主画布内容保存为指定面的 ImageData
 * @param {'A'|'B'} side 
 */
function syncCurrentCanvasToSide(side) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (side === 'A') {
        storedImageDataA = imageData;
        document.getElementById('aStatusLabel').innerText = `已同步 (${canvas.width}x${canvas.height})`;
        addLog(`✅ 已将当前画布内容同步到 A 面（尺寸 ${canvas.width}x${canvas.height}）`);
    } else {
        storedImageDataB = imageData;
        document.getElementById('bStatusLabel').innerText = `已同步 (${canvas.width}x${canvas.height})`;
        addLog(`✅ 已将当前画布内容同步到 B 面（尺寸 ${canvas.width}x${canvas.height}）`);
    }
    updateUIBasedOnProtocol();
}

// ==================== 主入口 ====================
document.body.onload = () => {
    textDecoder = null;
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    paintManager = new PaintManager(canvas, ctx);
    cropManager = new CropManager(canvas, ctx, paintManager);
    paintManager.initPaintTools();
    cropManager.initCropTools();

    initEventHandlers();
    updateButtonStatus();
    initContentDelivery();

    const initEditors = () => {
        initImageEditor();
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(initEditors, { timeout: 200 });
    } else {
        setTimeout(initEditors, 0);
    }
};

// 事件初始化
function initEventHandlers() {
    const syncABtn = document.getElementById('syncToABtn');
    const syncBBtn = document.getElementById('syncToBBtn');
    if (syncABtn) syncABtn.addEventListener('click', () => syncCurrentCanvasToSide('A'));
    if (syncBBtn) syncBBtn.addEventListener('click', () => syncCurrentCanvasToSide('B'));
}

// ==================== 内容投送（A/B 双面）====================
let aCanvas, aCtx, bCanvas, bCtx;
let aPaint, weatherMgrA, bPaint, bHot;
let aGenerated = false, bGenerated = false;

function initContentDelivery() {
    aCanvas = document.createElement('canvas'); aCanvas.width = 800; aCanvas.height = 480;
    aCtx = aCanvas.getContext('2d', { willReadFrequently: true });
    bCanvas = document.createElement('canvas'); bCanvas.width = 800; bCanvas.height = 480;
    bCtx = bCanvas.getContext('2d', { willReadFrequently: true });

    aPaint = new PaintManager(aCanvas, aCtx);
    weatherMgrA = new WeatherManager(aPaint);
    bPaint = new PaintManager(bCanvas, bCtx);
    bHot = new HotSearchManager(bCtx, bCanvas);

    // 预填 A 面天气配置（复用 localStorage 中已有的和风天气配置）
    const host = localStorage.getItem('qweather_api_host') || '';
    const key = localStorage.getItem('qweather_api_key') || '';
    const city = localStorage.getItem('qweather_city') || '北京';
    const aHost = document.getElementById('aWhost');
    const aKey = document.getElementById('aWkey');
    const aCity = document.getElementById('aWcity');
    if (aHost) aHost.value = host;
    if (aKey) aKey.value = key;
    if (aCity) aCity.value = city;

    aCtx.fillStyle = '#FFFFFF'; aCtx.fillRect(0, 0, 800, 480);
    bCtx.fillStyle = '#FFFFFF'; bCtx.fillRect(0, 0, 800, 480);
    refreshFacePreview('A'); refreshFacePreview('B');

    bindContentEvents();
}

function refreshFacePreview(face) {
    const pc = document.getElementById(face === 'A' ? 'aPreviewCanvas' : 'bPreviewCanvas');
    const src = face === 'A' ? aCanvas : bCanvas;
    if (!pc) return;
    const pctx = pc.getContext('2d');
    pctx.fillStyle = '#FFFFFF'; pctx.fillRect(0, 0, pc.width, pc.height);
    pctx.drawImage(src, 0, 0, pc.width, pc.height);
}

function bindContentEvents() {
    const tabA = document.getElementById('tabAFace');
    const tabB = document.getElementById('tabBFace');
    const aPanel = document.getElementById('aFacePanel');
    const bPanel = document.getElementById('bFacePanel');
    tabA.addEventListener('click', () => {
        tabA.classList.add('active'); tabB.classList.remove('active');
        aPanel.style.display = ''; bPanel.style.display = 'none';
    });
    tabB.addEventListener('click', () => {
        tabB.classList.add('active'); tabA.classList.remove('active');
        bPanel.style.display = ''; aPanel.style.display = 'none';
    });

    const bTabHot = document.getElementById('bTabHot');
    const bTabCal = document.getElementById('bTabCal');
    const bTabWeb = document.getElementById('bTabWeb');
    const bHotPanel = document.getElementById('bHotPanel');
    const bCalPanel = document.getElementById('bCalPanel');
    const bWebPanel = document.getElementById('bWebPanel');
    const showB = (which) => {
        bTabHot.classList.toggle('active', which === 'hot');
        bTabCal.classList.toggle('active', which === 'cal');
        bTabWeb.classList.toggle('active', which === 'web');
        bHotPanel.style.display = which === 'hot' ? '' : 'none';
        bCalPanel.style.display = which === 'cal' ? '' : 'none';
        bWebPanel.style.display = which === 'web' ? '' : 'none';
    };
    bTabHot.addEventListener('click', () => showB('hot'));
    bTabCal.addEventListener('click', () => showB('cal'));
    bTabWeb.addEventListener('click', () => showB('web'));

    document.getElementById('aWfetchBtn').addEventListener('click', genAFaceWeather);
    document.getElementById('bHotFetchBtn').addEventListener('click', genBFaceHot);
    document.getElementById('bCalGenBtn').addEventListener('click', genBFaceCalendar);
    document.getElementById('bWebShotBtn').addEventListener('click', genBFaceWeb);
    document.getElementById('bWebFile').addEventListener('change', onBWebFile);

    document.getElementById('sendAFaceBtn').addEventListener('click', () => deliverFace('A'));
    document.getElementById('sendBFaceBtn').addEventListener('click', () => deliverFace('B'));
    document.getElementById('sendABBothBtn').addEventListener('click', () => deliverFace('AB'));
}

async function genAFaceWeather() {
    const host = document.getElementById('aWhost').value.trim();
    const key = document.getElementById('aWkey').value.trim();
    const city = document.getElementById('aWcity').value.trim() || '北京';
    const style = document.getElementById('aWstyle').value;
    // 同步到 weather.js 读取的隐藏输入
    document.getElementById('weather-api-host').value = host;
    document.getElementById('weather-api-key').value = key;
    document.getElementById('weather-city').value = city;
    document.getElementById('weather-style').value = style;
    if (host) localStorage.setItem('qweather_api_host', host.replace(/^https?:\/\//, '').replace(/\/$/, ''));
    if (key) localStorage.setItem('qweather_api_key', key);
    localStorage.setItem('qweather_city', city);

    addLog('🔄 正在生成 A 面天气（' + city + '）...');
    try {
        await weatherMgrA.fetchWeather();
        aGenerated = true;
        document.getElementById('aStatusNote').textContent = 'A 面已生成（天气 · ' + city + '）';
        addLog('✅ A 面天气已生成');
    } catch (e) {
        addLog('❌ A 面天气生成失败: ' + e.message);
    }
    refreshFacePreview('A');
}

async function genBFaceHot() {
    const platform = document.getElementById('bPlatform').value;
    addLog('🔄 正在获取「' + bHot.getPlatformName(platform) + '」热搜...');
    await bHot.fetch(platform);
    bCtx.fillStyle = '#FFFFFF'; bCtx.fillRect(0, 0, 800, 480);
    bHot.draw();
    bGenerated = true;
    const src = bHot.lastSource === 'offline' ? '（离线示例）' : '（实时）';
    document.getElementById('bStatusNote').textContent = 'B 面已生成：热搜 ' + src;
    addLog('✅ B 面热搜已生成 ' + src);
    refreshFacePreview('B');
}

function genBFaceCalendar() {
    const now = new Date();
    bPaint.calendarData = {
        year: now.getFullYear(),
        month: now.getMonth(),
        today: { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() }
    };
    bCtx.fillStyle = '#FFFFFF'; bCtx.fillRect(0, 0, 800, 480);
    bPaint.drawCalendar();
    bGenerated = true;
    document.getElementById('bStatusNote').textContent = 'B 面已生成：' + (now.getMonth() + 1) + ' 月日历（含农历）';
    addLog('✅ B 面日历已生成');
    refreshFacePreview('B');
}

async function genBFaceWeb() {
    const url = document.getElementById('bWebUrl').value.trim();
    if (!url) { alert('请输入网页地址'); return; }
    const apiBase = document.getElementById('bWebApi').value.trim();
    const shotUrl = (apiBase ? apiBase : 'https://api.vvhan.com/api/screenshot?url=') + encodeURIComponent(url);
    addLog('🔄 正在截图: ' + url);
    try {
        const img = await loadImageCORS(shotUrl);
        bCtx.fillStyle = '#FFFFFF'; bCtx.fillRect(0, 0, 800, 480);
        drawImageCover(bCtx, img, 800, 480);
        bGenerated = true;
        document.getElementById('bStatusNote').textContent = 'B 面已生成：网页截图';
        addLog('✅ B 面网页截图已生成');
    } catch (e) {
        addLog('❌ 网页截图失败: ' + e.message + '（可改用本地图片上传）');
        alert('网页截图失败：' + e.message + '\n可改用「本地图片」上传到 B 面。');
    }
    refreshFacePreview('B');
}

function onBWebFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
        bCtx.fillStyle = '#FFFFFF'; bCtx.fillRect(0, 0, 800, 480);
        drawImageCover(bCtx, img, 800, 480);
        bGenerated = true;
        document.getElementById('bStatusNote').textContent = 'B 面已生成：本地图片';
        addLog('✅ B 面本地图片已载入');
        refreshFacePreview('B');
        URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
}

function loadImageCORS(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('图片加载失败（可能无 CORS 头）'));
        img.src = url;
    });
}

function drawImageCover(ctx, img, W, H) {
    const ir = img.width / img.height;
    const cr = W / H;
    let dw, dh, dx, dy;
    if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; }
    else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
}

async function deliverFace(face) {
    if (!appModeEnabled) {
        alert('请先通过「连接」按钮连接设备（APP 模式）后再投递。');
        return;
    }
    if (face === 'A' || face === 'AB') {
        if (!aGenerated) addLog('⚠️ A 面尚未生成内容，将发送空白');
        storedImageDataA = aCtx.getImageData(0, 0, 800, 480);
    }
    if (face === 'B' || face === 'AB') {
        if (!bGenerated) addLog('⚠️ B 面尚未生成内容，将发送空白');
        storedImageDataB = bCtx.getImageData(0, 0, 800, 480);
    }
    const abSel = document.getElementById('abSelect');
    abSel.value = (face === 'AB') ? '7' : (face === 'A' ? '1' : '2');
    addLog('📤 开始投递 ' + (face === 'A' ? 'A 面' : face === 'B' ? 'B 面' : 'AB 异显'));
    await sendimgAppMode();
}
