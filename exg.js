// ==UserScript==
// @name         exg 装备助手
// @namespace    http://tampermonkey.net/
// @version      0.2.0
// @description  exg 装备助手
// @author       tx995976
// @match        *://list.darkrp.cn*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    //#region data
    const active_path = ['战斗装备/装备锁定','战斗装备/装备3', '战斗装备/装备分解', '战斗装备/装备升级', '战斗装备/装备重铸', '战斗装备/装备附魔']
    
    let equip_define = []

    /**
     * @type {Map<String,Array>}
     */
    let equip_pair = new Map()

    /**
     * @type {Map<String,Array>}
     */
    let lock_map = new Map()

    let active_equip_pair = ['0', '0', '0', '0', '0']

    const data_load = () => {
        localStorage.getItem('equip_pair') ? equip_pair = new Map(JSON.parse(localStorage.getItem('equip_pair'))) : false
        localStorage.getItem('lock_map') ? lock_map = new Map(JSON.parse(localStorage.getItem('lock_map'))) : false
    }

    const data_save = () => {
        const equip_pair_str = JSON.stringify(Array.from(equip_pair))
        const lock_map_str = JSON.stringify(Array.from(lock_map))

        localStorage.setItem('equip_pair', equip_pair_str)
        localStorage.setItem('lock_map', lock_map_str)
    }

    data_load()
    //#endregion

    //#region hook
    // 保存原始的 WebSocket 构造函数
    const OriginalWebSocket = window.WebSocket;

    // 重写 WebSocket 构造函数
    window.WebSocket = function (url, protocols) {
        const ws = new OriginalWebSocket(url, protocols);

        // 监听 WebSocket 消息
        ws.addEventListener('message', function (event) {
            queueMicrotask(() => {
                let d = JSON.parse(JSON.parse(event.data).Content);
                if (d.Path && active_path.includes(d.Path.join('/'))) {
                    console.log(d)
                    step_msg(d.Path.join('/'), d.Content)
                    menu.style.display = 'block'
                }
                else {
                    menu.style.display = 'none'
                }
                // console.log(JSON.parse(event.data));
                // console.log('WebSocket message received:', event.data);
            })

        });

        // 监听 WebSocket 打开事件
        ws.addEventListener('open', function (event) {
            console.log('WebSocket connection opened:', url);
        });

        // 监听 WebSocket 关闭事件
        ws.addEventListener('close', function (event) {
            console.log('WebSocket connection closed:', event);
        });

        // 监听 WebSocket 错误事件
        ws.addEventListener('error', function (event) {
            console.log('WebSocket error:', event);
        });
        console.log("start hook ws")

        return ws;
    };

    //hook eval
    const Origineval = window.eval
    let evalHook = (c) => { }

    window.eval = function (code) {
        Origineval(code)
        if (evalHook)
            evalHook(code)
    }
    //#endregion

    //#region menu

    // ======================
    // 1. 深色模式菜单结构
    // ======================
    const menuHTML = `
    <div id="float-tab-menu" style="position: fixed; top: 100px; left: 20px; z-index: 9999; cursor: move; min-width: 250px; color: #e0e0e0; display : none">
        <!-- 标题栏 -->
        <div id="menu-header" style="background: #1a1a1a; padding: 12px; border-radius: 8px 8px 0 0;">
            装备小助手
        </div>

        <!-- 标签导航 -->
        <div id="menu-tabs" style="background: #2d2d2d; padding: 8px 12px 0; border-bottom: 1px solid #404040;">
            <button class="tab-btn active" data-tab="tab1">人类配装设置</button>
            <button class="tab-btn" data-tab="tab2">其他</button>
        </div>

        <!-- 内容区域 -->
        <div id="menu-body" style="background: #262626; border: 1px solid #404040; border-top: none; border-radius: 0 0 8px 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            <!-- 标签1 -->
            <div id="tab1" class="tab-content active">
                <div id="equip-pair-list" class="tmenu-body" style="overflow-y: auto; max-height: 30vh;">
                存储配装
                    
                </div>
                <button id="save-equip" class="menu-item" style="background: #4a9cff;">保存配装</button> 
                
            </div>

            <!-- 标签2 -->
            <div id="tab2" class="tab-content">
                <button id="equip-sort" class="menu-item">优化列表   ❎</button>
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

        .tequip-used{
            color:rgb(69, 224, 64);
            display: inline-block;
            font-size: 14px;
        }

        .tequip-inpair{
            color:rgb(40, 38, 38);
            display: inline-block;
            font-size: 14px;
        }
    `;
    document.head.appendChild(style);


    // 2. 添加拖动功能

    const menu = document.getElementById('float-tab-menu');
    const header = document.getElementById('menu-header');
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    header.addEventListener('mousedown', startDrag);

    function startDrag(e) {
        if (e.target.id === 'close-menu') return;
        isDragging = true;

        // 计算初始偏移量
        const rect = menu.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
    }

    function drag(e) {
        if (!isDragging) return;

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


    //button bind 
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            // 切换激活状态
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // 显示对应内容
            const tabId = this.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
        });
    });


    let bu_save_equip = document.getElementById('save-equip')
    bu_save_equip.addEventListener('click', () => {
        save_equip()
    })

    let bu_equip_sort = document.getElementById('equip-sort')
    let flag_sort = false
    bu_equip_sort.addEventListener('click', () => {
        flag_sort = !flag_sort
        bu_equip_sort.textContent = flag_sort ? '优化列表   ✅' : '优化列表   ❎'
    })

    //#endregion


    //#region render

    let first_render = true
    let rendered_equip = new Set()

    const new_equipbu = (n) => {
        let bu = document.createElement('button')
        bu.classList.add('menu-item')
        bu.textContent = n
        bu.addEventListener('click', () => {
            apply_equip_pair(n)
        })
        return bu
    }

    const menu_equip_render = () => {
        let c = document.getElementById('equip-pair-list')

        if (first_render) {
            first_render = false
            for (let [n, p] of equip_pair) {
                let bu = new_equipbu(n)
                c.appendChild(bu)
                rendered_equip.add(n)
            }
        }
        else {
            for (let [n, p] of equip_pair) {
                if (!rendered_equip.has(n)) {
                    let bu = new_equipbu(n)
                    c.appendChild(bu)
                    rendered_equip.add(n)
                }
            }
        }
    }

    const addon_equip_render = () => {
        console.log('start addon')
        let itemc = Array.from(document.querySelectorAll('.p-1.itemView:not(.border)'))
        for (let i of itemc) {
            let n = i.firstElementChild
            let id = i.title
            if (active_equip_pair.includes(id)) {
                n.insertAdjacentHTML('afterend', '<div class="tequip-used">[装备中]</div>')
            }
            if (lock_map.has(id)) {
                let s = lock_map.get(id).join(',')
                n.insertAdjacentHTML('afterend', `<div class="tequip-inpair">[在配装 ${s} 中]</div>`)
            }
        }

    }

    const sort_equip = () => {
        let itemc = Array.from(document.querySelectorAll('.p-1.itemView:not(.border)'))
        let p = itemc[0].parentNode

        for (let i of itemc) 
            p.removeChild(i)

        let imap = itemc.map(n => {
            return {
                grade: ['红色','金色','紫色','蓝色'].indexOf(n.dataset['grade']),
                group: n.querySelector('.fs-5').textContent.slice(0,-2),
                slot: ['头盔','背心','枪套','背包','护膝'].indexOf(n.dataset['slot']),
                id : n.title,
                node : n
            }
        })

        imap.sort((a, b) => {
            if (a.grade != b.grade)
                return a.grade - b.grade
            if (a.group != b.group)
                return a.group < b.group ? -1 : 1
            if (a.slot != b.slot)
                return a.slot - b.slot
            return a.id < b.id ? -1 : 1
        })

        for (let i of imap) {
            p.appendChild(i.node)
        }

    }

    menu_equip_render()

    //#endregion

    //#region action
    const step_msg = (path, content) => {
        // let ej = JSON.parse(content.Items[0].Cmd[1])
        // console.log(ej)
        evalHook = (c) => {
            console.log('evalHook run')
            queueMicrotask(() => {
                flush_active_equip(path)
                addon_equip_render()
                if (flag_sort) 
                    sort_equip()
            })
            evalHook = () => { }
        }
    }

    const apply_equip_pair = (id) => {
        let p = equip_pair.get(id)
        for (let ind of p) {
            select_equip(ind)
        }
        console.log(`apply ${id}`)
    }

    const select_equip = (id) => {
        let e = document.querySelector(`.p-1.itemView[title="${id}"]:not(.border)`)
        console.log(e)
        if (e && e.style.opacity != '0.5') {
            e.click()
            console.log("select")
        }
        else {
            console.log("no select")
        }
    }

    let equip_flush_path = ['战斗装备/装备3']

    const flush_active_equip = (path) => {
        if(path && !equip_flush_path.includes(path))
            return

        const p = []
        for (let i = 1; i <= 5; i++) {
            let slot = document.querySelector(`div.my-1:nth-child(${i}) div.border`)
            if (slot) {
                p.push(slot.title)
            }
            else
                p.push('0')
        }
        active_equip_pair = p
        console.log(`get pair ${p}`)
    }

    const flush_lock_map = (pre, now) => {
        if (pre) {
            for (let id of pre.item) {
                let c = lock_map.get(id)
                //remove name
                c.splice(c.indexOf(pre.id), 1)
            }
        }
        if (now) {
            for (let id of now.item) {
                if (!lock_map.has(id)) {
                    lock_map.set(id, [])
                }
                let c = lock_map.get(id) 
                c.push(now.id)
            }
        }
        console.log('flush lock map')
    }

    const save_equip = () => {
        flush_active_equip()
        let name = prompt('name?')
        if (name && !equip_pair.has(name)) {
            console.log('add new pair')
            flush_lock_map(null, { id: name, item: active_equip_pair })
            equip_pair.set(name, active_equip_pair)
        }
        else if (name && equip_pair.has(name)) {
            console.log('name exist,modify')
            flush_lock_map({ id: name, item: equip_pair.get(name) }, { id: name, item: active_equip_pair })
            equip_pair.set(name, active_equip_pair)
        }
        else {
            alert('need name')
        }
        
        queueMicrotask(() => {
            data_save()
            menu_equip_render()
        })
    }


    //#endregion
})();