/**
 * app-settings.js — 设置面板交互逻辑（LLM 模型管理 + MCP 服务器管理）
 *
 * 依赖：app-base.js（fetchJSON 等工具函数）
 * 协同：app-history.js（modelsLoaded 全局变量，增删模型后需重置）
 */

(function () {
    'use strict';

    // ==================== DOM 引用 ====================
    var overlay = document.getElementById('settingsOverlay');
    var settingsBtn = document.getElementById('settingsBtn');

    // Tab
    var tabs = document.querySelectorAll('.settings-tab');
    var tabContents = document.querySelectorAll('.settings-tab-content');

    // LLM
    var llmAddBtn = document.getElementById('llmAddBtn');
    var llmAddForm = document.getElementById('llmAddForm');
    var llmCancelBtn = document.getElementById('llmCancelBtn');
    var llmSaveBtn = document.getElementById('llmSaveBtn');
    var llmModelList = document.getElementById('llmModelList');
    var llmTestBtn = document.getElementById('llmTestBtn');
    var llmCheckResult = document.getElementById('llmCheckResult');
    var llmExportBtn = document.getElementById('llmExportBtn');
    var llmImportBtn = document.getElementById('llmImportBtn');
    var llmImportDialog = document.getElementById('llmImportDialog');
    var llmImportCancelBtn = document.getElementById('llmImportCancelBtn');
    var llmImportConfirmBtn = document.getElementById('llmImportConfirmBtn');
    var llmApiKeyToggle = document.getElementById('llmApiKeyToggle');
    var llmListView = document.getElementById('llmListView');
    var llmFormView = document.getElementById('llmFormView');
    var llmFormTitle = document.getElementById('llmFormTitle');
    var mcpListView = document.getElementById('mcpListView');
    var mcpFormView = document.getElementById('mcpFormView');
    var mcpFormTitle = document.getElementById('mcpFormTitle');
    var webapiListView = document.getElementById('webapiListView');
    var webapiFormView = document.getElementById('webapiFormView');
    var webapiFormTitle = document.getElementById('webapiFormTitle');

    // LLM 编辑模式状态
    var llmEditModel = null;
    // LLM 缓存全量列表数据
    var llmCachedList = [];

    // MCP
    var mcpAddBtn = document.getElementById('mcpAddBtn');
    var mcpAddForm = document.getElementById('mcpAddForm');
    var mcpCancelBtn = document.getElementById('mcpCancelBtn');
    var mcpSaveBtn = document.getElementById('mcpSaveBtn');
    var mcpServerList = document.getElementById('mcpServerList');
    var mcpTypeBtns = document.querySelectorAll('.mcp-type-btn');

    // ==================== 视图切换 ====================
    function showLlmListView() {
        llmListView.style.display = '';
        llmFormView.style.display = 'none';
    }
    function showLlmFormView(title) {
        llmFormTitle.textContent = title || '添加模型';
        llmListView.style.display = 'none';
        llmFormView.style.display = '';
    }
    function showMcpListView() {
        mcpListView.style.display = '';
        mcpFormView.style.display = 'none';
    }
    function showMcpFormView(title) {
        mcpFormTitle.textContent = title || '添加服务器';
        mcpListView.style.display = 'none';
        mcpFormView.style.display = '';
    }
    function showWebapiListView() {
        webapiListView.style.display = '';
        webapiFormView.style.display = 'none';
    }
    function showWebapiFormView(title) {
        webapiFormTitle.textContent = title || '添加服务器';
        webapiListView.style.display = 'none';
        webapiFormView.style.display = '';
    }

    // ==================== 面板开关 ====================

    function openSettings() {
        overlay.style.display = 'flex';
        // 加载当前激活 Tab 的数据
        loadActiveTabData();
    }

    function closeSettings() {
        overlay.style.display = 'none';
        // 重置到列表视图
        showLlmListView();
        showMcpListView();
        showWebapiListView();
        if (llmCheckResult) llmCheckResult.style.display = 'none';
        // 重置技能搜索状态
        if (skillsSearchInput) skillsSearchInput.value = '';
        if (skillsSearchClear) skillsSearchClear.style.display = 'none';
    }

    settingsBtn.addEventListener('click', openSettings);

    // 遮罩点击关闭
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
            closeSettings();
        }
    });

    // ESC 键关闭
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.style.display !== 'none') {
            closeSettings();
        }
    });

    // ==================== Tab 切换 ====================

    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            tabs.forEach(function (t) { t.classList.remove('active'); });
            tabContents.forEach(function (c) { c.classList.remove('active'); });
            tab.classList.add('active');

            var targetTab = tab.getAttribute('data-tab');
            if (targetTab === 'llm') {
                document.getElementById('settingsTabLlm').classList.add('active');
                loadLlmList();
            } else if (targetTab === 'mcp') {
                document.getElementById('settingsTabMcp').classList.add('active');
                loadMcpList();
            }
        });
    });

    function loadActiveTabData() {
        var activeTab = document.querySelector('.settings-tab.active');
        if (activeTab) {
            var targetTab = activeTab.getAttribute('data-tab');
            if (targetTab === 'llm') {
                loadLlmList();
            } else if (targetTab === 'mcp') {
                loadMcpList();
            }
        }
    }

    // ==================== LLM 管理 ====================

    function loadLlmList() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/web/chat/models', true);
        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200 && resp.data) {
                        renderLlmList(resp.data.list || [], resp.data.selected || '');
                    }
                } catch (e) {
                    console.error('[Settings] Failed to parse models response:', e);
                }
            }
        };
        xhr.onerror = function () {
            console.error('[Settings] Failed to load models');
        };
        xhr.send();
    }

    function renderLlmList(list, selected) {
        llmCachedList = list || [];
        var html = '';
        if (!list || list.length === 0) {
            // 空状态引导 + 快捷模板
            html = '<div class="llm-empty-state">';
            html += '  <div class="llm-empty-icon">';
            html += '    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
            html += '  </div>';
            html += '  <div class="llm-empty-title">暂无大模型配置</div>';
            html += '  <div class="llm-empty-desc">添加至少一个大模型以开始 AI 对话</div>';
            html += '  <div class="llm-empty-templates">';
            html += '    <button class="llm-template-btn" data-api-url="https://api.openai.com/v1" data-provider="openai">OpenAI</button>';
            html += '    <button class="llm-template-btn" data-api-url="http://localhost:11434" data-provider="ollama">Ollama (本地)</button>';
            html += '    <button class="llm-template-btn" data-api-url="https://api.deepseek.com/v1" data-provider="deepseek">DeepSeek</button>';
            html += '  </div>';
            html += '</div>';
        } else {
            var providerIcons = {
                'openai': 'OAI', 'ollama': 'OLA', 'zhipu': 'ZP',
                'deepseek': 'DS', 'baidu-qianfan': 'BD',
                'ali-tongyi': 'ALI', 'moonshot': 'MS', 'minimax': 'MM'
            };

            list.forEach(function (item) {
                var modelName = item.model || '';
                var provider = item.provider || '';
                var name = item.name || '';
                var apiUrl = item.apiUrl || '';
                var isActive = (modelName === selected);

                var icon = providerIcons[provider] || modelName.substring(0, 2).toUpperCase();
                var apiUrlShort = apiUrl ? apiUrl.replace(/^https?:\/\//, '').split('/')[0] : '';

                html += '<div class="llm-model-item' + (isActive ? ' active' : '') + '" data-model="' + escapeAttr(modelName) + '">';
                html += '  <div class="llm-model-icon">' + escapeHtml(icon) + '</div>';
                html += '  <div class="llm-model-info">';
                html += '    <div class="llm-model-name">' + escapeHtml(modelName) + '</div>';
                html += '    <div class="llm-model-meta">';
                if (provider) {
                    html += '      <span class="llm-provider-tag">' + escapeHtml(provider) + '</span>';
                }
                if (name && name !== modelName) {
                    html += '      <span class="llm-alias-hint">' + escapeHtml(name) + '</span>';
                }
                if (apiUrlShort) {
                    html += '      <span class="llm-api-hint">' + escapeHtml(apiUrlShort) + '</span>';
                }
                html += '    </div>';
                html += '  </div>';
                html += '  <div class="llm-model-actions">';
                if (isActive) {
                    html += '    <span class="llm-active-badge">活跃</span>';
                }
                if (!isActive) {
                    html += '    <button class="llm-action-btn set-default" data-model="' + escapeAttr(modelName) + '" title="设为默认">';
                    html += '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
                    html += '    </button>';
                }
                html += '    <button class="llm-action-btn copy" data-model="' + escapeAttr(modelName) + '" title="复制">';
                html += '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
                html += '    </button>';
                html += '    <button class="llm-action-btn edit" data-model="' + escapeAttr(modelName) + '" title="编辑">';
                html += '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
                html += '    </button>';
                if (!isActive) {
                    html += '    <button class="llm-action-btn delete" data-model="' + escapeAttr(modelName) + '" title="删除">';
                    html += '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
                    html += '    </button>';
                }
                html += '  </div>';
                html += '</div>';
            });
        }
        llmModelList.innerHTML = html;

        // 绑定空状态模板按钮
        var templateBtns = llmModelList.querySelectorAll('.llm-template-btn');
        templateBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                resetLlmForm();
                showLlmFormView('添加模型');
                document.getElementById('llmApiUrl').value = btn.getAttribute('data-api-url');
                document.getElementById('llmProvider').value = btn.getAttribute('data-provider');
                document.getElementById('llmModelName').focus();
            });
        });

        // 绑定设为默认
        var defaultBtns = llmModelList.querySelectorAll('.llm-action-btn.set-default');
        defaultBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var model = btn.getAttribute('data-model');
                llmSetDefaultModel(model);
            });
        });

        // 绑定复制
        var copyBtns = llmModelList.querySelectorAll('.llm-action-btn.copy');
        copyBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var model = btn.getAttribute('data-model');
                llmCopyModel(model);
            });
        });

        // 绑定编辑
        var editBtns = llmModelList.querySelectorAll('.llm-action-btn.edit');
        editBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var model = btn.getAttribute('data-model');
                llmEditModelFunc(model);
            });
        });

        // 绑定删除
        var deleteBtns = llmModelList.querySelectorAll('.llm-action-btn.delete');
        deleteBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var model = btn.getAttribute('data-model');
                if (confirm('确定删除模型 "' + model + '"？')) {
                    llmRemoveModel(model);
                }
            });
        });
    }

    // ==================== LLM 表单辅助函数 ====================

    /** 重置 LLM 表单到添加模式 */
    function resetLlmForm() {
        llmEditModel = null;
        llmSaveBtn.textContent = '保存';
        document.getElementById('llmProvider').value = '';
        document.getElementById('llmApiUrl').value = '';
        document.getElementById('llmApiKey').value = '';
        document.getElementById('llmApiKey').placeholder = 'sk-...';
        document.getElementById('llmModelName').value = '';
        document.getElementById('llmAlias').value = '';
        document.getElementById('llmTimeout').value = '';
        if (llmCheckResult) llmCheckResult.style.display = 'none';
    }

    /** 将模型数据填入表单（编辑/复制共用） */
    function fillLlmForm(item) {
        if (item.provider) document.getElementById('llmProvider').value = item.provider;
        if (item.apiUrl) document.getElementById('llmApiUrl').value = item.apiUrl;
        document.getElementById('llmApiKey').value = '';
        document.getElementById('llmApiKey').placeholder = item.apiKey ? '已配置（留空保持不变）' : 'sk-...';
        if (item.model) document.getElementById('llmModelName').value = item.model;
        if (item.name && item.name !== item.model) {
            document.getElementById('llmAlias').value = item.name;
        }
    }

    /** 从表单构建 LLM 请求 body */
    function buildLlmBodyObj() {
        var apiUrl = document.getElementById('llmApiUrl').value.trim();
        var apiKey = document.getElementById('llmApiKey').value.trim();
        var model = document.getElementById('llmModelName').value.trim();
        var alias = document.getElementById('llmAlias').value.trim();
        var provider = document.getElementById('llmProvider').value;
        var timeout = document.getElementById('llmTimeout').value.trim();

        if (!apiUrl || !model) {
            alert('API 地址和模型名称为必填项');
            return null;
        }

        var bodyObj = {
            apiUrl: apiUrl,
            model: model,
            name: alias || model,
            provider: provider
        };
        if (apiKey) bodyObj.apiKey = apiKey;
        if (timeout) bodyObj.timeout = timeout;

        return bodyObj;
    }

    /** 编辑模型 */
    function llmEditModelFunc(modelName) {
        var item = llmCachedList.find(function (m) { return m.model === modelName; });
        if (!item) return;

        llmEditModel = modelName;
        showLlmFormView('编辑模型');
        llmSaveBtn.textContent = '更新';

        fillLlmForm(item);
    }

    /** 复制模型 */
    function llmCopyModel(modelName) {
        var item = llmCachedList.find(function (m) { return m.model === modelName; });
        if (!item) return;

        llmEditModel = null;
        showLlmFormView('添加模型');
        llmSaveBtn.textContent = '保存';

        fillLlmForm(item);
        document.getElementById('llmAlias').value = (item.name || item.model) + '-copy';
    }

    /** 设为默认模型 */
    function llmSetDefaultModel(modelName) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/web/settings/llm/models/setDefault?modelName=' + encodeURIComponent(modelName), true);
        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200) {
                        if (typeof modelsLoaded !== 'undefined') {
                            modelsLoaded = false;
                        }
                        loadLlmList();
                    } else {
                        alert('设置失败: ' + (resp.message || '未知错误'));
                    }
                } catch (e) {
                    alert('解析响应失败');
                }
            }
        };
        xhr.send();
    }

    // ==================== LLM 按钮事件 ====================

    // 添加模型按钮
    llmAddBtn.addEventListener('click', function () {
        llmEditModel = null;
        resetLlmForm();
        showLlmFormView('添加模型');
    });

    llmCancelBtn.addEventListener('click', function () {
        showLlmListView();
        resetLlmForm();
    });

    // 保存模型（支持添加和更新）
    llmSaveBtn.addEventListener('click', function () {
        var bodyObj = buildLlmBodyObj();
        if (!bodyObj) return;

        var isEdit = !!llmEditModel;
        var apiUrl = isEdit ? '/web/settings/llm/models/update' : '/web/settings/llm/models/add';
        var actionText = isEdit ? '更新' : '添加';

        if (isEdit) {
            bodyObj.originalModel = llmEditModel;
        }

        llmSaveBtn.disabled = true;

        var xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
            llmSaveBtn.disabled = false;
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200) {
                        if (typeof modelsLoaded !== 'undefined') {
                            modelsLoaded = false;
                        }
                        loadLlmList();
                        showLlmListView();
                        resetLlmForm();
                    } else {
                        alert(actionText + '失败: ' + (resp.message || '未知错误'));
                    }
                } catch (e) {
                    alert('解析响应失败');
                }
            } else {
                alert('请求失败: ' + xhr.status);
            }
        };
        xhr.onerror = function () {
            llmSaveBtn.disabled = false;
            alert('网络错误');
        };
        xhr.send(JSON.stringify(bodyObj));
    });

    // ==================== LLM 测试连接 ====================

    if (llmTestBtn) {
        llmTestBtn.addEventListener('click', function () {
            var apiUrl = document.getElementById('llmApiUrl').value.trim();
            var apiKey = document.getElementById('llmApiKey').value.trim();
            var provider = document.getElementById('llmProvider').value;

            if (!apiUrl) {
                alert('请先填写 API 地址');
                return;
            }

            llmTestBtn.disabled = true;
            llmTestBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> 测试中...';
            if (llmCheckResult) llmCheckResult.style.display = 'none';

            var xhr = new XMLHttpRequest();
            xhr.open('GET', '/web/settings/llm/models/fetch?apiUrl=' + encodeURIComponent(apiUrl)
                + '&apiKey=' + encodeURIComponent(apiKey)
                + '&provider=' + encodeURIComponent(provider), true);
            xhr.timeout = 15000;
            xhr.onload = function () {
                llmTestBtn.disabled = false;
                llmTestBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 测试连接';
                if (xhr.status === 200) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.code === 200 && resp.data && resp.data.length > 0) {
                            if (llmCheckResult) {
                                llmCheckResult.className = 'llm-check-result success';
                                llmCheckResult.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 连接成功，发现 ' + resp.data.length + ' 个可用模型';
                                llmCheckResult.style.display = 'flex';
                            }
                        } else {
                            if (llmCheckResult) {
                                llmCheckResult.className = 'llm-check-result error';
                                llmCheckResult.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> 未找到可用模型';
                                llmCheckResult.style.display = 'flex';
                            }
                        }
                    } catch (e) {
                        if (llmCheckResult) {
                            llmCheckResult.className = 'llm-check-result error';
                            llmCheckResult.innerHTML = '解析响应失败';
                            llmCheckResult.style.display = 'flex';
                        }
                    }
                } else {
                    if (llmCheckResult) {
                        llmCheckResult.className = 'llm-check-result error';
                        llmCheckResult.innerHTML = '连接失败: HTTP ' + xhr.status;
                        llmCheckResult.style.display = 'flex';
                    }
                }
            };
            xhr.ontimeout = function () {
                llmTestBtn.disabled = false;
                llmTestBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 测试连接';
                if (llmCheckResult) {
                    llmCheckResult.className = 'llm-check-result error';
                    llmCheckResult.innerHTML = '连接超时（15秒），请检查 API 地址是否正确';
                    llmCheckResult.style.display = 'flex';
                }
            };
            xhr.onerror = function () {
                llmTestBtn.disabled = false;
                llmTestBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 测试连接';
                if (llmCheckResult) {
                    llmCheckResult.className = 'llm-check-result error';
                    llmCheckResult.innerHTML = '网络错误，请重试';
                    llmCheckResult.style.display = 'flex';
                }
            };
            xhr.send();
        });
    }

    // ==================== LLM 导入/导出 ====================

    if (llmExportBtn) {
        llmExportBtn.addEventListener('click', function () {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', '/web/settings/llm/models/export', true);
            xhr.onload = function () {
                if (xhr.status === 200) {
                    var resp = JSON.parse(xhr.responseText);
                    var models = resp.data || [];
                    var exportObj = { models: models };
                    var jsonStr = JSON.stringify(exportObj, null, 2);
                    var blob = new Blob([jsonStr], { type: 'application/json' });
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'llm-models.json';
                    a.click();
                    URL.revokeObjectURL(url);
                }
            };
            xhr.send();
        });
    }

    if (llmImportBtn) {
        llmImportBtn.addEventListener('click', function () {
            if (llmImportDialog) llmImportDialog.style.display = 'flex';
            var importText = document.getElementById('llmImportText');
            if (importText) importText.value = '';
        });
    }

    if (llmImportCancelBtn) {
        llmImportCancelBtn.addEventListener('click', function () {
            if (llmImportDialog) llmImportDialog.style.display = 'none';
        });
    }

    if (llmImportConfirmBtn) {
        llmImportConfirmBtn.addEventListener('click', function () {
            var importText = document.getElementById('llmImportText');
            var text = importText ? importText.value.trim() : '';
            if (!text) { alert('请粘贴 JSON 配置'); return; }
            try {
                JSON.parse(text);
            } catch (e) {
                alert('JSON 格式无效');
                return;
            }
            llmImportConfirmBtn.disabled = true;
            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/web/settings/llm/models/import', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onload = function () {
                llmImportConfirmBtn.disabled = false;
                if (xhr.status === 200) {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200) {
                        if (typeof modelsLoaded !== 'undefined') {
                            modelsLoaded = false;
                        }
                        loadLlmList();
                        if (llmImportDialog) llmImportDialog.style.display = 'none';
                    } else {
                        alert('导入失败: ' + (resp.message || '未知错误'));
                    }
                }
            };
            xhr.onerror = function () {
                llmImportConfirmBtn.disabled = false;
                alert('网络错误');
            };
            xhr.send(text);
        });
    }

    // ==================== LLM API Key 显示切换 ====================

    if (llmApiKeyToggle) {
        llmApiKeyToggle.addEventListener('click', function () {
            var input = document.getElementById('llmApiKey');
            if (input.type === 'password') {
                input.type = 'text';
                llmApiKeyToggle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
            } else {
                input.type = 'password';
                llmApiKeyToggle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
            }
        });
    }

    // 删除模型
    function llmRemoveModel(modelName) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/web/settings/llm/models/remove?modelName=' + encodeURIComponent(modelName), true);
        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200) {
                        if (typeof modelsLoaded !== 'undefined') {
                            modelsLoaded = false;
                        }
                        loadLlmList();
                    } else {
                        alert('删除失败: ' + (resp.message || '未知错误'));
                    }
                } catch (e) {
                    alert('解析响应失败');
                }
            }
        };
        xhr.send();
    }

    // ==================== MCP 管理 ====================

    // 编辑模式状态
    var mcpEditName = null;
    // 缓存全量列表数据，供编辑/复制时查找
    var mcpCachedList = [];

    function loadMcpList() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/web/settings/mcp/servers', true);
        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200 && resp.data) {
                        mcpCachedList = resp.data;
                        renderMcpList(resp.data);
                    }
                } catch (e) {
                    console.error('[Settings] Failed to parse MCP servers response:', e);
                }
            }
        };
        xhr.onerror = function () {
            console.error('[Settings] Failed to load MCP servers');
        };
        xhr.send();
    }

    function renderMcpList(list) {
        var html = '';
        if (!list || list.length === 0) {
            // 空状态引导 + 模板快捷按钮
            html = '<div class="mcp-empty-state">';
            html += '  <div class="mcp-empty-icon">';
            html += '    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="M7 8h10M7 12h6M7 16h8"/></svg>';
            html += '  </div>';
            html += '  <div class="mcp-empty-title">暂无 MCP 服务器</div>';
            html += '  <div class="mcp-empty-desc">MCP 服务器可扩展 AI 的工具能力，如文件系统访问、数据库查询、API 调用等</div>';
            html += '</div>';
        } else {
            list.forEach(function (item) {
                var name = item.name || '';
                var type = item.type || 'stdio';
                var enabled = item.enabled !== false;
                var detail = '';

                if (type === 'stdio') {
                    detail = item.command || '';
                } else {
                    detail = item.url || '';
                }

                var iconMap = { stdio: 'S', sse: 'R', 'streamable-http': 'H' };
                var icon = iconMap[type] || 'M';

                html += '<div class="mcp-server-item">';
                html += '  <div class="mcp-server-icon">' + escapeHtml(icon) + '</div>';
                html += '  <div class="mcp-server-info">';
                html += '    <div class="mcp-server-name">' + escapeHtml(name) + ' <span style="font-size:10px;color:var(--text-secondary);font-weight:400;">[' + escapeHtml(type) + ']</span></div>';
                if (detail) {
                    html += '    <div class="mcp-server-detail">' + escapeHtml(detail) + '</div>';
                }
                html += '  </div>';
                html += '  <div class="mcp-server-actions">';
                // 启停开关
                html += '    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:var(--text-secondary);">';
                html += '      <input type="checkbox" ' + (enabled ? 'checked' : '') + ' data-name="' + escapeAttr(name) + '" class="mcp-toggle"/>';
                html += '    </label>';
                // 复制按钮
                html += '    <button class="mcp-action-btn copy" data-name="' + escapeAttr(name) + '" title="复制">';
                html += '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
                html += '    </button>';
                // 编辑按钮
                html += '    <button class="mcp-action-btn edit" data-name="' + escapeAttr(name) + '" title="编辑">';
                html += '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
                html += '    </button>';
                // 删除按钮
                html += '    <button class="mcp-action-btn delete" data-name="' + escapeAttr(name) + '" title="删除">';
                html += '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
                html += '    </button>';
                html += '  </div>';
                html += '</div>';
            });
        }
        mcpServerList.innerHTML = html;

        // 绑定模板快捷按钮（空状态时）
        var templateBtns = mcpServerList.querySelectorAll('.mcp-template-btn');
        templateBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                resetMcpForm();
                showMcpFormView('添加服务器');
                mcpTypeBtns.forEach(function (b) { b.classList.remove('active'); });
                document.querySelector('.mcp-type-btn[data-type="stdio"]').classList.add('active');
                document.getElementById('mcpConfigStdio').style.display = 'block';
                document.getElementById('mcpConfigRemote').style.display = 'none';
                document.getElementById('mcpCommand').value = btn.getAttribute('data-command');
                document.getElementById('mcpArgs').value = btn.getAttribute('data-args');
                document.getElementById('mcpName').focus();
            });
        });

        // 绑定启停事件
        var toggles = mcpServerList.querySelectorAll('.mcp-toggle');
        toggles.forEach(function (toggle) {
            toggle.addEventListener('change', function () {
                var name = toggle.getAttribute('data-name');
                var enabled = toggle.checked;
                mcpToggleServer(name, enabled);
            });
        });

        // 绑定复制事件
        var copyBtns = mcpServerList.querySelectorAll('.mcp-action-btn.copy');
        copyBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var name = btn.getAttribute('data-name');
                mcpCopyServer(name);
            });
        });

        // 绑定编辑事件
        var editBtns = mcpServerList.querySelectorAll('.mcp-action-btn.edit');
        editBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var name = btn.getAttribute('data-name');
                mcpEditServer(name);
            });
        });

        // 绑定删除事件
        var deleteBtns = mcpServerList.querySelectorAll('.mcp-action-btn.delete');
        deleteBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var name = btn.getAttribute('data-name');
                if (confirm('确定删除 MCP 服务器 "' + name + '"？')) {
                    mcpRemoveServer(name);
                }
            });
        });
    }

    // ==================== MCP 表单辅助函数 ====================

    /** 重置 MCP 表单到添加模式 */
    function resetMcpForm() {
        mcpEditName = null;
        mcpSaveBtn.textContent = '保存';
        document.getElementById('mcpName').value = '';
        document.getElementById('mcpName').readOnly = false;
        document.getElementById('mcpCommand').value = '';
        document.getElementById('mcpArgs').value = '';
        document.getElementById('mcpEnv').value = '';
        document.getElementById('mcpRemoteUrl').value = '';
        document.getElementById('mcpHeaders').value = '';
        document.getElementById('mcpTimeout').value = '';
        // 重置类型为 stdio
        mcpTypeBtns.forEach(function (b) { b.classList.remove('active'); });
        document.querySelector('.mcp-type-btn[data-type="stdio"]').classList.add('active');
        document.getElementById('mcpConfigStdio').style.display = 'block';
        document.getElementById('mcpConfigRemote').style.display = 'none';
    }

    /** 将服务器数据填入表单（编辑/复制共用） */
    function fillMcpForm(server) {
        var type = server.type || 'stdio';

        // 切换类型
        mcpTypeBtns.forEach(function (b) { b.classList.remove('active'); });
        var typeBtn = document.querySelector('.mcp-type-btn[data-type="' + type + '"]');
        if (typeBtn) typeBtn.classList.add('active');
        document.getElementById('mcpConfigStdio').style.display = type === 'stdio' ? 'block' : 'none';
        document.getElementById('mcpConfigRemote').style.display = (type === 'sse' || type === 'streamable-http') ? 'block' : 'none';

        if (type === 'stdio') {
            document.getElementById('mcpCommand').value = server.command || '';
            document.getElementById('mcpArgs').value = (server.args || []).join('\n');
            var envLines = [];
            if (server.env) {
                Object.keys(server.env).forEach(function (k) { envLines.push(k + '=' + server.env[k]); });
            }
            document.getElementById('mcpEnv').value = envLines.join('\n');
        } else {
            document.getElementById('mcpRemoteUrl').value = server.url || '';
            var headerLines = [];
            if (server.headers) {
                Object.keys(server.headers).forEach(function (k) { headerLines.push(k + '=' + server.headers[k]); });
            }
            document.getElementById('mcpHeaders').value = headerLines.join('\n');
            document.getElementById('mcpTimeout').value = server.timeout || '';
        }
    }

    /** 从表单构建请求 bodyObj */
    function buildMcpBodyObj() {
        var name = document.getElementById('mcpName').value.trim();
        var activeTypeBtn = document.querySelector('.mcp-type-btn.active');
        var type = activeTypeBtn ? activeTypeBtn.getAttribute('data-type') : 'stdio';

        // 名称校验：仅允许 [a-zA-Z0-9_-]
        if (!name) {
            alert('名称为必填项');
            return null;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            alert('名称仅允许字母、数字、下划线和连字符');
            return null;
        }

        var bodyObj = { name: name, type: type, enabled: true };

        if (type === 'stdio') {
            var command = document.getElementById('mcpCommand').value.trim();
            if (!command) {
                alert('命令为必填项');
                return null;
            }
            bodyObj.command = command;

            var argsText = document.getElementById('mcpArgs').value.trim();
            if (argsText) {
                bodyObj.args = argsText.split('\n').filter(function (line) { return line.trim() !== ''; });
            }

            var envText = document.getElementById('mcpEnv').value.trim();
            if (envText) {
                var env = {};
                envText.split('\n').forEach(function (line) {
                    var idx = line.indexOf('=');
                    if (idx > 0) {
                        env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
                    }
                });
                if (Object.keys(env).length > 0) {
                    bodyObj.env = env;
                }
            }
        } else if (type === 'sse' || type === 'streamable-http') {
            var url = document.getElementById('mcpRemoteUrl').value.trim();
            if (!url) {
                alert('URL 为必填项');
                return null;
            }
            if (!/^https?:\/\/.+/.test(url)) {
                alert('URL 必须以 http:// 或 https:// 开头');
                return null;
            }
            bodyObj.url = url;

            var headersText = document.getElementById('mcpHeaders').value.trim();
            if (headersText) {
                var headers = {};
                headersText.split('\n').forEach(function (line) {
                    var idx = line.indexOf('=');
                    if (idx > 0) {
                        headers[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
                    }
                });
                if (Object.keys(headers).length > 0) {
                    bodyObj.headers = headers;
                }
            }

            var timeout = document.getElementById('mcpTimeout').value.trim();
            if (timeout) {
                bodyObj.timeout = timeout;
            }
        }

        return bodyObj;
    }

    // ==================== MCP 按钮事件 ====================

    // 添加 MCP 服务器按钮
    mcpAddBtn.addEventListener('click', function () {
        resetMcpForm();
        showMcpFormView('添加服务器');
    });

    mcpCancelBtn.addEventListener('click', function () {
        showMcpListView();
        resetMcpForm();
    });

    // 类型切换
    mcpTypeBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            mcpTypeBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            var type = btn.getAttribute('data-type');
            document.getElementById('mcpConfigStdio').style.display = type === 'stdio' ? 'block' : 'none';
            document.getElementById('mcpConfigRemote').style.display = (type === 'sse' || type === 'streamable-http') ? 'block' : 'none';
        });
    });

    // 保存 MCP 服务器（支持添加和更新）
    mcpSaveBtn.addEventListener('click', function () {
        var bodyObj = buildMcpBodyObj();
        if (!bodyObj) return;

        var isEdit = !!mcpEditName;
        var apiUrl = isEdit ? '/web/settings/mcp/servers/update' : '/web/settings/mcp/servers/add';
        var actionText = isEdit ? '更新' : '添加';

        mcpSaveBtn.disabled = true;

        var xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
            mcpSaveBtn.disabled = false;
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200) {
                        loadMcpList();
                        showMcpListView();
                        resetMcpForm();
                    } else {
                        alert(actionText + '失败: ' + (resp.message || '未知错误'));
                    }
                } catch (e) {
                    alert('解析响应失败');
                }
            } else {
                alert('请求失败: ' + xhr.status);
            }
        };
        xhr.onerror = function () {
            mcpSaveBtn.disabled = false;
            alert('网络错误');
        };
        xhr.send(JSON.stringify(bodyObj));
    });

    // ==================== MCP 编辑/复制 ====================

    function mcpEditServer(name) {
        var server = mcpCachedList.find(function (s) { return s.name === name; });
        if (!server) return;

        mcpEditName = name;
        showMcpFormView('编辑服务器');
        mcpSaveBtn.textContent = '更新';

        document.getElementById('mcpName').value = server.name;
        document.getElementById('mcpName').readOnly = true;

        fillMcpForm(server);
    }

    function mcpCopyServer(name) {
        var server = mcpCachedList.find(function (s) { return s.name === name; });
        if (!server) return;

        mcpEditName = null; // 走添加路径
        showMcpFormView('添加服务器');
        mcpSaveBtn.textContent = '保存';

        document.getElementById('mcpName').value = server.name + '-copy';
        document.getElementById('mcpName').readOnly = false;

        fillMcpForm(server);
    }

    // ==================== MCP 检测连接 ====================

    var mcpCheckBtn = document.getElementById('mcpCheckBtn');
    var mcpCheckResult = document.getElementById('mcpCheckResult');

    mcpCheckBtn.addEventListener('click', function () {
        var bodyObj = buildMcpBodyObj();
        if (!bodyObj) return;

        mcpCheckBtn.disabled = true;
        mcpCheckBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> 检测中...';
        mcpCheckResult.style.display = 'none';

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/web/settings/mcp/servers/check', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 15000;
        xhr.onload = function () {
            mcpCheckBtn.disabled = false;
            mcpCheckBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 检测连接';
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200) {
                        mcpCheckResult.className = 'mcp-check-result success';
                        mcpCheckResult.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> ' + escapeHtml(resp.message || '连接成功');
                    } else {
                        mcpCheckResult.className = 'mcp-check-result error';
                        mcpCheckResult.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ' + escapeHtml(resp.message || '连接失败');
                    }
                    mcpCheckResult.style.display = 'flex';
                } catch (e) {
                    mcpCheckResult.className = 'mcp-check-result error';
                    mcpCheckResult.innerHTML = '解析响应失败';
                    mcpCheckResult.style.display = 'flex';
                }
            } else {
                mcpCheckResult.className = 'mcp-check-result error';
                mcpCheckResult.innerHTML = '请求失败: HTTP ' + xhr.status;
                mcpCheckResult.style.display = 'flex';
            }
        };
        xhr.ontimeout = function () {
            mcpCheckBtn.disabled = false;
            mcpCheckBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 检测连接';
            mcpCheckResult.className = 'mcp-check-result error';
            mcpCheckResult.innerHTML = '检测超时（15秒），请检查服务器是否可达';
            mcpCheckResult.style.display = 'flex';
        };
        xhr.onerror = function () {
            mcpCheckBtn.disabled = false;
            mcpCheckBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 检测连接';
            mcpCheckResult.className = 'mcp-check-result error';
            mcpCheckResult.innerHTML = '网络错误，请重试';
            mcpCheckResult.style.display = 'flex';
        };
        xhr.send(JSON.stringify(bodyObj));
    });

    // ==================== MCP 删除/启停 ====================

    function mcpRemoveServer(name) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/web/settings/mcp/servers/remove', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200) {
                        loadMcpList();
                    } else {
                        alert('删除失败: ' + (resp.message || '未知错误'));
                    }
                } catch (e) {
                    alert('解析响应失败');
                }
            }
        };
        xhr.send(JSON.stringify({ name: name }));
    }

    function mcpToggleServer(name, enabled) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/web/settings/mcp/servers/toggle', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code !== 200) {
                        alert('操作失败: ' + (resp.message || '未知错误'));
                        loadMcpList();
                    }
                } catch (e) {
                    loadMcpList();
                }
            }
        };
        xhr.send(JSON.stringify({ name: name, enabled: enabled }));
    }

    // ==================== MCP 导入/导出 ====================

    var mcpExportBtn = document.getElementById('mcpExportBtn');
    var mcpImportBtn = document.getElementById('mcpImportBtn');
    var mcpImportDialog = document.getElementById('mcpImportDialog');
    var mcpImportCancelBtn = document.getElementById('mcpImportCancelBtn');
    var mcpImportConfirmBtn = document.getElementById('mcpImportConfirmBtn');

    mcpExportBtn.addEventListener('click', function () {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/web/settings/mcp/servers', true);
        xhr.onload = function () {
            if (xhr.status === 200) {
                var resp = JSON.parse(xhr.responseText);
                var servers = resp.data || [];
                // 转换为 Map 格式（业界标准）
                var exportObj = { mcpServers: {} };
                servers.forEach(function (s) {
                    var entry = { type: s.type };
                    if (s.type === 'stdio') {
                        if (s.command) entry.command = s.command;
                        if (s.args) entry.args = s.args;
                        if (s.env) entry.env = s.env;
                    } else {
                        if (s.url) entry.url = s.url;
                        if (s.headers) entry.headers = s.headers;
                        if (s.timeout) entry.timeout = s.timeout;
                    }
                    exportObj.mcpServers[s.name] = entry;
                });
                var jsonStr = JSON.stringify(exportObj, null, 2);
                var blob = new Blob([jsonStr], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'mcp-servers.json';
                a.click();
                URL.revokeObjectURL(url);
            }
        };
        xhr.send();
    });

    mcpImportBtn.addEventListener('click', function () {
        mcpImportDialog.style.display = 'flex';
        document.getElementById('mcpImportText').value = '';
    });

    mcpImportCancelBtn.addEventListener('click', function () {
        mcpImportDialog.style.display = 'none';
    });

    mcpImportConfirmBtn.addEventListener('click', function () {
        var text = document.getElementById('mcpImportText').value.trim();
        if (!text) { alert('请粘贴 JSON 配置'); return; }
        try {
            JSON.parse(text); // 校验格式
        } catch (e) {
            alert('JSON 格式无效');
            return;
        }
        mcpImportConfirmBtn.disabled = true;
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/web/settings/mcp/servers/import', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
            mcpImportConfirmBtn.disabled = false;
            if (xhr.status === 200) {
                var resp = JSON.parse(xhr.responseText);
                if (resp.code === 200) {
                    loadMcpList();
                    mcpImportDialog.style.display = 'none';
                } else {
                    alert('导入失败: ' + (resp.message || '未知错误'));
                }
            }
        };
        xhr.onerror = function () {
            mcpImportConfirmBtn.disabled = false;
            alert('网络错误');
        };
        xhr.send(text);
    });

    // ==================== OpenApi 管理 ====================

    // DOM
    var webapiAddBtn = document.getElementById('webapiAddBtn');
    var webapiAddForm = document.getElementById('webapiAddForm');
    var webapiCancelBtn = document.getElementById('webapiCancelBtn');
    var webapiSaveBtn = document.getElementById('webapiSaveBtn');
    var webapiServerList = document.getElementById('webapiServerList');
    var webapiExportBtn = document.getElementById('webapiExportBtn');
    var webapiImportBtn = document.getElementById('webapiImportBtn');
    var webapiImportDialog = document.getElementById('webapiImportDialog');
    var webapiImportCancelBtn = document.getElementById('webapiImportCancelBtn');
    var webapiImportConfirmBtn = document.getElementById('webapiImportConfirmBtn');

    // 编辑模式状态
    var webapiEditName = null;
    // 缓存全量列表数据
    var webapiCachedList = [];

    function loadWebapiList() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/web/settings/webapi/servers', true);
        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200 && resp.data) {
                        webapiCachedList = resp.data;
                        renderWebapiList(resp.data);
                    }
                } catch (e) {
                    console.error('[Settings] Failed to parse OpenApi servers response:', e);
                }
            }
        };
        xhr.onerror = function () {
            console.error('[Settings] Failed to load OpenApi servers');
        };
        xhr.send();
    }

    function renderWebapiList(list) {
        var html = '';
        if (!list || list.length === 0) {
            html = '<div class="mcp-empty-state">';
            html += '  <div class="mcp-empty-icon">';
            html += '    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
            html += '  </div>';
            html += '  <div class="mcp-empty-title">暂无 OpenApi 服务器</div>';
            html += '  <div class="mcp-empty-desc">OpenApi 服务器可扩展 AI 的 API 调用能力，对接外部 RESTful 接口</div>';
            html += '</div>';
        } else {
            list.forEach(function (item) {
                var name = item.name || '';
                var baseUrl = item.apiBaseUrl || '';
                var docUrl = item.docUrl || '';
                var enabled = item.enabled !== false;

                html += '<div class="mcp-server-item">';
                html += '  <div class="mcp-server-icon">A</div>';
                html += '  <div class="mcp-server-info">';
                html += '    <div class="mcp-server-name">' + escapeHtml(name) + ' <span style="font-size:10px;color:var(--text-secondary);font-weight:400;">[openapi]</span></div>';
                if (baseUrl) {
                    html += '    <div class="mcp-server-detail">' + escapeHtml(baseUrl) + '</div>';
                }
                if (docUrl) {
                    html += '    <div class="mcp-server-detail" style="color:var(--accent);">' + escapeHtml(docUrl) + '</div>';
                }
                html += '  </div>';
                html += '  <div class="mcp-server-actions">';
                // 启停开关
                html += '    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:var(--text-secondary);">';
                html += '      <input type="checkbox" ' + (enabled ? 'checked' : '') + ' data-name="' + escapeAttr(name) + '" class="webapi-toggle"/>';
                html += '    </label>';
                // 编辑按钮
                html += '    <button class="mcp-action-btn edit" data-name="' + escapeAttr(name) + '" title="编辑">';
                html += '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
                html += '    </button>';
                // 删除按钮
                html += '    <button class="mcp-action-btn delete" data-name="' + escapeAttr(name) + '" title="删除">';
                html += '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
                html += '    </button>';
                html += '  </div>';
                html += '</div>';
            });
        }
        webapiServerList.innerHTML = html;

        // 绑定启停事件
        var toggles = webapiServerList.querySelectorAll('.webapi-toggle');
        toggles.forEach(function (toggle) {
            toggle.addEventListener('change', function () {
                var name = toggle.getAttribute('data-name');
                var enabled = toggle.checked;
                webapiToggleServer(name, enabled);
            });
        });

        // 绑定编辑事件
        var editBtns = webapiServerList.querySelectorAll('.mcp-action-btn.edit');
        editBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var name = btn.getAttribute('data-name');
                webapiEditServer(name);
            });
        });

        // 绑定删除事件
        var deleteBtns = webapiServerList.querySelectorAll('.mcp-action-btn.delete');
        deleteBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var name = btn.getAttribute('data-name');
                if (confirm('确定删除 OpenApi 服务器 "' + name + '"？')) {
                    webapiRemoveServer(name);
                }
            });
        });
    }

    // ==================== OpenApi 表单辅助函数 ====================

    function resetWebapiForm() {
        webapiEditName = null;
        webapiSaveBtn.textContent = '保存';
        document.getElementById('webapiName').value = '';
        document.getElementById('webapiName').readOnly = false;
        document.getElementById('webapiBaseUrl').value = '';
        document.getElementById('webapiDocUrl').value = '';
        document.getElementById('webapiHeaders').value = '';
    }

    function fillWebapiForm(server) {
        document.getElementById('webapiBaseUrl').value = server.apiBaseUrl || '';
        document.getElementById('webapiDocUrl').value = server.docUrl || '';
        var headerLines = [];
        if (server.headers) {
            Object.keys(server.headers).forEach(function (k) { headerLines.push(k + '=' + server.headers[k]); });
        }
        document.getElementById('webapiHeaders').value = headerLines.join('\n');
    }

    function buildWebapiBodyObj() {
        var name = document.getElementById('webapiName').value.trim();
        var baseUrl = document.getElementById('webapiBaseUrl').value.trim();
        var docUrl = document.getElementById('webapiDocUrl').value.trim();
        var headersText = document.getElementById('webapiHeaders').value.trim();

        if (!name) {
            alert('名称为必填项');
            return null;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            alert('名称仅允许字母、数字、下划线和连字符');
            return null;
        }
        if (!baseUrl) {
            alert('API 基地址为必填项');
            return null;
        }

        var bodyObj = { name: name, apiBaseUrl: baseUrl, enabled: true };
        if (docUrl) bodyObj.docUrl = docUrl;

        if (headersText) {
            var headers = {};
            headersText.split('\n').forEach(function (line) {
                var idx = line.indexOf('=');
                if (idx > 0) {
                    headers[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
                }
            });
            if (Object.keys(headers).length > 0) {
                bodyObj.headers = headers;
            }
        }

        return bodyObj;
    }

    function webapiEditServer(name) {
        var server = webapiCachedList.find(function (s) { return s.name === name; });
        if (!server) return;

        webapiEditName = name;
        showWebapiFormView('编辑服务器');
        webapiSaveBtn.textContent = '更新';

        document.getElementById('webapiName').value = server.name;
        document.getElementById('webapiName').readOnly = true;

        fillWebapiForm(server);
    }

    // ==================== OpenApi 按钮事件 ====================

    webapiAddBtn.addEventListener('click', function () {
        resetWebapiForm();
        showWebapiFormView('添加服务器');
    });

    webapiCancelBtn.addEventListener('click', function () {
        showWebapiListView();
        resetWebapiForm();
    });

    // OpenApi 测试连接
    var webapiTestBtn = document.getElementById('webapiTestBtn');
    var webapiCheckResult = document.getElementById('webapiCheckResult');

    webapiTestBtn.addEventListener('click', function () {
        var baseUrl = document.getElementById('webapiBaseUrl').value.trim();
        if (!baseUrl) { alert('请先填写 API 基地址'); return; }

        var headersText = document.getElementById('webapiHeaders').value.trim();
        var headers = {};
        if (headersText) {
            headersText.split('\n').forEach(function (line) {
                var idx = line.indexOf('=');
                if (idx > 0) headers[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
            });
        }

        webapiTestBtn.disabled = true;
        webapiTestBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> 测试中...';
        webapiCheckResult.style.display = 'none';

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/web/settings/webapi/servers/check', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 15000;
        xhr.onload = function () {
            webapiTestBtn.disabled = false;
            webapiTestBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 测试连接';
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200) {
                        webapiCheckResult.className = 'llm-check-result success';
                        webapiCheckResult.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 连接成功';
                    } else {
                        webapiCheckResult.className = 'llm-check-result error';
                        webapiCheckResult.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ' + (resp.message || '连接失败');
                    }
                    webapiCheckResult.style.display = 'flex';
                } catch (e) {
                    webapiCheckResult.className = 'llm-check-result error';
                    webapiCheckResult.innerHTML = '解析响应失败';
                    webapiCheckResult.style.display = 'flex';
                }
            } else {
                webapiCheckResult.className = 'llm-check-result error';
                webapiCheckResult.innerHTML = '连接失败: HTTP ' + xhr.status;
                webapiCheckResult.style.display = 'flex';
            }
        };
        xhr.ontimeout = function () {
            webapiTestBtn.disabled = false;
            webapiTestBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 测试连接';
            webapiCheckResult.className = 'llm-check-result error';
            webapiCheckResult.innerHTML = '连接超时（15秒），请检查地址是否正确';
            webapiCheckResult.style.display = 'flex';
        };
        xhr.onerror = function () {
            webapiTestBtn.disabled = false;
            webapiTestBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 测试连接';
            webapiCheckResult.className = 'llm-check-result error';
            webapiCheckResult.innerHTML = '网络错误，请重试';
            webapiCheckResult.style.display = 'flex';
        };
        xhr.send(JSON.stringify({ baseUrl: baseUrl, headers: headers }));
    });

    webapiSaveBtn.addEventListener('click', function () {
        var bodyObj = buildWebapiBodyObj();
        if (!bodyObj) return;

        var isEdit = !!webapiEditName;
        var apiUrl = isEdit ? '/web/settings/webapi/servers/update' : '/web/settings/webapi/servers/add';
        var actionText = isEdit ? '更新' : '添加';

        webapiSaveBtn.disabled = true;

        var xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
            webapiSaveBtn.disabled = false;
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200) {
                        loadWebapiList();
                        showWebapiListView();
                        resetWebapiForm();
                    } else {
                        alert(actionText + '失败: ' + (resp.message || '未知错误'));
                    }
                } catch (e) {
                    alert('解析响应失败');
                }
            } else {
                alert('请求失败: ' + xhr.status);
            }
        };
        xhr.onerror = function () {
            webapiSaveBtn.disabled = false;
            alert('网络错误');
        };
        xhr.send(JSON.stringify(bodyObj));
    });

    function webapiRemoveServer(name) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/web/settings/webapi/servers/remove', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200) {
                        loadWebapiList();
                    } else {
                        alert('删除失败: ' + (resp.message || '未知错误'));
                    }
                } catch (e) {
                    alert('解析响应失败');
                }
            }
        };
        xhr.send(JSON.stringify({ name: name }));
    }

    function webapiToggleServer(name, enabled) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/web/settings/webapi/servers/toggle', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code !== 200) {
                        alert('操作失败: ' + (resp.message || '未知错误'));
                        loadWebapiList();
                    }
                } catch (e) {
                    loadWebapiList();
                }
            }
        };
        xhr.send(JSON.stringify({ name: name, enabled: enabled }));
    }

    // ==================== OpenApi 导入/导出 ====================

    webapiExportBtn.addEventListener('click', function () {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/web/settings/webapi/servers', true);
        xhr.onload = function () {
            if (xhr.status === 200) {
                var resp = JSON.parse(xhr.responseText);
                var servers = resp.data || [];
                var exportObj = { apiServers: {} };
                servers.forEach(function (s) {
                    var entry = {};
                    if (s.apiBaseUrl) entry.apiBaseUrl = s.apiBaseUrl;
                    if (s.docUrl) entry.docUrl = s.docUrl;
                    if (s.headers) entry.headers = s.headers;
                    exportObj.apiServers[s.name] = entry;
                });
                var jsonStr = JSON.stringify(exportObj, null, 2);
                var blob = new Blob([jsonStr], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'openapi-servers.json';
                a.click();
                URL.revokeObjectURL(url);
            }
        };
        xhr.send();
    });

    webapiImportBtn.addEventListener('click', function () {
        webapiImportDialog.style.display = 'flex';
        document.getElementById('webapiImportText').value = '';
    });

    webapiImportCancelBtn.addEventListener('click', function () {
        webapiImportDialog.style.display = 'none';
    });

    webapiImportConfirmBtn.addEventListener('click', function () {
        var text = document.getElementById('webapiImportText').value.trim();
        if (!text) { alert('请粘贴 JSON 配置'); return; }
        try {
            JSON.parse(text);
        } catch (e) {
            alert('JSON 格式无效');
            return;
        }
        webapiImportConfirmBtn.disabled = true;
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/web/settings/webapi/servers/import', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
            webapiImportConfirmBtn.disabled = false;
            if (xhr.status === 200) {
                var resp = JSON.parse(xhr.responseText);
                if (resp.code === 200) {
                    loadWebapiList();
                    webapiImportDialog.style.display = 'none';
                } else {
                    alert('导入失败: ' + (resp.message || '未知错误'));
                }
            }
        };
        xhr.onerror = function () {
            webapiImportConfirmBtn.disabled = false;
            alert('网络错误');
        };
        xhr.send(text);
    });

    // ==================== Skills 管理 ====================

    var skillsSearchInput = document.getElementById('skillsSearchInput');
    var skillsSearchClear = document.getElementById('skillsSearchClear');
    var skillsList = document.getElementById('skillsList');
    var skillsLoading = document.getElementById('skillsLoading');
    var skillsError = document.getElementById('skillsError');
    var skillsStatus = document.getElementById('skillsStatus');

    // 已安装技能名称集合（从 /web/chat/hints 全局缓存中提取）
    var _installedSkillsCache = null;

    function getInstalledSkills(callback) {
        // 优先从 app-history.js 的全局 commandList 缓存中读取
        if (typeof commandList !== 'undefined' && commandList.length > 0) {
            if (!_installedSkillsCache) {
                _installedSkillsCache = {};
                commandList.forEach(function (item) {
                    if (item.type === 'skill') {
                        _installedSkillsCache[item.name] = true;
                    }
                });
            }
            callback(_installedSkillsCache);
            return;
        }
        // 兜底：直接请求
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/web/chat/hints', true);
        xhr.onload = function () {
            _installedSkillsCache = {};
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    var data = resp.data || [];
                    data.forEach(function (item) {
                        if (item.type === 'skill') {
                            _installedSkillsCache[item.name] = true;
                        }
                    });
                } catch (e) {}
            }
            callback(_installedSkillsCache);
        };
        xhr.onerror = function () {
            _installedSkillsCache = {};
            callback(_installedSkillsCache);
        };
        xhr.send();
    }

    var _skillsSearchTimer = null;

    function loadSkillsList(query) {
        // 显示加载状态
        skillsStatus.style.display = 'block';
        skillsLoading.style.display = 'flex';
        skillsError.style.display = 'none';
        skillsList.innerHTML = '';

        var url = query
            ? 'https://www.skills.sh/api/search?q=' + encodeURIComponent(query)
            : 'https://www.skills.sh/api/search';

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = 15000;
        xhr.onload = function () {
            skillsLoading.style.display = 'none';
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    var skills = Array.isArray(resp) ? resp : (resp.data || []);
                    getInstalledSkills(function (installedMap) {
                        renderSkillsList(skills, installedMap);
                        skillsStatus.style.display = 'none';
                    });
                } catch (e) {
                    skillsError.textContent = '解析响应失败';
                    skillsError.style.display = 'block';
                }
            } else {
                skillsError.textContent = '请求失败: HTTP ' + xhr.status;
                skillsError.style.display = 'block';
            }
        };
        xhr.ontimeout = function () {
            skillsLoading.style.display = 'none';
            skillsError.textContent = '请求超时，请检查网络连接';
            skillsError.style.display = 'block';
        };
        xhr.onerror = function () {
            skillsLoading.style.display = 'none';
            skillsError.textContent = '网络错误，无法连接 skills.sh';
            skillsError.style.display = 'block';
        };
        xhr.send();
    }

    function renderSkillsList(skills, installedMap) {
        var html = '';
        if (!skills || skills.length === 0) {
            html = '<div class="skill-empty-state">';
            html += '  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
            html += '  <div style="font-size:13px;margin-top:12px;">暂无结果</div>';
            html += '</div>';
            skillsList.innerHTML = html;
            return;
        }

        skills.forEach(function (skill) {
            var name = skill.name || '';
            var desc = skill.description || '';
            var installUrl = skill.installUrl || skill.url || '';
            var installs = skill.installs || 0;
            var source = skill.source || '';

            // 检测是否已安装（按 name 匹配）
            var isInstalled = !!installedMap[name];

            // 取名字首字母做图标
            var iconText = name ? name.substring(0, 2).toUpperCase() : 'SK';

            // 截断描述
            var shortDesc = desc;
            if (shortDesc && shortDesc.length > 60) {
                shortDesc = shortDesc.substring(0, 60) + '...';
            }

            html += '<div class="skill-item">';
            html += '  <div class="skill-item-icon">' + escapeHtml(iconText) + '</div>';
            html += '  <div class="skill-item-info">';
            html += '    <div class="skill-item-name" title="' + escapeAttr(name) + '">' + escapeHtml(name) + '</div>';
            if (shortDesc) {
                html += '    <div class="skill-item-desc" title="' + escapeAttr(desc) + '">' + escapeHtml(shortDesc) + '</div>';
            }
            html += '    <div class="skill-item-meta">';
            if (installs > 0) {
                html += '      <span>' + (installs >= 1000 ? (installs / 1000).toFixed(1) + 'k' : installs) + ' 安装</span>';
            }
            if (source) {
                html += '      <span>' + escapeHtml(source.split('/').pop()) + '</span>';
            }
            html += '    </div>';
            html += '  </div>';
            html += '  <div class="skill-item-actions">';
            if (isInstalled) {
                html += '    <button class="skill-install-btn installed" disabled>已安装</button>';
            } else {
                html += '    <button class="skill-install-btn" data-install-url="' + escapeAttr(installUrl) + '" data-skill-name="' + escapeAttr(name) + '">安装</button>';
            }
            html += '  </div>';
            html += '</div>';
        });

        skillsList.innerHTML = html;

        // 绑定安装按钮事件
        var installBtns = skillsList.querySelectorAll('.skill-install-btn:not(.installed)');
        installBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var installUrl = btn.getAttribute('data-install-url');
                var skillName = btn.getAttribute('data-skill-name');
                installSkill(btn, installUrl, skillName);
            });
        });
    }

    function installSkill(btn, installUrl, skillName) {
        btn.classList.add('installing');
        btn.textContent = '安装中...';
        btn.disabled = true;

        // 通过 /web/chat/input 接口发送安装命令
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/web/chat/input', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onload = function () {
            if (xhr.status === 200) {
                btn.classList.remove('installing');
                btn.classList.add('installed');
                btn.textContent = '已安装';
                btn.disabled = true;
                // 清除已安装缓存，下次刷新重新检测
                _installedSkillsCache = null;
                if (typeof loadCommands === 'function') loadCommands();
            } else {
                btn.classList.remove('installing');
                btn.textContent = '安装';
                btn.disabled = false;
                alert('安装失败: HTTP ' + xhr.status);
            }
        };
        xhr.onerror = function () {
            btn.classList.remove('installing');
            btn.textContent = '安装';
            btn.disabled = false;
            alert('网络错误');
        };
        xhr.send('text=' + encodeURIComponent('/skills add ' + installUrl));
    }

    // 搜索输入事件（防抖 400ms）
    if (skillsSearchInput) {
        skillsSearchInput.addEventListener('input', function () {
            var val = skillsSearchInput.value.trim();
            skillsSearchClear.style.display = val ? 'block' : 'none';
            clearTimeout(_skillsSearchTimer);
            _skillsSearchTimer = setTimeout(function () {
                loadSkillsList(val || null);
            }, 400);
        });
    }

    if (skillsSearchClear) {
        skillsSearchClear.addEventListener('click', function () {
            skillsSearchInput.value = '';
            skillsSearchClear.style.display = 'none';
            loadSkillsList(null);
            skillsSearchInput.focus();
        });
    }

    // ==================== Tab 切换（补充 skills + openapi） ====================

    // 重新绑定 tab 切换以支持 openapi
    tabs.forEach(function (tab) {
        tab.removeEventListener('click', function () {});
    });

    // 使用新的事件绑定覆盖（通过事件委托）
    var settingsTabs = document.querySelector('.settings-tabs');
    settingsTabs.addEventListener('click', function (e) {
        var tab = e.target.closest('.settings-tab');
        if (!tab) return;

        tabs.forEach(function (t) { t.classList.remove('active'); });
        tabContents.forEach(function (c) { c.classList.remove('active'); });
        tab.classList.add('active');

        var targetTab = tab.getAttribute('data-tab');
        if (targetTab === 'llm') {
            document.getElementById('settingsTabLlm').classList.add('active');
            loadLlmList();
        } else if (targetTab === 'skills') {
            document.getElementById('settingsTabSkills').classList.add('active');
            _installedSkillsCache = null;
            loadSkillsList(null);
        } else if (targetTab === 'mcp') {
            document.getElementById('settingsTabMcp').classList.add('active');
            loadMcpList();
        } else if (targetTab === 'webapi') {
            document.getElementById('settingsTabWebapi').classList.add('active');
            loadWebapiList();
        }
    });

    // 补充 loadActiveTabData 的 openapi 分支
    var _origLoadActiveTabData = loadActiveTabData;
    loadActiveTabData = function () {
        var activeTab = document.querySelector('.settings-tab.active');
        if (activeTab) {
            var targetTab = activeTab.getAttribute('data-tab');
            if (targetTab === 'llm') {
                loadLlmList();
            } else if (targetTab === 'skills') {
                _installedSkillsCache = null;
                loadSkillsList(null);
            } else if (targetTab === 'mcp') {
                loadMcpList();
            } else if (targetTab === 'webapi') {
                loadWebapiList();
            }
        }
    };

    // ==================== 工具函数 ====================

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

})();
