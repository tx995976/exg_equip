// ==UserScript==
// @name         深色模式可拖动菜单
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  深色主题的可拖动多标签菜单
// @author       YourName
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    //#region data
    const equipOrigin = []

    const equip_pair = new Map()
    const lock_map = new Map()

    const active_path = ['战斗装备/装备3','战斗装备/装备2']

    const data_load = () => {
        localStorage.getItem('equip_pair') ? equip_pair = JSON.parse(localStorage.getItem('equip_pair')) : false
        localStorage.getItem('lock_map') ? lock_map = JSON.parse(localStorage.getItem('lock_map')) : false
    }

    const data_save = () => {
        localStorage.setItem('equip_pair', JSON.stringify(equip_pair))
        localStorage.setItem('lock_map', JSON.stringify(lock_map))
    }

    data_load()
    //#endregion


    //#region hook
    // 保存原始的 WebSocket 构造函数
    const OriginalWebSocket = window.WebSocket;

    // 重写 WebSocket 构造函数
    window.WebSocket = function(url, protocols) {
        const ws = new OriginalWebSocket(url, protocols);

        // 监听 WebSocket 消息
        ws.addEventListener('message', function(event) {
            let d = JSON.parse(JSON.parse(event.data).Content);
            if (d.Path && active_path.includes(d.Path.join('/'))){
                console.log(d)
                step_msg(d.Path.join('/'),d.Content)
            }
            // console.log(JSON.parse(event.data));
            // console.log('WebSocket message received:', event.data);

        });

        // 监听 WebSocket 打开事件
        ws.addEventListener('open', function(event) {
            console.log('WebSocket connection opened:', url);
        });

        // 监听 WebSocket 关闭事件
        ws.addEventListener('close', function(event) {
            console.log('WebSocket connection closed:', event);
        });

        // 监听 WebSocket 错误事件
        ws.addEventListener('error', function(event) {
            console.log('WebSocket error:', event);
        });
        console.log("start hook ws")

        return ws;
    };
    //#endregion

    //#region menu

    // ======================
    // 1. 深色模式菜单结构
    // ======================
    const menuHTML = `
    <div id="float-tab-menu" style="position: fixed; top: 100px; left: 20px; z-index: 9999; cursor: move; min-width: 250px; color: #e0e0e0;">
        <!-- 标题栏 -->
        <div id="menu-header" style="background: #1a1a1a; padding: 12px; border-radius: 8px 8px 0 0;">
            🚀 装备小助手
        </div>

        <!-- 标签导航 -->
        <div id="menu-tabs" style="background: #2d2d2d; padding: 8px 12px 0; border-bottom: 1px solid #404040;">
            <button class="tab-btn active" data-tab="tab1">配装设置</button>
            <button class="tab-btn" data-tab="tab2">开发者</button>
        </div>

        <!-- 内容区域 -->
        <div id="menu-body" style="background: #262626; border: 1px solid #404040; border-top: none; border-radius: 0 0 8px 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            <!-- 标签1 -->
            <div id="tab1" class="tab-content active">
                <div class="tmenu-body" style="overflow-y: auto; max-height: 30vh;">
                存储配装
                    <button class="menu-item">🔍 元素检查</button>
                    <button class="menu-item">🌓 暗黑切换</button>
                    <button class="menu-item">📷 页面截图</button>
                    <button class="menu-item">📷 页面截图</button>
                    <button class="menu-item">📷 页面截图</button>
                    <button class="menu-item">📷 页面截图</button>
                    <button class="menu-item">📷 页面截图</button>
                    <button class="menu-item">📷 页面截图</button>
                    <button class="menu-item">📷 页面截图</button>
                </div>
                <button id="new-equip" class="menu-item" style="background: #4a9cff; display:inline-block; width:45%; margin-right:5%">新建配装</button> 
                <button id="save-equip" class="menu-item" style="display:inline-block; width:45%;">保存配装</button>
            </div>

            <!-- 标签2 -->
            <div id="tab2" class="tab-content">
                <button class="menu-item">⚙️ 控制台</button>
                <button class="menu-item">📊 性能监控</button>
                <button class="menu-item">🔧 调试工具</button>
            </div> 
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', menuHTML);

    // ======================
    // 2. 深色模式样式表
    // ======================
    const style = document.createElement('style');
    style.textContent = `
        /* 基础深色主题 */
        #float-tab-menu {
            font-family: 'Segoe UI', system-ui;
            font-size: 14px;
        }

        .tab-btn {
            padding: 8px 16px;
            border: none;
            background: none;
            cursor: pointer;
            color: #999;
            border-bottom: 2px solid transparent;
            transition: all 0.25s ease;
        }

        .tab-btn.active {
            color: #fff;
            border-bottom-color: #4a9cff;
        }

        .tab-btn:hover {
            color: #ccc;
        }

        .tab-content {
            display: none;
            padding: 12px;
        }

        .tab-content.active {
            display: block;
        }

        .menu-item {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            padding: 10px;
            margin: 6px 0;
            border: 1px solid #404040;
            background: #333;
            color: #e0e0e0;
            cursor: pointer;
            transition: all 0.2s ease;
            border-radius: 4px;
        }

        .menu-item:hover {
            background: #3a3a3a;
            border-color: #4a9cff;
        }
        .menu-item:active {
            background: #3a3a3a;
            border-color: #4a9cff;
            opacity: 0.8;
        }

        #close-menu:hover {
            color: #ff5555 !important;
        }

        /* 滚动条样式 */
        .tmenu-body::-webkit-scrollbar {
            width: 8px;
        }

        .tmenu-body::-webkit-scrollbar-track {
            background: #1f1f1f;
        }

        .tmenu-body::-webkit-scrollbar-thumb {
            background: #4a4a4a;
            border-radius: 4px;
        }

        .tequip-fit{

        }
    `;
    document.head.appendChild(style);
    

    // ======================
    // 3. 功能逻辑（保持原有拖动和交互逻辑）
    // ======================
    // 此处添加与之前相同的拖动、标签切换、关闭等功能代码
    // （具体实现参考前文提供的完整代码）

    // ======================
    // 2. 添加拖动功能
    // ======================
    const menu = document.getElementById('float-tab-menu');
    const header = document.getElementById('menu-header');
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    header.addEventListener('mousedown', startDrag);

    function startDrag(e) {
        if(e.target.id === 'close-menu') return;
        isDragging = true;
        
        // 计算初始偏移量
        const rect = menu.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
    }

    function drag(e) {
        if(!isDragging) return;
        
        // 计算新位置
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;

        // 边界限制
        const maxX = window.innerWidth - menu.offsetWidth;
        const maxY = window.innerHeight - menu.offsetHeight;
        newX = Math.min(Math.max(0, newX), maxX);
        newY = Math.min(Math.max(0, newY), maxY);

        // 应用位置
        menu.style.left = `${newX}px`;
        menu.style.top = `${newY}px`;
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
    }

    // ======================
    // 3. 窗口大小变化时自动修正位置
    // ======================
    window.addEventListener('resize', () => {
        const rect = menu.getBoundingClientRect();
        
        const newX = Math.min(
            Math.max(0, rect.left), 
            window.innerWidth - menu.offsetWidth
        );
        
        const newY = Math.min(
            Math.max(0, rect.top), 
            window.innerHeight - menu.offsetHeight
        );

        menu.style.left = `${newX}px`;
        menu.style.top = `${newY}px`;
    });


    // ======================
    // 3. 标签切换功能
    // ======================
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // 切换激活状态
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // 显示对应内容
            const tabId = this.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
        });
    });

    // ======================
    // 4. 功能按钮事件
    // ======================
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.textContent;
            alert(`执行操作: ${action}`);
            // 根据按钮内容添加具体功能
        });
    });

    document.getElementById('new-equip').addEventListener('click', () => {
        
    })

    document.getElementById('save-equip').addEventListener('click', () => {
        
    })

    //render

    const equip_render = () => {


    }

    const origin_equip_fit = () => {

    }



    //#endregion

    //#region action
    const step_msg = (path,content) => {
        let ej = JSON.parse(content.Items[0].Cmd[1])
        console.log(ej)
    }


    const paser_equip = (content) => {

    }


    const selectequip = (id) => {
        let e = document.querySelector(`.p-1.itemView[title="${id}"]:not(.border)`)
        
        console.log(e)
        if (e && e.style.opacity == 1) {
            e.click()
            console.log("select")
        }
        else{
            console.log("no select")
        }

    }



    //#endregion
})();