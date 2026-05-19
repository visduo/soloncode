/* ===== app-filer.js ===== */
/* 工作区文件树面板（右侧） */

(function() {
    var panel = document.getElementById('filerPanel');
    var toggleBtn = document.getElementById('filerToggleBtn');
    var treeEl = document.getElementById('filerTree');
    var worknameEl = document.getElementById('filerWorkname');

    // ---- Toggle 折叠 ----
    var mainHeader = document.querySelector('.main-header');

    function syncHeaderPadding(collapsed) {
        if (!mainHeader) return;
        if (collapsed) {
            mainHeader.classList.add('filer-collapsed');
        } else {
            mainHeader.classList.remove('filer-collapsed');
        }
    }

    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            panel.classList.toggle('collapsed');
            var collapsed = panel.classList.contains('collapsed');
            toggleBtn.classList.toggle('collapsed', collapsed);
            toggleBtn.innerHTML = collapsed ? '\u203A' : '\u2039';
            toggleBtn.title = collapsed ? '\u5C55\u5F00\u6587\u4EF6\u6811' : '\u6536\u7F29\u6587\u4EF6\u6811';
            localStorage.setItem('filer-collapsed', collapsed ? '1' : '0');
            syncHeaderPadding(collapsed);
        });
    }

    // 恢复持久化状态
    if (localStorage.getItem('filer-collapsed') === '1') {
        if (panel) panel.classList.add('collapsed');
        if (toggleBtn) {
            toggleBtn.classList.add('collapsed');
            toggleBtn.innerHTML = '\u203A';
            toggleBtn.title = '\u5C55\u5F00\u6587\u4EF6\u6811';
        }
        syncHeaderPadding(true);
    }

    // ---- 加载文件树 ----
    function loadTree() {
        fetch('/chat/filer/tree?depth=1')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                var data = (res && res.data) ? res.data : [];
                if (treeEl) renderTree(data, treeEl, 0);
            })
            .catch(function(e) { console.error('[filer] load error', e); });
    }

    // ---- 渲染树节点 ----
    function renderTree(nodes, container, indent) {
        container.innerHTML = '';
        nodes.forEach(function(node) {
            var nodeEl = document.createElement('div');
            nodeEl.className = 'filer-node';
            nodeEl.setAttribute('data-indent', indent);
            nodeEl.setAttribute('data-path', node.path);
            nodeEl.setAttribute('data-type', node.type);

            var row = document.createElement('div');
            row.className = 'filer-node-row';

            if (node.type === 'directory') {
                var arrow = document.createElement('span');
                arrow.className = 'filer-arrow' + (node.expanded ? ' open' : '');
                arrow.innerHTML = '<svg width="10" height="10" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                row.appendChild(arrow);

                var icon = document.createElement('span');
                icon.className = 'filer-node-icon filer-icon-folder';
                icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2.5h3.5L7 4h6.5A1.5 1.5 0 0115 5.5v6a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 11.5V4A1.5 1.5 0 012 2.5z" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>';
                row.appendChild(icon);
            } else {
                var spacer = document.createElement('span');
                spacer.className = 'filer-arrow';
                spacer.innerHTML = '&nbsp;';
                row.appendChild(spacer);

                var icon = document.createElement('span');
                icon.className = 'filer-node-icon filer-icon-file';
                icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 1.5h4.75L12.5 5.75V13.5a1 1 0 01-1 1H4a1 1 0 01-1-1V2.5a1 1 0 011-1z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M8.75 1.5v4.25H12.5" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>';
                row.appendChild(icon);
            }

            var name = document.createElement('span');
            name.className = 'filer-node-name';
            name.textContent = node.name;
            name.title = node.path;
            row.appendChild(name);

            nodeEl.appendChild(row);

            if (node.type === 'directory') {
                var childrenEl = document.createElement('div');
                childrenEl.className = 'filer-node-children' + (node.expanded ? ' open' : '');
                if (node.expanded && node.children) {
                    renderTree(node.children, childrenEl, indent + 1);
                }
                nodeEl.appendChild(childrenEl);
            }

            // 用定时器区分单击/双击，避免双击时触发展开/折叠
            var clickTimer = null;

            // 单击：目录展开/折叠（延迟执行，双击时取消）
            (function(n, ne) {
                row.addEventListener('click', function(e) {
                    if (n.type !== 'directory') return;
                    e.stopPropagation();
                    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
                    clickTimer = setTimeout(function() {
                        clickTimer = null;
                        var cEl = ne.querySelector(':scope > .filer-node-children');
                        var aEl = row.querySelector('.filer-arrow');
                        if (!cEl) return;

                        var isOpen = cEl.classList.contains('open');
                        if (isOpen) {
                            cEl.classList.remove('open');
                            if (aEl) aEl.classList.remove('open');
                        } else {
                            cEl.classList.add('open');
                            if (aEl) aEl.classList.add('open');
                            if (!cEl.hasChildNodes()) {
                                fetch('/chat/filer/tree?path=' + encodeURIComponent(n.path) + '&depth=1')
                                    .then(function(r) { return r.json(); })
                                    .then(function(res) {
                                        var subData = (res && res.data) ? res.data : [];
                                        renderTree(subData, cEl, indent + 1);
                                    });
                            }
                        }
                    }, 250);
                });
            })(node, nodeEl);

            // 双击：插入 path 到输入框（取消单击回调）
            (function(n) {
                row.addEventListener('dblclick', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    // 取消挂起的单击事件
                    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }

                    var targetInput = (typeof inChatMode !== 'undefined' && inChatMode) ? chatInput : welcomeInput;
                    if (!targetInput) return;
                    var currentVal = targetInput.value || '';
                    var insertText = '[' + n.path + ']';
                    var cursorPos = targetInput.selectionStart || currentVal.length;
                    var before = currentVal.substring(0, cursorPos);
                    var after = currentVal.substring(cursorPos);
                    var prefix = (before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n')) ? ' ' : '';
                    targetInput.value = before + prefix + insertText + ' ' + after;
                    targetInput.focus();
                    var newPos = cursorPos + prefix.length + insertText.length + 1;
                    targetInput.setSelectionRange(newPos, newPos);
                    if (typeof autoResize === 'function') autoResize(targetInput);
                });
            })(node);

            container.appendChild(nodeEl);
        });
    }

    // ---- 文件变更实时同步 ----
    function onFilerChange(chunk) {
        if (!chunk || !chunk.changes || chunk.changes.length === 0) return;
        var changes = chunk.changes;
        var affectedDirs = {};
        changes.forEach(function(path) {
            var lastSlash = path.lastIndexOf('/');
            var parentDir = lastSlash > 0 ? path.substring(0, lastSlash) : '';
            affectedDirs[parentDir] = true;
        });
        Object.keys(affectedDirs).forEach(function(dirPath) {
            refreshDirectory(dirPath);
        });
        showFilerChangeIndicator();
    }

    function refreshDirectory(dirPath) {
        // 空路径表示根目录变化，根目录没有 .filer-node 容器，直接重新加载整棵树
        if (!dirPath) {
            loadTree();
            return;
        }
        var selector = '.filer-node[data-path="' + CSS.escape(dirPath) + '"]';
        var nodeEl = treeEl ? treeEl.querySelector(selector) : null;
        if (!nodeEl) return;
        var childrenEl = nodeEl.querySelector(':scope > .filer-node-children');
        if (!childrenEl) return;
        var isExpanded = childrenEl.classList.contains('open');
        if (!isExpanded) return;
        var indent = parseInt(nodeEl.getAttribute('data-indent') || '0', 10);
        fetch('/chat/filer/tree?path=' + encodeURIComponent(dirPath) + '&depth=1')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                var subData = (res && res.data) ? res.data : [];
                renderTree(subData, childrenEl, indent + 1);
            })
            .catch(function(e) { console.error('[filer] refresh error', dirPath, e); });
    }

    function showFilerChangeIndicator() {
        var header = document.querySelector('.filer-panel-header');
        if (!header) return;
        var dot = header.querySelector('.filer-change-dot');
        if (!dot) {
            dot = document.createElement('span');
            dot.className = 'filer-change-dot';
            header.appendChild(dot);
        }
        dot.classList.add('active');
        setTimeout(function() { dot.classList.remove('active'); }, 2000);
    }

    // ---- 暴露全局函数 ----
    window.loadTree = loadTree;
    window.onFilerChange = onFilerChange;

    // ---- 启动 ----
    loadTree();
})();
