const LUNAR_INFO = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
    0x0d520
];

/**
 * 画板管理器类
 * 负责画笔、文字、课表、待办、名片、WiFi等元素的绘制和管理
 * 支持撤销/重做、历史记录、本地存储等
 */
class PaintManager {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        
        // 画笔状态
        this.painting = false;
        this.lastX = 0;
        this.lastY = 0;
        this.brushColor = "#000000";
        this.brushSize = 2;
        this.currentTool = null;           // 当前工具: 'brush', 'eraser', 'text', 'schedule', 'todo', 'card', 'wifi'
        
        // 文字元素
        this.textElements = [];              // 存储文字对象: {text, x, y, font, color}
        this.lineSegments = [];              // 存储线条对象: {type, x, y, x1, y1, x2, y2, color, size}
        this.isTextPlacementMode = false;    // 是否处于放置文字模式
        this.draggingCanvasContext = null;   // 拖拽时的画布快照
        this.selectedTextElement = null;     // 当前选中的文字元素（用于拖拽）
        this.isDraggingText = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.textBold = false;
        this.textItalic = false;
        
        // 课表相关
        this.scheduleData = null;             // 二维数组存储课表内容
        this.scheduleDays = 5;               // 天数
        this.scheduleClasses = 6;            // 课程节数
        this.scheduleFontSize = 12;          // 字体大小
        this.scheduleStartX = 20;             // 起始X
        this.scheduleStartY = 20;             // 起始Y
        this.scheduleCellWidth = 60;          // 单元格宽度
        this.scheduleCellHeight = 35;         // 单元格高度
        this.scheduleTitleText = "课程表";
        this.scheduleTitleAreaHeight = 24;
        this.scheduleColor = "#000000";
        this.weekDays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
        this.selectedScheduleCell = null;     // 当前选中的单元格 {row, col}
        
        // 待办事项相关
        this.todoData = null;                 // 待办事项数组 [{text, done, color}]
        this.todoCount = 8;                  // 待办条数
        this.todoFontSize = 12;
        this.todoStartX = 20;
        this.todoStartY = 20;
        this.todoRowHeight = 28;
        this.todoTitleText = "待办事项";
        this.todoTitleAreaHeight = 24;
        this.todoWidth = 0;
        this.todoColor = "#000000";
        
        // 名片相关
        this.cardData = null;                 // {name, title, phone, email, website, footer}
        
        // WiFi相关
        this.wifiData = null;                 // {ssid, password, encryption, hidden}
        
        // 日历相关
        this.calendarData = null;             // 日历数据对象
        this.calendarFontSize = 14;
        this.calendarStartX = 20;
        this.calendarStartY = 20;

        // 天气相关
        this.weatherData = null;              // 天气数据对象
        this.weatherStyle = 'full';
        this.weatherManager = null;
        
        // 光标相关
        this.brushCursor = null;
        this.cursorUpdateScheduled = false;
        this.pendingCursorX = 0;
        this.pendingCursorY = 0;
        
        // 撤销/重做
        this.historyStack = [];
        this.historyStep = -1;
        this.MAX_HISTORY = 50;
        
        // 绑定事件
        this.startPaint = this.startPaint.bind(this);
        this.paint = this.paint.bind(this);
        this.endPaint = this.endPaint.bind(this);
        this.handleCanvasClick = this.handleCanvasClick.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.handleKeyboard = this.handleKeyboard.bind(this);
        this.updateBrushCursor = this.updateBrushCursor.bind(this);
        this.hideBrushCursor = this.hideBrushCursor.bind(this);
    }
    
    // ==================== 历史记录管理 ====================
    saveToHistory() {
        // 移除当前步骤之后的状态（当用户撤销后进行了新操作）
        this.historyStack = this.historyStack.slice(0, this.historyStep + 1);
        
        const canvasState = {
            imageData: this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height),
            textElements: JSON.parse(JSON.stringify(this.textElements)),
            lineSegments: JSON.parse(JSON.stringify(this.lineSegments)),
            scheduleData: this.scheduleData ? JSON.parse(JSON.stringify(this.scheduleData)) : null,
            scheduleDays: this.scheduleDays,
            scheduleClasses: this.scheduleClasses,
            scheduleFontSize: this.scheduleFontSize,
            todoData: this.todoData ? JSON.parse(JSON.stringify(this.todoData)) : null,
            todoCount: this.todoCount,
            todoFontSize: this.todoFontSize,
            cardData: this.cardData ? JSON.parse(JSON.stringify(this.cardData)) : null,
            wifiData: this.wifiData ? JSON.parse(JSON.stringify(this.wifiData)) : null,
            calendarData: this.calendarData ? JSON.parse(JSON.stringify(this.calendarData)) : null,
            weatherData: this.weatherData ? JSON.parse(JSON.stringify(this.weatherData)) : null,
            weatherStyle: this.weatherStyle
        };
        
        this.historyStack.push(canvasState);
        this.historyStep++;
        
        // 限制历史记录数量
        if (this.historyStack.length > this.MAX_HISTORY) {
            this.historyStack.shift();
            this.historyStep--;
        }
        
        this.updateUndoRedoButtons();
        this.saveCanvasToLocalStorage();
    }
    
    clearHistory() {
        this.historyStack = [];
        this.historyStep = -1;
        this.updateUndoRedoButtons();
    }
    
    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            this.restoreFromHistory();
        }
    }
    
    redo() {
        if (this.historyStep < this.historyStack.length - 1) {
            this.historyStep++;
            this.restoreFromHistory();
        }
    }
    
    restoreFromHistory() {
        if (this.historyStep >= 0 && this.historyStep < this.historyStack.length) {
            const state = this.historyStack[this.historyStep];
            this.ctx.putImageData(state.imageData, 0, 0);
            this.textElements = JSON.parse(JSON.stringify(state.textElements));
            this.lineSegments = JSON.parse(JSON.stringify(state.lineSegments));
            this.scheduleData = state.scheduleData ? JSON.parse(JSON.stringify(state.scheduleData)) : null;
            this.scheduleDays = state.scheduleDays;
            this.scheduleClasses = state.scheduleClasses;
            this.scheduleFontSize = state.scheduleFontSize;
            this.todoData = state.todoData ? JSON.parse(JSON.stringify(state.todoData)) : null;
            this.todoCount = state.todoCount;
            this.todoFontSize = state.todoFontSize;
            this.cardData = state.cardData ? JSON.parse(JSON.stringify(state.cardData)) : null;
            this.wifiData = state.wifiData ? JSON.parse(JSON.stringify(state.wifiData)) : null;
            this.calendarData = state.calendarData ? JSON.parse(JSON.stringify(state.calendarData)) : null;
            this.weatherData = state.weatherData ? JSON.parse(JSON.stringify(state.weatherData)) : null;
            this.weatherStyle = state.weatherStyle || 'full';
            this.updateUndoRedoButtons();
        }
    }
    
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        if (undoBtn) undoBtn.disabled = this.historyStep <= 0;
        if (redoBtn) redoBtn.disabled = this.historyStep >= this.historyStack.length - 1;
    }
    
    saveCanvasToLocalStorage() {
        try {
            const canvasData = {
                imageDataUrl: this.canvas.toDataURL('image/png', 0.8),
                textElements: this.textElements,
                lineSegments: this.lineSegments.slice(-100), // 限制数量
                todoData: this.todoData,
                scheduleData: this.scheduleData,
                cardData: this.cardData,
                wifiData: this.wifiData,
                width: this.canvas.width,
                height: this.canvas.height
            };
            localStorage.setItem('canvasState', JSON.stringify(canvasData));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('localStorage quota exceeded, clearing old data...');
                try {
                    localStorage.removeItem('canvasState');
                    const minimalData = {
                        textElements: this.textElements,
                        todoData: this.todoData,
                        scheduleData: this.scheduleData,
                        width: this.canvas.width,
                        height: this.canvas.height
                    };
                    localStorage.setItem('canvasState', JSON.stringify(minimalData));
                } catch (e2) {
                    console.error('Failed to save minimal canvas data:', e2);
                }
            } else {
                console.error('Failed to save canvas to localStorage:', e);
            }
        }
    }
    
    loadCanvasFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('canvasState');
            if (!savedData) return false;
            const canvasData = JSON.parse(savedData);
            if (canvasData.width !== this.canvas.width || canvasData.height !== this.canvas.height) {
                return false;
            }
            if (canvasData.imageDataUrl) {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        this.ctx.drawImage(img, 0, 0);
                        this.textElements = canvasData.textElements || [];
                        this.lineSegments = canvasData.lineSegments || [];
                        this.todoData = canvasData.todoData || null;
                        this.scheduleData = canvasData.scheduleData || null;
                        this.cardData = canvasData.cardData || null;
                        this.wifiData = canvasData.wifiData || null;
                        this.saveToHistory();
                        resolve(true);
                    };
                    img.onerror = () => resolve(false);
                    img.src = canvasData.imageDataUrl;
                });
            }
            this.textElements = canvasData.textElements || [];
            this.lineSegments = canvasData.lineSegments || [];
            this.todoData = canvasData.todoData || null;
            this.scheduleData = canvasData.scheduleData || null;
            this.cardData = canvasData.cardData || null;
            this.wifiData = canvasData.wifiData || null;
            this.saveToHistory();
            return true;
        } catch (e) {
            console.error('Failed to load canvas from localStorage:', e);
            return false;
        }
    }
    
    clearCanvasCache() {
        try {
            localStorage.removeItem('canvasState');
        } catch (e) {
            console.error('Failed to clear canvas cache:', e);
        }
    }
    
    // ==================== 工具初始化 ====================
    initPaintTools() {
        // 画笔模式
        document.getElementById('brush-mode').addEventListener('click', () => {
            if (this.currentTool === 'brush') {
                this.setActiveTool(null, '');
            } else {
                this.setActiveTool('brush', '画笔模式');
                this.brushColor = document.getElementById('brush-color').value;
            }
        });
        
        // 橡皮擦模式
        document.getElementById('eraser-mode').addEventListener('click', () => {
            if (this.currentTool === 'eraser') {
                this.setActiveTool(null, '');
            } else {
                this.setActiveTool('eraser', '橡皮擦');
                this.brushColor = "#FFFFFF";
            }
        });
        
        // 文字模式
        document.getElementById('text-mode').addEventListener('click', () => {
            if (this.currentTool === 'text') {
                this.setActiveTool(null, '');
            } else {
                this.setActiveTool('text', '插入文字');
                this.brushColor = document.getElementById('brush-color').value;
            }
        });
        
        // 颜色选择
        document.getElementById('brush-color').addEventListener('change', (e) => {
            this.brushColor = e.target.value;
        });
        
        // 画笔大小
        document.getElementById('brush-size').addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            this.updateBrushCursorSize();
        });
        
        // 添加文字按钮
        document.getElementById('add-text-btn').addEventListener('click', () => this.startTextPlacement());
        
        // 文字样式
        document.getElementById('text-bold').addEventListener('click', () => {
            this.textBold = !this.textBold;
            document.getElementById('text-bold').classList.toggle('primary', this.textBold);
        });
        
        document.getElementById('text-italic').addEventListener('click', () => {
            this.textItalic = !this.textItalic;
            document.getElementById('text-italic').classList.toggle('primary', this.textItalic);
        });
        
        // 撤销/重做
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());
        
        // 课表模式（按钮绑定在外部，这里只做模式切换）
        const scheduleModeBtn = document.getElementById('schedule-mode');
        if (scheduleModeBtn) {
            scheduleModeBtn.addEventListener('click', () => {
                if (this.currentTool === 'schedule') {
                    this.setActiveTool(null, '');
                } else {
                    this.setActiveTool('schedule', '课表模式：生成课表后点击单元格可编辑');
                }
            });
        }
        
        // 创建课表按钮（在面板中）
        const createScheduleBtn = document.getElementById('create-schedule-btn');
        if (createScheduleBtn) {
            createScheduleBtn.addEventListener('click', () => this.createSchedule());
        }
        
        // 课表单元格编辑相关
        const confirmBtn = document.getElementById('schedule-input-confirm-btn');
        const cancelBtn = document.getElementById('schedule-input-cancel-btn');
        const scheduleInput = document.getElementById('schedule-input');
        if (confirmBtn) confirmBtn.addEventListener('click', () => this.confirmScheduleInput());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelScheduleInput());
        if (scheduleInput) scheduleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.confirmScheduleInput();
        });
        
        // 待办模式（按钮绑定在外部）
        const todoModeBtn = document.getElementById('todo-mode');
        if (todoModeBtn) {
            todoModeBtn.addEventListener('click', () => {
                if (this.currentTool === 'todo') {
                    this.setActiveTool(null, '');
                } else {
                    this.setActiveTool('todo', '待办事项模式：可编辑表格');
                }
            });
        }
        
        // 名片模式（按钮绑定在外部）
        const cardModeBtn = document.getElementById('card-mode');
        if (cardModeBtn) {
            cardModeBtn.addEventListener('click', () => {
                if (this.currentTool === 'card') {
                    this.setActiveTool(null, '');
                } else {
                    this.setActiveTool('card', '名片模式：填写信息后点击同步');
                }
            });
        }
        
        // WiFi模式（按钮绑定在外部）
        const wifiModeBtn = document.getElementById('wifi-mode');
        if (wifiModeBtn) {
            wifiModeBtn.addEventListener('click', () => {
                if (this.currentTool === 'wifi') {
                    this.setActiveTool(null, '');
                } else {
                    this.setActiveTool('wifi', 'WiFi模式：填写网络信息');
                }
            });
        }
        
        // 日历模式
        const calendarModeBtn = document.getElementById('calendar-mode');
        if (calendarModeBtn) {
            calendarModeBtn.addEventListener('click', () => {
                if (this.currentTool === 'calendar') {
                    this.setActiveTool(null, '');
                } else {
                    this.setActiveTool('calendar', '日历模式：点击生成日历');
                    this.createCalendar();
                }
            });
        }

        // 天气模式
        const weatherModeBtn = document.getElementById('weather-mode');
        if (weatherModeBtn) {
            weatherModeBtn.addEventListener('click', () => {
                if (this.currentTool === 'weather') {
                    this.setActiveTool(null, '');
                } else {
                    this.setActiveTool('weather', '天气模式：获取并显示天气');
                    this.initWeatherPanel();
                }
            });
        }
        
        // 画布事件
        this.canvas.addEventListener('mousedown', this.startPaint);
        this.canvas.addEventListener('mousemove', this.paint);
        this.canvas.addEventListener('mouseup', this.endPaint);
        this.canvas.addEventListener('mouseleave', this.endPaint);
        this.canvas.addEventListener('click', this.handleCanvasClick);
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: true });
        this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: true });
        
        // 键盘快捷键
        document.addEventListener('keydown', this.handleKeyboard);
        
        // 光标
        this.canvas.addEventListener('mouseenter', this.updateBrushCursor);
        this.canvas.addEventListener('mousemove', this.updateBrushCursor);
        this.createBrushCursor();
        
        // 保存初始状态
        this.saveToHistory();
    }
    
    setActiveTool(tool, title) {
        setCanvasTitle(title);
        this.currentTool = tool;
        
        // 更新UI样式
        this.canvas.parentNode.classList.toggle('brush-mode', tool === 'brush');
        this.canvas.parentNode.classList.toggle('eraser-mode', tool === 'eraser');
        this.canvas.parentNode.classList.toggle('text-mode', tool === 'text');
        this.canvas.parentNode.classList.toggle('schedule-mode', tool === 'schedule');
        
        const brushBtn = document.getElementById('brush-mode');
        const eraserBtn = document.getElementById('eraser-mode');
        const textBtn = document.getElementById('text-mode');
        const scheduleBtn = document.getElementById('schedule-mode');
        const calendarBtn = document.getElementById('calendar-mode');
        const weatherBtn = document.getElementById('weather-mode');
        if (brushBtn) brushBtn.classList.toggle('active', tool === 'brush');
        if (eraserBtn) eraserBtn.classList.toggle('active', tool === 'eraser');
        if (textBtn) textBtn.classList.toggle('active', tool === 'text');
        if (scheduleBtn) scheduleBtn.classList.toggle('active', tool === 'schedule');
        if (calendarBtn) calendarBtn.classList.toggle('active', tool === 'calendar');
        if (weatherBtn) weatherBtn.classList.toggle('active', tool === 'weather');

        const weatherPanel = document.getElementById('weather-panel');
        if (weatherPanel) weatherPanel.style.display = tool === 'weather' ? 'block' : 'none';
        
        // 禁用/启用控件
        document.getElementById('brush-color').disabled = tool === 'eraser' || tool === 'schedule';
        document.getElementById('brush-size').disabled = tool === 'text' || tool === 'schedule';
        
        // 撤销/重做按钮显示
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        if (undoBtn) undoBtn.classList.toggle('hide', tool === null);
        if (redoBtn) redoBtn.classList.toggle('hide', tool === null);
        
        // 取消文字放置模式
        this.cancelTextPlacement();
    }
    
    handleKeyboard(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
            e.preventDefault();
            this.redo();
        }
    }
    
    // ==================== 光标相关 ====================
    createBrushCursor() {
        this.brushCursor = document.createElement('div');
        this.brushCursor.id = 'brush-cursor';
        this.brushCursor.style.position = 'fixed';
        this.brushCursor.style.border = '2px solid rgba(0, 0, 0, 0.5)';
        this.brushCursor.style.borderRadius = '50%';
        this.brushCursor.style.pointerEvents = 'none';
        this.brushCursor.style.display = 'none';
        this.brushCursor.style.zIndex = '10000';
        this.brushCursor.style.transform = 'translate(-50%, -50%)';
        this.brushCursor.style.left = '0';
        this.brushCursor.style.top = '0';
        document.body.appendChild(this.brushCursor);
        this.updateBrushCursorSize();
    }
    
    updateBrushCursorSize() {
        if (!this.brushCursor) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / this.canvas.width;
        const scaleY = rect.height / this.canvas.height;
        const scale = Math.min(scaleX, scaleY);
        const size = this.brushSize * scale;
        this.brushCursor.style.width = size + 'px';
        this.brushCursor.style.height = size + 'px';
    }
    
    updateBrushCursor(e) {
        if (!this.brushCursor) return;
        if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
            const rect = this.canvas.getBoundingClientRect();
            const isInCanvas = e.clientX >= rect.left && e.clientX <= rect.right &&
                               e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (isInCanvas) {
                this.brushCursor.style.display = 'block';
                this.canvas.style.cursor = 'none';
                this.pendingCursorX = e.clientX;
                this.pendingCursorY = e.clientY;
                if (!this.cursorUpdateScheduled) {
                    this.cursorUpdateScheduled = true;
                    requestAnimationFrame(() => {
                        this.brushCursor.style.transform = `translate(${this.pendingCursorX}px, ${this.pendingCursorY}px) translate(-50%, -50%)`;
                        this.cursorUpdateScheduled = false;
                    });
                }
                if (this.currentTool === 'eraser') {
                    if (this.brushCursor.getAttribute('data-tool') !== 'eraser') {
                        this.brushCursor.style.border = '2px solid rgba(255, 0, 0, 0.7)';
                        this.brushCursor.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                        this.brushCursor.style.boxShadow = 'none';
                        this.brushCursor.setAttribute('data-tool', 'eraser');
                    }
                } else {
                    if (this.brushCursor.getAttribute('data-tool') !== 'brush') {
                        this.brushCursor.style.border = '1px solid white';
                        this.brushCursor.style.boxShadow = '0 0 0 1px black, inset 0 0 0 1px black';
                        this.brushCursor.style.backgroundColor = 'transparent';
                        this.brushCursor.setAttribute('data-tool', 'brush');
                    }
                }
            } else {
                this.brushCursor.style.display = 'none';
            }
        }
    }
    
    hideBrushCursor() {
        if (this.brushCursor) this.brushCursor.style.display = 'none';
        this.canvas.style.cursor = 'default';
    }
    
    // ==================== 绘画相关 ====================
    startPaint(e) {
        if (!this.currentTool) return;
        if (this.currentTool === 'text') {
            const textElement = this.findTextElementAt(e);
            if (textElement) {
                // 编辑文字（待实现）
                this.isDraggingText = true;
                this.selectedTextElement = textElement;
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                this.dragOffsetX = textElement.x - x;
                this.dragOffsetY = textElement.y - y;
                return;
            }
        } else if (this.currentTool !== 'schedule' && this.currentTool !== 'todo' && this.currentTool !== 'card' && this.currentTool !== 'wifi') {
            this.painting = true;
            this.draw(e);
        }
    }
    
    endPaint() {
        if (this.painting || this.isDraggingText) {
            this.saveToHistory();
        }
        this.painting = false;
        this.isDraggingText = false;
        this.lastX = 0;
        this.lastY = 0;
        this.hideBrushCursor();
    }
    
    paint(e) {
        if (!this.currentTool) return;
        if (this.currentTool === 'text') {
            if (this.isDraggingText && this.selectedTextElement) {
                this.dragText(e);
            }
        } else if (this.currentTool !== 'schedule' && this.currentTool !== 'todo' && this.currentTool !== 'card' && this.currentTool !== 'wifi') {
            if (this.painting) {
                this.draw(e);
            }
        }
    }
    
    draw(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = this.brushColor;
        this.ctx.lineWidth = this.brushSize;
        this.ctx.beginPath();
        
        if (this.lastX === 0 && this.lastY === 0) {
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x + 0.1, y + 0.1);
            this.lineSegments.push({
                type: 'dot',
                x: x,
                y: y,
                color: this.brushColor,
                size: this.brushSize
            });
        } else {
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineTo(x, y);
            this.lineSegments.push({
                type: 'line',
                x1: this.lastX,
                y1: this.lastY,
                x2: x,
                y2: y,
                color: this.brushColor,
                size: this.brushSize
            });
        }
        
        this.ctx.stroke();
        this.lastX = x;
        this.lastY = y;
    }
    
    handleCanvasClick(e) {
        if (this.currentTool === 'text' && this.isTextPlacementMode) {
            this.placeText(e);
        } else if (this.currentTool === 'schedule' && this.scheduleData) {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            const cell = this.getScheduleCellAt(x, y);
            if (cell) {
                this.selectedScheduleCell = cell;
                const currentText = this.scheduleData[cell.row][cell.col];
                const inputEl = document.getElementById('schedule-input');
                if (inputEl) {
                    inputEl.value = currentText;
                    inputEl.focus();
                }
                this.redrawAll();
            }
        }
    }
    
    // ==================== 触摸事件 ====================
    onTouchStart(e) {
        const touch = e.touches[0];
        if (this.currentTool === 'text' && this.isTextPlacementMode) {
            const mouseEvent = new MouseEvent('click', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            this.canvas.dispatchEvent(mouseEvent);
        } else {
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        }
    }
    
    onTouchMove(e) {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }
    
    onTouchEnd(e) {
        this.endPaint();
    }
    
    // ==================== 文字相关 ====================
    findTextElementAt(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        for (let i = this.textElements.length - 1; i >= 0; i--) {
            const text = this.textElements[i];
            this.ctx.font = text.font;
            const width = this.ctx.measureText(text.text).width;
            const fontSizeMatch = text.font.match(/(\d+)px/);
            const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1]) : 14;
            const height = fontSize * 1.2;
            if (x >= text.x - 5 && x <= text.x + width + 5 &&
                y >= text.y - height + 5 && y <= text.y + 5) {
                return text;
            }
        }
        return null;
    }
    
    startTextPlacement() {
        const textInput = document.getElementById('text-input').value.trim();
        if (!textInput) {
            alert('请输入文字内容');
            return;
        }
        this.isTextPlacementMode = true;
        setCanvasTitle('点击画布放置文字');
        this.canvas.classList.add('text-placement-mode');
    }
    
    cancelTextPlacement() {
        this.isTextPlacementMode = false;
        this.canvas.classList.remove('text-placement-mode');
        this.isDraggingText = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.selectedTextElement = null;
        this.draggingCanvasContext = null;
    }
    
    placeText(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        const text = document.getElementById('text-input').value;
        const fontFamily = document.getElementById('font-family').value;
        const fontSize = document.getElementById('font-size').value;
        
        let fontStyle = '';
        if (this.textItalic) fontStyle += 'italic ';
        if (this.textBold) fontStyle += 'bold ';
        fontStyle += `${fontSize}px ${fontFamily}`;
        
        const newText = {
            text: text,
            x: x,
            y: y,
            font: fontStyle,
            color: this.brushColor
        };
        this.textElements.push(newText);
        this.selectedTextElement = newText;
        this.draggingCanvasContext = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.font = newText.font;
        this.ctx.fillStyle = newText.color;
        this.ctx.fillText(newText.text, newText.x, newText.y);
        
        this.saveToHistory();
        document.getElementById('text-input').value = '';
        this.isTextPlacementMode = false;
        this.canvas.classList.remove('text-placement-mode');
        setCanvasTitle('拖动新添加文字可调整位置');
    }
    
    dragText(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        this.selectedTextElement.x = x + this.dragOffsetX;
        this.selectedTextElement.y = y + this.dragOffsetY;
        
        if (this.draggingCanvasContext) {
            this.ctx.putImageData(this.draggingCanvasContext, 0, 0);
        } else {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        this.redrawTextElements();
        this.redrawLineSegments();
        
        this.ctx.font = this.selectedTextElement.font;
        this.ctx.fillStyle = this.selectedTextElement.color;
        this.ctx.fillText(this.selectedTextElement.text, this.selectedTextElement.x, this.selectedTextElement.y);
    }
    
    redrawTextElements() {
        this.textElements.forEach(item => {
            this.ctx.font = item.font;
            this.ctx.fillStyle = item.color;
            this.ctx.fillText(item.text, item.x, item.y);
        });
    }
    
    redrawLineSegments() {
        this.lineSegments.forEach(segment => {
            this.ctx.lineJoin = 'round';
            this.ctx.lineCap = 'round';
            this.ctx.strokeStyle = segment.color;
            this.ctx.lineWidth = segment.size;
            this.ctx.beginPath();
            if (segment.type === 'dot') {
                this.ctx.moveTo(segment.x, segment.y);
                this.ctx.lineTo(segment.x + 0.1, segment.y + 0.1);
            } else {
                this.ctx.moveTo(segment.x1, segment.y1);
                this.ctx.lineTo(segment.x2, segment.y2);
            }
            this.ctx.stroke();
        });
    }
    
    redrawAll() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.redrawLineSegments();
        this.redrawTextElements();
        if (this.scheduleData && this.scheduleData.length > 0) {
            this.drawSchedule();
        } else if (this.todoData && this.todoData.length > 0) {
            this.drawTodoList();
        } else if (this.cardData) {
            this.drawBusinessCard();
        } else if (this.wifiData) {
            this.drawWifiConnect();
        } else if (this.calendarData) {
            this.drawCalendar();
        } else if (this.weatherData || (this.weatherManager && this.weatherManager.weatherData)) {
            this.drawWeather();
        }
    }
    
    // ==================== 课表相关 ====================
    async createSchedule() {
        this.scheduleDays = parseInt(document.getElementById('schedule-days').value) || 5;
        this.scheduleClasses = parseInt(document.getElementById('schedule-classes').value) || 6;
        this.scheduleFontSize = parseInt(document.getElementById('schedule-font-size').value) || 12;
        this.lineSegments = [];
        this.textElements = [];
        this.todoData = null;
        this.cardData = null;
        this.wifiData = null;
        this.calculateScheduleDimensions();
        
        this.scheduleData = [];
        for (let i = 0; i <= this.scheduleClasses; i++) {
            this.scheduleData[i] = [];
            for (let j = 0; j <= this.scheduleDays; j++) {
                if (i === 0 && j === 0) {
                    this.scheduleData[i][j] = "";
                } else if (i === 0) {
                    this.scheduleData[i][j] = this.weekDays[j - 1];
                } else if (j === 0) {
                    this.scheduleData[i][j] = `第${i}节`;
                } else {
                    this.scheduleData[i][j] = "";
                }
            }
        }
        this.redrawAll();
        this.saveToHistory();
    }
    
    calculateScheduleDimensions() {
        const padding = 20;
        const availableWidth = this.canvas.width - 2 * padding;
        const availableHeight = this.canvas.height - 2 * padding - this.scheduleTitleAreaHeight;
        const cellWidth = Math.floor(availableWidth / (this.scheduleDays + 1));
        const cellHeight = Math.floor(availableHeight / (this.scheduleClasses + 1));
        this.scheduleCellWidth = Math.max(cellWidth, this.scheduleFontSize * 4);
        this.scheduleCellHeight = Math.max(cellHeight, this.scheduleFontSize * 2);
        this.scheduleStartX = padding;
        this.scheduleStartY = padding + this.scheduleTitleAreaHeight;
    }
    
    drawSchedule() {
        if (!this.scheduleData) return;
        const cellWidth = this.scheduleCellWidth;
        const cellHeight = this.scheduleCellHeight;
        const startX = this.scheduleStartX;
        const startY = this.scheduleStartY;
        
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 1;
        
        // 绘制标题
        const title = this.scheduleTitleText || "课程表";
        const titleX = startX + (cellWidth * (this.scheduleDays + 1) - this.ctx.measureText(title).width) / 2;
        const titleY = startY - 6;
        this.ctx.fillStyle = this.scheduleColor;
        this.ctx.font = "12px SimHei, sans-serif";
        this.ctx.fillText(title, titleX, titleY);
        
        // 绘制表格
        for (let i = 0; i < this.scheduleData.length; i++) {
            for (let j = 0; j < this.scheduleData[i].length; j++) {
                const x = startX + j * cellWidth;
                const y = startY + i * cellHeight;
                this.ctx.strokeRect(x, y, cellWidth, cellHeight);
                
                const content = this.scheduleData[i][j];
                if (content) {
                    const fontSize = this.scheduleFontSize;
                    const font = `${fontSize}px SimHei, sans-serif`;
                    this.ctx.font = font;
                    this.ctx.fillStyle = this.scheduleColor;
                    const textWidth = this.ctx.measureText(content).width;
                    const textX = x + (cellWidth - textWidth) / 2;
                    const textY = y + cellHeight / 2 + fontSize / 3;
                    this.ctx.fillText(content, textX, textY);
                }
            }
        }
        
        // 绘制选中单元格指示点
        if (this.selectedScheduleCell) {
            const row = this.selectedScheduleCell.row;
            const col = this.selectedScheduleCell.col;
            const x = startX + col * cellWidth;
            const y = startY + row * cellHeight;
            this.ctx.fillStyle = "#FF0000";
            this.ctx.beginPath();
            this.ctx.arc(x + cellWidth - 5, y + 5, 3, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }
    
    getScheduleCellAt(x, y) {
        if (!this.scheduleData) return null;
        const cellWidth = this.scheduleCellWidth;
        const cellHeight = this.scheduleCellHeight;
        const startX = this.scheduleStartX;
        const startY = this.scheduleStartY;
        const col = Math.floor((x - startX) / cellWidth);
        const row = Math.floor((y - startY) / cellHeight);
        if (col >= 0 && row >= 0 && row < this.scheduleData.length && col < this.scheduleData[0].length) {
            return { row, col };
        }
        return null;
    }
    
    updateScheduleCell(row, col, text) {
        if (this.scheduleData && row >= 0 && col >= 0 && row < this.scheduleData.length && col < this.scheduleData[0].length) {
            this.scheduleData[row][col] = text;
            this.redrawAll();
            this.saveToHistory();
        }
    }
    
    confirmScheduleInput() {
        if (this.selectedScheduleCell) {
            const text = document.getElementById('schedule-input').value;
            this.updateScheduleCell(this.selectedScheduleCell.row, this.selectedScheduleCell.col, text);
            this.cancelScheduleInput();
        }
    }
    
    cancelScheduleInput() {
        this.selectedScheduleCell = null;
        const inputEl = document.getElementById('schedule-input');
        if (inputEl) inputEl.value = '';
        if (this.scheduleData) this.redrawAll();
    }
    
    // ==================== 待办事项相关 ====================
    async createTodoList() {
        this.todoCount = parseInt(document.getElementById('todo-count').value) || 8;
        this.todoFontSize = parseInt(document.getElementById('todo-font-size').value) || 12;
        this.lineSegments = [];
        this.textElements = [];
        this.scheduleData = null;
        this.cardData = null;
        this.wifiData = null;
        this.calculateTodoDimensions();
        
        this.todoData = [];
        for (let i = 0; i < this.todoCount; i++) {
            this.todoData.push({ text: "", done: false, color: "#000000" });
        }
        this.redrawAll();
        this.saveToHistory();
    }
    
    calculateTodoDimensions() {
        this.todoTitleText = this.todoTitleText || "待办事项";
        this.todoTitleAreaHeight = 24;
        const availableHeight = this.canvas.height - 40 - this.todoTitleAreaHeight;
        this.todoRowHeight = Math.max(Math.floor(availableHeight / Math.max(1, this.todoCount)), this.todoFontSize * 2);
        this.todoStartX = 20;
        this.todoStartY = 20 + this.todoTitleAreaHeight;
        this.todoWidth = this.canvas.width - 40;
    }
    
    drawTodoList() {
        if (!this.todoData || this.todoData.length === 0) return;
        const startX = this.todoStartX;
        const startY = this.todoStartY;
        const rowHeight = this.todoRowHeight;
        const width = this.todoWidth;
        
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 1;
        
        // 标题
        const title = this.todoTitleText;
        this.ctx.fillStyle = "#000000";
        this.ctx.font = "12px SimHei, sans-serif";
        const titleWidth = this.ctx.measureText(title).width;
        const titleX = startX + (width - titleWidth) / 2;
        const titleY = startY - 12;
        this.ctx.fillText(title, titleX, titleY);
        
        // 边框
        this.ctx.strokeRect(startX, startY, width, rowHeight * this.todoData.length);
        
        const checkboxSize = Math.min(16, rowHeight - 8);
        const textX = startX + checkboxSize + 12;
        
        for (let i = 0; i < this.todoData.length; i++) {
            const y = startY + i * rowHeight;
            // 画横线
            if (i > 0) {
                this.ctx.beginPath();
                this.ctx.moveTo(startX, y);
                this.ctx.lineTo(startX + width, y);
                this.ctx.stroke();
            }
            // 复选框
            const boxY = y + (rowHeight - checkboxSize) / 2;
            this.ctx.strokeRect(startX + 8, boxY, checkboxSize, checkboxSize);
            if (this.todoData[i].done) {
                this.ctx.beginPath();
                this.ctx.moveTo(startX + 10, boxY + checkboxSize - 4);
                this.ctx.lineTo(startX + checkboxSize - 4, boxY + 4);
                this.ctx.moveTo(startX + checkboxSize - 4, boxY + checkboxSize - 4);
                this.ctx.lineTo(startX + 10, boxY + 4);
                this.ctx.stroke();
            }
            // 文字
            const text = this.todoData[i].text;
            if (text) {
                this.ctx.fillStyle = this.todoData[i].color || "#000000";
                this.ctx.font = `${this.todoFontSize}px SimHei, sans-serif`;
                const textY = y + rowHeight / 2 + this.todoFontSize / 3;
                this.ctx.fillText(text, textX, textY);
            }
        }
    }
    
    // ==================== 名片相关 ====================
    async createBusinessCard() {
        this.lineSegments = [];
        this.textElements = [];
        this.scheduleData = null;
        this.todoData = null;
        this.wifiData = null;
        
        const getValue = (id) => (document.getElementById(id)?.value || "").trim();
        const cardData = {
            name: getValue("card-name"),
            title: getValue("card-title"),
            phone: getValue("card-phone"),
            email: getValue("card-email"),
            website: getValue("card-website"),
            footer: getValue("card-footer")
        };
        this.cardData = cardData;
        this.redrawAll();
        this.saveToHistory();
    }
    
    drawBusinessCard() {
        if (!this.cardData) return;
        const width = this.canvas.width - 40;
        const height = this.canvas.height - 40;
        const startX = 20, startY = 20;
        
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(startX, startY, width, height);
        
        // 简单绘制名片内容
        const centerX = startX + width / 2;
        let y = startY + 40;
        const fontSize = 16;
        this.ctx.font = `bold ${fontSize}px SimHei, sans-serif`;
        this.ctx.fillStyle = "#000000";
        this.ctx.fillText(this.cardData.name || "姓名", centerX - this.ctx.measureText(this.cardData.name || "姓名").width / 2, y);
        y += 28;
        this.ctx.font = `14px SimHei, sans-serif`;
        this.ctx.fillText(this.cardData.title || "职位", centerX - this.ctx.measureText(this.cardData.title || "职位").width / 2, y);
        y += 30;
        if (this.cardData.phone) {
            this.ctx.fillText("电话: " + this.cardData.phone, startX + 20, y);
            y += 22;
        }
        if (this.cardData.email) {
            this.ctx.fillText("邮箱: " + this.cardData.email, startX + 20, y);
            y += 22;
        }
        if (this.cardData.website) {
            this.ctx.fillText("网站: " + this.cardData.website, startX + 20, y);
        }
        if (this.cardData.footer) {
            const footerY = startY + height - 20;
            this.ctx.fillText(this.cardData.footer, centerX - this.ctx.measureText(this.cardData.footer).width / 2, footerY);
        }
    }
    
    // ==================== WiFi相关 ====================
    async createWifiConnect() {
        this.lineSegments = [];
        this.textElements = [];
        this.scheduleData = null;
        this.todoData = null;
        this.cardData = null;
        
        const getValue = (id) => (document.getElementById(id)?.value || "").trim();
        const ssid = getValue("wifi-ssid");
        const password = getValue("wifi-password");
        const encryption = document.getElementById("wifi-encryption")?.value || "WPA";
        const hidden = !!document.getElementById("wifi-hidden")?.checked;
        
        this.wifiData = ssid ? { ssid, password, encryption, hidden } : null;
        this.redrawAll();
        this.saveToHistory();
    }
    
    drawWifiConnect() {
        if (!this.wifiData) return;
        const width = this.canvas.width - 40;
        const height = this.canvas.height - 40;
        const startX = 20, startY = 20;
        
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(startX, startY, width, height);
        
        // 绘制WiFi信息
        const centerX = startX + width / 2;
        let y = startY + 50;
        this.ctx.font = "bold 20px SimHei, sans-serif";
        this.ctx.fillStyle = "#000000";
        this.ctx.fillText("WiFi 连接", centerX - this.ctx.measureText("WiFi 连接").width / 2, y);
        y += 40;
        this.ctx.font = "14px SimHei, sans-serif";
        this.ctx.fillText("网络: " + this.wifiData.ssid, startX + 20, y);
        y += 24;
        if (this.wifiData.password && this.wifiData.encryption !== "nopass") {
            this.ctx.fillText("密码: " + this.wifiData.password, startX + 20, y);
            y += 24;
        }
        this.ctx.fillText("加密: " + this.wifiData.encryption, startX + 20, y);
        y += 24;
        if (this.wifiData.hidden) {
            this.ctx.fillText("隐藏网络: 是", startX + 20, y);
        }
        
        // 绘制二维码（简单模拟）
        if (typeof qrcode !== 'undefined') {
            try {
                let qrText = `WIFI:T:${this.wifiData.encryption};S:${this.wifiData.ssid};`;
                if (this.wifiData.password && this.wifiData.encryption !== "nopass") {
                    qrText += `P:${this.wifiData.password};`;
                }
                if (this.wifiData.hidden) qrText += "H:true;";
                qrText += ";";
                
                const qrSize = Math.min(width - 40, 120);
                const qrX = startX + width - qrSize - 20;
                const qrY = startY + height - qrSize - 20;
                const qr = qrcode(0, "M");
                qr.addData(qrText);
                qr.make();
                const cells = qr.getModuleCount();
                const cellSize = qrSize / cells;
                for (let row = 0; row < cells; row++) {
                    for (let col = 0; col < cells; col++) {
                        if (qr.isDark(row, col)) {
                            this.ctx.fillStyle = "#000000";
                            this.ctx.fillRect(qrX + col * cellSize, qrY + row * cellSize, cellSize, cellSize);
                        }
                    }
                }
            } catch (e) {
                console.warn("QR generation failed", e);
            }
        }
    }
    
    // ==================== 日历相关 ====================
    createCalendar() {
        this.lineSegments = [];
        this.textElements = [];
        this.scheduleData = null;
        this.todoData = null;
        this.cardData = null;
        this.wifiData = null;
        
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        this.calendarData = {
            year: year,
            month: month,
            today: {
                day: now.getDate(),
                month: month,
                year: year,
                dayOfWeek: now.getDay()
            }
        };
        
        this.redrawAll();
        this.saveToHistory();
    }
    
    getHolidays(year, month) {
        const holidays = {};
        
        const allHolidays = {
            2025: {
                '01-01': '元旦', '01-02': '元旦', '01-03': '元旦',
                '01-29': '春节', '01-30': '春节', '01-31': '春节',
                '02-01': '春节', '02-02': '春节', '02-03': '春节', '02-04': '春节',
                '04-04': '清明', '04-05': '清明', '04-06': '清明',
                '05-01': '劳动节', '05-02': '劳动节', '05-03': '劳动节',
                '05-04': '劳动节', '05-05': '劳动节',
                '05-29': '端午', '05-30': '端午', '05-31': '端午',
                '10-01': '国庆', '10-02': '国庆', '10-03': '国庆',
                '10-04': '国庆', '10-05': '国庆', '10-06': '国庆', '10-07': '国庆',
                '10-06': '中秋', '10-07': '中秋', '10-08': '中秋'
            },
            2026: {
                '01-01': '元旦', '01-02': '元旦', '01-03': '元旦',
                '02-17': '春节', '02-18': '春节', '02-19': '春节',
                '02-20': '春节', '02-21': '春节', '02-22': '春节', '02-23': '春节',
                '04-04': '清明', '04-05': '清明', '04-06': '清明',
                '05-01': '劳动节', '05-02': '劳动节', '05-03': '劳动节',
                '05-04': '劳动节', '05-05': '劳动节',
                '06-17': '端午', '06-18': '端午', '06-19': '端午',
                '09-25': '中秋', '09-26': '中秋', '09-27': '中秋',
                '10-01': '国庆', '10-02': '国庆', '10-03': '国庆',
                '10-04': '国庆', '10-05': '国庆', '10-06': '国庆', '10-07': '国庆'
            },
            2027: {
                '01-01': '元旦', '01-02': '元旦', '01-03': '元旦',
                '02-06': '春节', '02-07': '春节', '02-08': '春节',
                '02-09': '春节', '02-10': '春节', '02-11': '春节', '02-12': '春节',
                '04-04': '清明', '04-05': '清明', '04-06': '清明',
                '05-01': '劳动节', '05-02': '劳动节', '05-03': '劳动节',
                '05-04': '劳动节', '05-05': '劳动节',
                '06-07': '端午', '06-08': '端午', '06-09': '端午',
                '09-15': '中秋', '09-16': '中秋', '09-17': '中秋',
                '10-01': '国庆', '10-02': '国庆', '10-03': '国庆',
                '10-04': '国庆', '10-05': '国庆', '10-06': '国庆', '10-07': '国庆'
            }
        };
        
        const yearHolidays = allHolidays[year];
        if (!yearHolidays) return holidays;
        
        const monthStr = String(month + 1).padStart(2, '0');
        for (const [date, name] of Object.entries(yearHolidays)) {
            if (date.startsWith(monthStr)) {
                const day = parseInt(date.split('-')[1]);
                holidays[day] = name;
            }
        }
        
        return holidays;
    }
    
    getSolarTerms(year, month) {
        const terms = {};
        const solarTerms = {
            2025: {
                '01-05': '小寒', '01-20': '大寒',
                '02-03': '立春', '02-18': '雨水',
                '03-05': '惊蛰', '03-20': '春分',
                '04-04': '清明', '04-20': '谷雨',
                '05-05': '立夏', '05-21': '小满',
                '06-05': '芒种', '06-21': '夏至',
                '07-07': '小暑', '07-23': '大暑',
                '08-07': '立秋', '08-23': '处暑',
                '09-07': '白露', '09-23': '秋分',
                '10-08': '寒露', '10-23': '霜降',
                '11-07': '立冬', '11-22': '小雪',
                '12-07': '大雪', '12-21': '冬至'
            },
            2026: {
                '01-05': '小寒', '01-20': '大寒',
                '02-04': '立春', '02-19': '雨水',
                '03-05': '惊蛰', '03-20': '春分',
                '04-04': '清明', '04-20': '谷雨',
                '05-05': '立夏', '05-21': '小满',
                '06-06': '芒种', '06-21': '夏至',
                '07-07': '小暑', '07-23': '大暑',
                '08-07': '立秋', '08-23': '处暑',
                '09-08': '白露', '09-23': '秋分',
                '10-08': '寒露', '10-24': '霜降',
                '11-07': '立冬', '11-22': '小雪',
                '12-07': '大雪', '12-22': '冬至'
            },
            2027: {
                '01-05': '小寒', '01-20': '大寒',
                '02-04': '立春', '02-19': '雨水',
                '03-06': '惊蛰', '03-21': '春分',
                '04-05': '清明', '04-20': '谷雨',
                '05-06': '立夏', '05-21': '小满',
                '06-06': '芒种', '06-21': '夏至',
                '07-08': '小暑', '07-23': '大暑',
                '08-08': '立秋', '08-23': '处暑',
                '09-08': '白露', '09-23': '秋分',
                '10-08': '寒露', '10-24': '霜降',
                '11-07': '立冬', '11-22': '小雪',
                '12-07': '大雪', '12-22': '冬至'
            }
        };
        
        const yearTerms = solarTerms[year];
        if (!yearTerms) return terms;
        
        const monthStr = String(month + 1).padStart(2, '0');
        for (const [date, name] of Object.entries(yearTerms)) {
            if (date.startsWith(monthStr)) {
                const day = parseInt(date.split('-')[1]);
                terms[day] = name;
            }
        }
        
        return terms;
    }
    
    lYearDays(y) {
        let sum = 348;
        for (let i = 0x8000; i > 0x8; i >>= 1) {
            sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
        }
        return sum + this.leapDays(y);
    }

    leapMonth(y) {
        return LUNAR_INFO[y - 1900] & 0xf;
    }

    leapDays(y) {
        if (this.leapMonth(y)) {
            return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29;
        }
        return 0;
    }

    monthDays(y, m) {
        return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29;
    }

    getLunarDate(year, month, day) {
        const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
        const LUNAR_DAYS = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
                          '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
                          '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
        
        const baseDate = new Date(1900, 0, 31);
        const objDate = new Date(year, month, day);
        let offset = Math.floor((objDate - baseDate) / 86400000);
        
        let lunarYear = 1900;
        let temp = 0;
        for (; lunarYear < 2100 && offset > 0; lunarYear++) {
            temp = this.lYearDays(lunarYear);
            offset -= temp;
        }
        if (offset < 0) {
            offset += temp;
            lunarYear--;
        }
        
        let leap = this.leapMonth(lunarYear);
        let isLeap = false;
        let lunarMonth = 1;
        
        for (; lunarMonth < 13 && offset > 0; lunarMonth++) {
            if (leap > 0 && lunarMonth === (leap + 1) && !isLeap) {
                --lunarMonth;
                isLeap = true;
                temp = this.leapDays(lunarYear);
            } else {
                temp = this.monthDays(lunarYear, lunarMonth);
            }
            if (isLeap && lunarMonth === (leap + 1)) isLeap = false;
            offset -= temp;
        }
        if (offset === 0 && leap > 0 && lunarMonth === leap + 1) {
            if (isLeap) {
                isLeap = false;
            } else {
                isLeap = true;
                --lunarMonth;
            }
        }
        if (offset < 0) {
            offset += temp;
            --lunarMonth;
        }
        
        let str = '';
        if (isLeap) {
            str += '闰';
        }
        str += LUNAR_MONTHS[lunarMonth - 1] + '月';
        str += LUNAR_DAYS[offset];
        return str;
    }

    getGanZhi(year) {
        const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
        const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
        const ganIndex = (year - 4) % 10;
        const zhiIndex = (year - 4) % 12;
        return GAN[ganIndex] + ZHI[zhiIndex];
    }

    getYearGanZhi(year, month, day) {
        const baseDate = new Date(1900, 0, 31);
        const objDate = new Date(year, month, day);
        let offset = Math.floor((objDate - baseDate) / 86400000);
        
        let lunarYear = 1900;
        for (; lunarYear < 2100 && offset > 0; lunarYear++) {
            offset -= this.lYearDays(lunarYear);
        }
        if (offset < 0) {
            lunarYear--;
        }
        return this.getGanZhi(lunarYear) + '年';
    }
    
    drawCalendar() {
        if (!this.calendarData) return;

        const year = this.calendarData.year;
        const month = this.calendarData.month;
        const today = this.calendarData.today;

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const W = this.canvas.width;
        const H = this.canvas.height;

        const paddingX = 24;
        const paddingY = 12;
        const headerHeight = 76;
        const weekdaysHeight = 30;
        const footerHeight = 36;
        const daysHeight = H - paddingY * 2 - headerHeight - weekdaysHeight - footerHeight;
        const cellWidth = Math.floor((W - paddingX * 2) / 7);
        const cellHeight = Math.floor(daysHeight / 6);

        const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
        const weekDaysFull = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
        const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月",
                            "七月", "八月", "九月", "十月", "十一月", "十二月"];
        const monthNumNames = ["01", "02", "03", "04", "05", "06",
                               "07", "08", "09", "10", "11", "12"];
        const holidays = this.getHolidays(year, month);
        const solarTerms = this.getSolarTerms(year, month);

        const COLORS = {
            BLACK:  "#000000",
            WHITE:  "#FFFFFF",
            RED:    "#E53935",
            YELLOW: "#FDD835",
            GREEN:  "#43A047",
            BLUE:   "#1E88E5",
            ORANGE: "#FB8C00"
        };

        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.fillRect(0, 0, W, H);
        this.ctx.textBaseline = "top";
        this.ctx.textAlign = "left";

        // ============================================================
        // 几何装饰元素 - 构成主义风格
        // ============================================================

        // 左上角：黑色大方块 + 红色小方块
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillRect(0, 0, 8, 36);
        this.ctx.fillRect(0, 0, 36, 8);
        this.ctx.fillStyle = COLORS.RED;
        this.ctx.fillRect(8, 8, 12, 4);
        this.ctx.fillRect(8, 8, 4, 12);

        // 右上角：蓝色竖条 + 黑色方块
        this.ctx.fillStyle = COLORS.BLUE;
        this.ctx.fillRect(W - 8, 0, 8, 36);
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillRect(W - 36, 0, 28, 8);
        this.ctx.fillStyle = COLORS.YELLOW;
        this.ctx.fillRect(W - 20, 8, 12, 4);

        // 左下角：绿色横条 + 黑色方块
        this.ctx.fillStyle = COLORS.GREEN;
        this.ctx.fillRect(0, H - 8, 36, 8);
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillRect(0, H - 36, 8, 28);
        this.ctx.fillStyle = COLORS.ORANGE;
        this.ctx.fillRect(8, H - 20, 4, 12);

        // 右下角：橙色方块 + 黑色装饰
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillRect(W - 36, H - 8, 36, 8);
        this.ctx.fillRect(W - 8, H - 36, 8, 28);
        this.ctx.fillStyle = COLORS.ORANGE;
        this.ctx.fillRect(W - 20, H - 20, 12, 12);

        // ============================================================
        // 顶部标题区 - 几何构成
        // ============================================================
        const headerBottomY = paddingY + headerHeight;

        // 左侧：月份数字 + 年份
        const monthNumStr = monthNumNames[month];
        this.ctx.font = "bold 48px 'SimHei', 'Microsoft YaHei', sans-serif";
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillText(monthNumStr, paddingX, paddingY);

        // 月份中文
        const monthCnStr = monthNames[month];
        this.ctx.font = "bold 18px 'SimHei', sans-serif";
        this.ctx.fillStyle = COLORS.BLACK;
        const monthCnWidth = this.ctx.measureText(monthCnStr).width;
        this.ctx.fillText(monthCnStr, paddingX + 68, paddingY + 10);

        // 年份
        const yearStr = `${year}`;
        this.ctx.font = "bold 14px 'SimHei', sans-serif";
        this.ctx.fillStyle = COLORS.RED;
        this.ctx.fillText(yearStr, paddingX + 68, paddingY + 36);

        // 红色竖线装饰
        this.ctx.fillStyle = COLORS.RED;
        this.ctx.fillRect(paddingX + 60, paddingY + 8, 3, 42);

        // 右侧：今日信息卡片 - 几何造型
        const isCurrentMonth = month === today.month && year === today.year;
        if (isCurrentMonth) {
            const cardWidth = 150;
            const cardHeight = 66;
            const cardX = W - paddingX - cardWidth;
            const cardY = paddingY + 2;

            // 卡片底色 - 黄色
            this.ctx.fillStyle = COLORS.YELLOW;
            this.ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

            // 黑色粗边框
            this.ctx.strokeStyle = COLORS.BLACK;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);

            // 左上角红色方块
            this.ctx.fillStyle = COLORS.RED;
            this.ctx.fillRect(cardX, cardY, 18, 18);

            // "今日"标签 - 白色在红块上
            this.ctx.font = "bold 12px 'SimHei', sans-serif";
            this.ctx.fillStyle = COLORS.WHITE;
            this.ctx.fillText("今", cardX + 4, cardY + 3);

            // 右上角蓝色小方块
            this.ctx.fillStyle = COLORS.BLUE;
            this.ctx.fillRect(cardX + cardWidth - 10, cardY, 10, 10);

            // 大号日期数字
            const dayNum = String(today.day);
            this.ctx.font = "bold 38px 'SimHei', sans-serif";
            this.ctx.fillStyle = COLORS.BLACK;
            const dayNumWidth = this.ctx.measureText(dayNum).width;
            this.ctx.fillText(dayNum, cardX + cardWidth - dayNumWidth - 12, cardY + 18);

            // 星期
            const todayWeek = weekDaysFull[today.dayOfWeek];
            this.ctx.font = "bold 12px 'SimHei', sans-serif";
            this.ctx.fillStyle = COLORS.BLACK;
            this.ctx.fillText(todayWeek, cardX + 10, cardY + 22);

            // 农历
            const todayLunar = this.getLunarDate(today.year, today.month, today.day);
            const lunarShort = todayLunar.replace(/^[正二三四五六七八九十冬腊]月/, '');
            this.ctx.font = "11px 'SimHei', sans-serif";
            this.ctx.fillStyle = COLORS.BLACK;
            const lunarWidth = this.ctx.measureText(lunarShort).width;
            this.ctx.fillText(lunarShort, cardX + cardWidth - lunarWidth - 12, cardY + 48);

            // 底部绿色装饰条
            this.ctx.fillStyle = COLORS.GREEN;
            this.ctx.fillRect(cardX, cardY + cardHeight - 3, cardWidth, 3);
        }

        // 标题区分隔线 - 粗黑线
        this.ctx.strokeStyle = COLORS.BLACK;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(paddingX, headerBottomY);
        this.ctx.lineTo(W - paddingX, headerBottomY);
        this.ctx.stroke();

        // 分隔线下的彩色小方块装饰
        this.ctx.fillStyle = COLORS.RED;
        this.ctx.fillRect(paddingX, headerBottomY + 4, 12, 4);
        this.ctx.fillStyle = COLORS.YELLOW;
        this.ctx.fillRect(paddingX + 14, headerBottomY + 4, 8, 4);
        this.ctx.fillStyle = COLORS.BLUE;
        this.ctx.fillRect(W - paddingX - 12, headerBottomY + 4, 12, 4);

        // ============================================================
        // 星期表头 - 几何色块
        // ============================================================
        const weekdaysY = headerBottomY + 14;

        // 表头黑色背景条
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillRect(paddingX, weekdaysY - 12, W - paddingX * 2, 26);

        // 分隔竖线
        this.ctx.fillStyle = COLORS.WHITE;
        for (let i = 1; i < 7; i++) {
            const x = paddingX + i * cellWidth;
            this.ctx.fillRect(x - 1, weekdaysY - 8, 2, 18);
        }

        for (let i = 0; i < 7; i++) {
            const x = paddingX + i * cellWidth;
            const isWeekend = i === 0 || i === 6;

            this.ctx.font = "bold 15px 'SimHei', sans-serif";
            this.ctx.fillStyle = isWeekend ? COLORS.YELLOW : COLORS.WHITE;

            const text = weekDays[i];
            const textWidth = this.ctx.measureText(text).width;
            this.ctx.fillText(text, x + (cellWidth - textWidth) / 2, weekdaysY - 6);
        }

        // ============================================================
        // 日历网格
        // ============================================================
        const gridStartY = headerBottomY + weekdaysHeight + 2;

        // 网格线 - 细黑线
        this.ctx.strokeStyle = COLORS.BLACK;
        this.ctx.lineWidth = 1;

        // 竖线
        for (let i = 0; i <= 7; i++) {
            const x = paddingX + i * cellWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(x, gridStartY);
            this.ctx.lineTo(x, gridStartY + cellHeight * 6);
            this.ctx.stroke();
        }

        // 横线
        for (let i = 0; i <= 6; i++) {
            const y = gridStartY + i * cellHeight;
            this.ctx.beginPath();
            this.ctx.moveTo(paddingX, y);
            this.ctx.lineTo(W - paddingX, y);
            this.ctx.stroke();
        }

        // 周末列背景 - 黄色实色块
        for (let i = 0; i < 6; i++) {
            const y = gridStartY + i * cellHeight;
            this.ctx.fillStyle = COLORS.YELLOW;
            // 周日列
            this.ctx.fillRect(paddingX + 1, y + 1, cellWidth - 2, cellHeight - 2);
            // 周六列
            this.ctx.fillRect(paddingX + cellWidth * 6 + 1, y + 1, cellWidth - 2, cellHeight - 2);
        }

        // 绘制日期
        let day = 1;
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if ((row === 0 && col < startDay) || day > daysInMonth) {
                    continue;
                }

                const x = paddingX + col * cellWidth;
                const y = gridStartY + row * cellHeight;
                const isToday = day === today.day && month === today.month && year === today.year;
                const isWeekend = col === 0 || col === 6;
                const lunarDate = this.getLunarDate(year, month, day);
                const holidayName = holidays[day];
                const termName = solarTerms[day];

                // 今日特殊样式 - 红色方块
                if (isToday) {
                    const pad = 4;
                    this.ctx.fillStyle = COLORS.RED;
                    this.ctx.fillRect(x + pad, y + pad, cellWidth - pad * 2, cellHeight - pad * 2);
                    // 黑色边框
                    this.ctx.strokeStyle = COLORS.BLACK;
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(x + pad, y + pad, cellWidth - pad * 2, cellHeight - pad * 2);
                }

                // 日期数字
                this.ctx.font = isToday ? "bold 28px 'SimHei', sans-serif" : "bold 24px 'SimHei', sans-serif";
                this.ctx.textBaseline = "alphabetic";

                let dayColor = COLORS.BLACK;
                if (isToday) {
                    dayColor = COLORS.WHITE;
                } else if (isWeekend) {
                    dayColor = COLORS.RED;
                }

                this.ctx.fillStyle = dayColor;
                const dayStr = String(day);
                const dayWidth = this.ctx.measureText(dayStr).width;
                const dayY = y + Math.floor(cellHeight * 0.42);
                this.ctx.fillText(dayStr, x + (cellWidth - dayWidth) / 2, dayY);

                // 底部文字：农历/节日/节气
                let bottomText = '';
                let bottomColor = null;
                let isHoliday = false;
                let isTerm = false;

                if (holidayName) {
                    bottomText = holidayName;
                    isHoliday = true;
                } else if (termName) {
                    bottomText = termName;
                    isTerm = true;
                } else {
                    bottomText = lunarDate.replace(/^[正二三四五六七八九十冬腊]月/, '');
                }

                this.ctx.font = isToday ? "bold 12px 'SimHei', sans-serif" : "11px 'SimHei', sans-serif";

                if (isToday) {
                    bottomColor = COLORS.WHITE;
                } else if (isHoliday) {
                    bottomColor = COLORS.RED;
                } else if (isTerm) {
                    bottomColor = COLORS.GREEN;
                } else if (isWeekend) {
                    bottomColor = COLORS.RED;
                } else {
                    bottomColor = COLORS.BLACK;
                }

                this.ctx.fillStyle = bottomColor;
                const bottomTextWidth = this.ctx.measureText(bottomText).width;
                const bottomY = y + cellHeight - 6;
                this.ctx.fillText(bottomText, x + (cellWidth - bottomTextWidth) / 2, bottomY);

                // 节日/节气标记 - 左上角小方块
                if (isHoliday && !isToday) {
                    this.ctx.fillStyle = COLORS.RED;
                    this.ctx.fillRect(x + 4, y + 4, 6, 6);
                } else if (isTerm && !isToday) {
                    this.ctx.fillStyle = COLORS.GREEN;
                    this.ctx.fillRect(x + 4, y + 4, 6, 6);
                }

                day++;
            }
        }

        // ============================================================
        // 底部信息区 - 几何条
        // ============================================================
        const footerTopY = gridStartY + cellHeight * 6;
        const footerY = footerTopY + 18;

        // 顶部黑色分隔条
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillRect(paddingX, footerTopY + 4, W - paddingX * 2, 2);

        // 左侧彩色方块 + 农历月份
        const lunarMonthFirst = this.getLunarDate(year, month, 1);
        const lunarMonthName = lunarMonthFirst.replace(/月.*$/, '月');
        const yearGanZhi = this.getGanZhi(year) + '年';

        // 橙色小方块
        this.ctx.fillStyle = COLORS.ORANGE;
        this.ctx.fillRect(paddingX, footerY, 3, 14);

        this.ctx.font = "bold 13px 'SimHei', sans-serif";
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillText("农历" + lunarMonthName, paddingX + 8, footerY);

        this.ctx.font = "11px 'SimHei', sans-serif";
        this.ctx.fillStyle = COLORS.RED;
        const lunarMonthWidth = this.ctx.measureText("农历" + lunarMonthName).width;
        this.ctx.fillText(yearGanZhi, paddingX + 8 + lunarMonthWidth + 8, footerY + 2);

        // 中间：节气列表
        const termList = Object.values(solarTerms);
        if (termList.length > 0) {
            this.ctx.font = "11px 'SimHei', sans-serif";
            this.ctx.fillStyle = COLORS.GREEN;
            const termText = termList.join(" · ");
            const termWidth = this.ctx.measureText(termText).width;
            const termX = (W - termWidth) / 2;
            // 绿色小方块前缀
            this.ctx.fillStyle = COLORS.GREEN;
            this.ctx.fillRect(termX - 8, footerY + 2, 3, 10);
            this.ctx.fillStyle = COLORS.GREEN;
            this.ctx.fillText(termText, termX, footerY + 2);
        }

        this.ctx.textBaseline = "alphabetic";
        this.ctx.textAlign = "left";
    }

    initWeatherPanel() {
        if (!this.weatherManager) {
            this.weatherManager = new WeatherManager(this);
        }
        this.weatherManager.initPanel();
    }

    drawWeather() {
        if (this.weatherManager && this.weatherManager.weatherData) {
            this.weatherManager.draw();
        }
    }

    // ==================== 清空元素 ====================
    clearElements() {
        this.textElements = [];
        this.lineSegments = [];
        this.scheduleData = null;
        this.todoData = null;
        this.cardData = null;
        this.wifiData = null;
        this.calendarData = null;
        this.weatherData = null;
    }
}