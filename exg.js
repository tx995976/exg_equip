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
    const active_path = ['战斗装备/装备锁定', '战斗装备/装备3', '战斗装备/装备分解', '战斗装备/装备升级', '战斗装备/装备重铸', '战斗装备/装备附魔']

    /**
     * @type {Map<String,Array>}
     */
    let equip_pair = new Map()

    /**
     * @type {Map<String,Array>}
     */
    let lock_map = new Map()

    let settingdata = {}
    let setting_handler = {
        get(tar, prop) {
            if (tar[prop] === undefined)
                tar[prop] = false
            return tar[prop]
        },
        set(tar, prop, value) {
            tar[prop] = value
            setting_save()
            console.log(`set config`, tar)
            return true
        }
    }

    let setting = {}

    let active_equip_pair = ['0', '0', '0', '0', '0']
    let active_equip_pair_zm = ['0', '0', '0', '0', '0']

    let current_path = ''
    let current_item_list = []

    let para_lock_item_style_list = ['display']
    let para_lock_item_style = true


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

    const setting_load = () => {
        localStorage.getItem('exg_addon_setting') ? settingdata = JSON.parse(localStorage.getItem('exg_addon_setting')) : false
        setting = new Proxy(settingdata, setting_handler)
    }

    const setting_save = () => {
        const setting_str = JSON.stringify(settingdata)
        localStorage.setItem('exg_addon_setting', setting_str)
    }

    data_load()
    setting_load()
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
            <button class="tab-btn" data-tab="tab1">人类配装设置</button>
            <button class="tab-btn active" data-tab="tab2">其他</button>
            <button class="tab-btn" data-tab="tab3">筛选</button>
        </div>

        <!-- 内容区域 -->
        <div id="menu-body" style="background: #262626; border: 1px solid #404040; border-top: none; border-radius: 0 0 8px 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            <!-- 标签1 -->
            <div id="tab1" class="tab-content">
                <div id="equip-pair-list" class="tmenu-body" style="overflow-y: auto; max-height: 30vh;">
                存储配装
                    
                </div>
                <button id="save-equip" class="menu-item" style="background: #4a9cff;">保存配装</button> 
                
            </div>

            <!-- 标签2 -->
            <div id="tab2" class="tab-content active">
                <label class="menu-switch">
                    <input id="equip-sort" type="checkbox" class="menu-switch-input">
                    <span class="menu-switch-slider"></span>
                    <span class="menu-switch-text">优化列表</span>
                </label>
                <br>
                <label class="menu-switch">
                    <input id="equip-auto-confirm" type="checkbox" class="menu-switch-input">
                    <span class="menu-switch-slider"></span>
                    <span class="menu-switch-text">自动装备</span>
                </label>

            </div> 

            <div id="tab3" class="tab-content">

                <label class="menu-label">表达式</label>
                <input id="re-equip" type="text"class="menu-input" placeholder="{名字}<附魔>[属性](位置)">

                <div class="form-group">
                    <label class="menu-label">品质</label>
                    <select id="lv-equip" class="menu-select">
                        <option value="*">*</option>
                        <option value="蓝色">蓝色</option>
                        <option value="紫色">紫色</option>
                        <option value="金色">金色</option>
                    </select>
                </div>

                <label class="menu-switch">
                    <input id="auto-select-equip" type="checkbox" class="menu-switch-input">
                    <span class="menu-switch-slider"></span>
                    <span class="menu-switch-text">选择装备</span>
                </label>

                <button id="filter-equip" class="menu-item" style="background: #4a9cff; display:inline-block; width:45%; margin-right:5%">筛选</button>
                <button id="filter-reset-equip" class="menu-item" style="display:inline-block; width:45%;">清除筛选</button>


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

        .form-group {
            margin: 12px 0;
        }

        .menu-label {
            display: block;
            color: #9e9e9e;
            font-size: 0.9em;
            margin-bottom: 6px;
        }

        .menu-input {
            width: 100%;
            padding: 8px 12px;
            background: #333;
            border: 1px solid #404040;
            border-radius: 4px;
            color: #e0e0e0;
            font-size: 14px;
            transition: all 0.25s ease;
        }

        .menu-input:focus {
            outline: none;
            border-color: #4a9cff;
            box-shadow: 0 0 0 2px rgba(74, 156, 255, 0.2);
        }

        .menu-select {
            width: 100%;
            padding: 8px 32px 8px 12px;
            background: #333 url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999999'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e") no-repeat right 10px center;
            background-size: 12px;
            border: 1px solid #404040;
            border-radius: 4px;
            color: #e0e0e0;
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            cursor: pointer;
        }

        .menu-select:hover {
            border-color: #666;
        }

        .menu-select:focus {
            border-color: #4a9cff;
            box-shadow: 0 0 0 2px rgba(74, 156, 255, 0.2);
        }

        /* 滑动条样式 */
        .menu-range {
            width: 100%;
            height: 4px;
            background: #333;
            border-radius: 2px;
            outline: none;
            -webkit-appearance: none;
        }

        .menu-range::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 16px;
            height: 16px;
            background: #4a9cff;
            border-radius: 50%;
            cursor: pointer;
            transition: background 0.2s;
        }

        .menu-range::-moz-range-thumb {
            width: 16px;
            height: 16px;
            background: #4a9cff;
            border-radius: 50%;
            cursor: pointer;
        }

        /* 禁用默认聚焦轮廓 */
        *:focus {
            outline: none;
        }

         .menu-switch {
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
        }

        /* 隐藏原生复选框 */
        .menu-switch-input {
            position: absolute;
            opacity: 0;
            width: 0;
            height: 0;
        }

        /* 滑动轨道 */
        .menu-switch-slider {
            position: relative;
            width: 48px;
            height: 24px;
            background-color: #404040;
            border-radius: 12px;
            transition: all 0.3s ease;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
        }

        /* 滑动按钮 */
        .menu-switch-slider::before {
            content: "";
            position: absolute;
            left: 2px;
            top: 2px;
            width: 20px;
            height: 20px;
            background-color: #666;
            border-radius: 50%;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        /* 激活状态 */
        .menu-switch-input:checked + .menu-switch-slider {
            background-color: #4a9cff50;
        }

        .menu-switch-input:checked + .menu-switch-slider::before {
            transform: translateX(24px);
            background-color: #4a9cff;
        }

        /* 状态文字 */
        .menu-switch-text {
            color: #9e9e9e;
            font-size: 0.9em;
            transition: color 0.3s ease;
            width: 50%; 
            margin-right: 5%;
        }

        .menu-switch-input:checked ~ .menu-switch-text {
            color: #4a9cff;
        }

        /* 悬停效果 */
        .menu-switch:hover .menu-switch-slider {
            background-color: #4a4a4a;
        }

        .menu-switch:hover .menu-switch-input:checked + .menu-switch-slider {
            background-color: #4a9cff60;
        }

        /* 禁用状态 */
        .menu-switch.disabled {
            opacity: 0.6;
            cursor: not-allowed;
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
    bu_equip_sort.checked = setting.flag_sort
    bu_equip_sort.addEventListener('change', () => {
        setting.flag_sort = bu_equip_sort.checked
    })

    let bu_equip_auto_confirm = document.getElementById('equip-auto-confirm')
    bu_equip_auto_confirm.checked = setting.flag_auto_confirm
    bu_equip_auto_confirm.addEventListener('change', () => {
        setting.flag_auto_confirm = bu_equip_auto_confirm.checked
    })

    let input_re_equip = document.getElementById('re-equip')
    let input_lv_equip = document.getElementById('lv-equip')


    let bu_equip_filter = document.getElementById('filter-equip')
    bu_equip_filter.addEventListener('click', () => {
        filter_equip({ re: input_re_equip.value, lv: input_lv_equip.value })
    })

    let bu_equip_reset_filter = document.getElementById('filter-reset-equip')
    bu_equip_reset_filter.addEventListener('click', () => {
        reset_filter_act()
    })

    let input_auto_select_equip = document.getElementById('auto-select-equip')
    input_auto_select_equip.checked = setting.flag_auto_select
    input_auto_select_equip.addEventListener('change', () => {
        setting.flag_auto_select = input_auto_select_equip.checked
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
        const itemc = current_item_list
        let p = itemc[0].node.parentNode

        for (let i of itemc)
            p.removeChild(i.node)

        itemc.sort((a, b) => {
            if (a.grade != b.grade)
                return a.grade - b.grade
            if (a.group != b.group)
                return a.group < b.group ? -1 : 1
            if (a.slot != b.slot)
                return a.slot - b.slot
            return a.id < b.id ? -1 : 1
        })

        for (let i of itemc) {
            p.appendChild(i.node)
        }

    }

    let reset_menu = () => { }
    const menu_option = () => {
        reset_menu()
        reset_menu = () => { console.log('no reset') }
        menu.style.display = 'block'
        switch (current_path) {
            default:
                break
        }

    }

    menu_equip_render()

    //#endregion

    //#region action
    const step_msg = (path, content) => {
        current_path = path
        // let ej = JSON.parse(content.Items[0].Cmd[1])
        // console.log(ej)
        evalHook = (c) => {
            console.log('evalHook run')
            queueMicrotask(() => {
                // para_lock_item_style = false

                menu_option()
                flush_active_equip()
                flush_item_list()

                addon_equip_render()
                if (setting.flag_sort)
                    sort_equip()

                // para_lock_item_style = true
            })
            evalHook = () => { }
        }

    }

    const apply_equip_pair = (id) => {
        let p = equip_pair.get(id)
        for (let ind of p) {
            select_equip(ind)
        }
        if (setting.flag_auto_confirm) {
            let cbu = document.querySelector('.bg-primary-subtle')
            if (cbu.textContent = '修改装备')
                cbu.click()
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

    class strnmap {
        constructor() {
            this.nmap = new Map()
        }

        /**
         * @param {String} str 
         * @returns {Number}
         */
        map(str) {
            if (this.nmap.has(str))
                return this.nmap.get(str)
            else {
                this.nmap.set(str, this.nmap.size)
                return this.nmap.get(str)
            }
        }

        /**
         * @param {String} str 
         * @returns {Array<Number>}
         */
        search(str) {
            const res = []
            for (let i of this.nmap.keys()) {
                if (i.includes(str))
                    res.push(this.nmap.get(i))
            }
            return res
        }
    }

    /**
     * @type {strnmap}
     */
    const prop_map = new strnmap()

    /**
     * @type {strnmap}
     */
    const magic_map = new strnmap()

    const map_grade = (grade) => ['红色', '金色', '紫色', '蓝色', '*'].indexOf(grade)
    const map_slot = (slot) => ['头盔', '背心', '枪套', '背包', '护膝'].indexOf(slot)


    const flush_item_list = () => {
        let itemc = Array.from(document.querySelectorAll('.p-1.itemView:not(.border)'))

        current_item_list = itemc.map(n => {
            return {
                grade: map_grade(n.dataset['grade']),
                slot: map_slot(n.dataset['slot']),
                id: n.title,
                group: n.querySelector('.fs-5').textContent
                    // .replace(/^[^\u4e00-\u9fff]+/g, '')
                    .replace(/[^\u4e00-\u9fff]+$/g, '')
                    .slice(0, -2),
                prop: Array.from(n.querySelectorAll('.itemPropertySpan:not(.bg-black)'))
                    .map(x => {
                        return { k: prop_map.map(x.dataset['key']), v: x.dataset['value'] }
                    }),
                magic: Array.from(n.querySelectorAll('.itemPropertySpan.bg-black'))
                    .map(x => {
                        return { k: magic_map.map(x.dataset['key']), v: x.dataset['value'] }
                    }),
                node: n
            }
        })

        console.log(current_item_list)
        console.log(prop_map)
        console.log(magic_map)
        
        //protect style
        for (let i of itemc) {
            let ostyle = i.style
            let ofstyle = ostyle.setProperty.bind(ostyle)

            ostyle.setProperty = (name, value) => {
                console.log(`item style set ${name} ${value}`)
                if (para_lock_item_style_list.includes(name) && para_lock_item_style)
                    return
                ofstyle(name, value)
            }

            for (let p of para_lock_item_style_list){
                Object.defineProperty(ostyle,p,{
                    set(value){
                        console.log(`item style set ${p} ${value}`)
                        if (para_lock_item_style_list.includes(p) && para_lock_item_style)
                            return
                        ofstyle(p,value)
                    }
                })

            }
        }

    }


    const flush_active_equip = () => {
        if (current_path && !['战斗装备/装备3', '战斗装备/装备4'].includes(current_path))
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
                if (c.length == 0)
                    lock_map.delete(id)
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

    /**
     * 
     * @param {String} str 
     * @returns {Array<String>}
     */
    const split_filter_group = (str) => {
        const structures = [];
        let currentPart = '';
        let inbracket = false;
        let bracketType = null;
        const bracketPairs = { '{': '}', '(': ')', '[': ']', '<': '>' };

        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (!inbracket && (char === '{' || char === '(' || char === '[' || char === '<')) {
                inbracket = true;
                bracketType = char;
                currentPart += char;
            } else if (inbracket) {
                currentPart += char;
                if (char === bracketPairs[bracketType]) {
                    inbracket = false;
                }
            } else if (char === ',') {
                structures.push(currentPart.trim());
                currentPart = '';
            } else {
                currentPart += char;
            }
        }

        if (currentPart.trim()) structures.push(currentPart.trim());
        return structures.filter(part => part.length > 0);
    }

    /**
     * 
     * @param {String} part 
     */
    const parse_filter_unit = (part) => {
        const result = { group: [], solt: [], prop: [], magic: [] };
        const regex = /\{([^}]*)\}|\(([^)]*)\)|\[([^\]]*)\]|<([^>]*)>/g;

        let match;
        while ((match = regex.exec(part)) !== null) {
            if (match[1]) {
                result.group.push(...match[1].split(',').filter(Boolean));
            } else if (match[2]) {
                result.solt.push(...match[2].trim().split(',').filter(Boolean).map(x => map_slot(x)));
            } else if (match[3]) {
                result.prop.push(match[3].split(',').filter(Boolean).map(x => prop_map.search(x.toUpperCase())).flat());
            } else if (match[4]) {
                result.magic.push(...match[4].trim().split(',').filter(Boolean).map(x => magic_map.search(x)).flat());
            }
        }
        // console.log(result)
        return result;
    }

    let reset_filter_act = () => { }

    /**
     * @param {boolean} select 
     * @param {{re,lv}} rule
     */
    const filter_equip = (rule) => {
        reset_filter_act()

        let [re, lv] = [rule.re, map_grade(rule.lv)]
        console.log(rule)
        const filter = split_filter_group(re).map(x => parse_filter_unit(x));
        console.log(filter)

        let group_outer = []
        let group_tar = []

        /**
         * 
         * @param {Array<number>} a 
         * @param {Array<number>} b 
         * @returns Array<number>
         */
        let get_union = (a, b) => a.filter((v) => b.includes(v));

        // return

        //lv 
        for (let e of current_item_list) {
            if (lv != 4 && e.grade != lv)
                group_outer.push(e)
            else
                group_tar.push(e)
        }

        //g
        let g_tar = []
        for (let e of group_tar) {
            let flag_outer = false
            for (let f of filter) {
                if (f.group.length > 0 && !f.group.some(x => e.group.includes(x)))
                    flag_outer = true
            }
            if (flag_outer)
                group_outer.push(e)
            else
                g_tar.push(e)
        }
        group_tar = g_tar


        // s

        let s_tar = []
        for (let e of group_tar) {
            let flag_outer = false
            for (let f of filter) {
                if (f.solt.length > 0 && !f.solt.includes(e.solt))
                    flag_outer = true
            }
            if (flag_outer)
                group_outer.push(e)
            else
                s_tar.push(e)
        }
        group_tar = s_tar


        //m
        let m_tar = []
        for (let e of group_tar) {
            let flag_outer = false
            for (let f of filter) {
                if (f.magic.length > 0 && get_union(f.magic, e.magic.map(x => x.k)).length == 0)
                    flag_outer = true
            }
            if (flag_outer)
                group_outer.push(e)
            else
                m_tar.push(e)
        }
        group_tar = m_tar

        //prop
        let p_tar = []
        for (let e of group_tar) {
            let flag_outer = false
            for (let f of filter) {
                if (f.prop.length > 0 && !f.prop.every(c => get_union(c, e.prop.map(x => x.k)).length > 0))
                    flag_outer = true
            }
            if (flag_outer)
                group_outer.push(e)
            else
                p_tar.push(e)
        }
        group_tar = p_tar


        console.log(group_tar)
        console.log(group_outer)

        //

        if (setting.flag_auto_select)
            for (let e of group_tar)
                e.node.click()
        else {
            para_lock_item_style = false
            for (let e of group_outer)
                e.node.style.display = 'none'
            para_lock_item_style = true
            reset_filter_act = () => {
                para_lock_item_style = false
                for (let e of group_outer)
                    e.node.style.display = 'block'
                para_lock_item_style = true
                reset_filter_act = () => { }
            }
        }

    }

    //#endregion
})();