document.addEventListener('DOMContentLoaded', () => {
    // 初始化标记库的配置
    marked.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true
    });
  
    // DOM 元素
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    const manualFetchBtn = document.getElementById('manualFetchBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const clearBtn = document.getElementById('clearBtn');
    const autoFetchToggle = document.getElementById('autoFetchToggle');
    const exportBtn = document.getElementById('exportBtn');
    const toggleEditBtn = document.getElementById('toggleEditBtn');
  
    // 状态变量
    let history = [];
    let currentHistoryIndex = -1;
    let autoFetchEnabled = true;
    let clipboardCheckInterval = null;
    let lastClipboardContent = '';
    let isEditMode = false;
  
    // 初始化插件
    initPlugin();
  
    // 添加事件监听器
    manualFetchBtn.addEventListener('click', fetchFromClipboard);
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    clearBtn.addEventListener('click', clearContent);
    autoFetchToggle.addEventListener('change', toggleAutoFetch);
    exportBtn.addEventListener('click', exportContent);
    editor.addEventListener('input', handleEditorInput);
    toggleEditBtn.addEventListener('click', toggleEditMode);
  
    // 初始化插件
    async function initPlugin() {
      const storage = await chrome.storage.local.get(['content', 'autoFetch']);
      
      if (storage.content) {
        addToHistory(storage.content);
        updateEditorAndPreview(storage.content);
      }
      
      if (storage.autoFetch !== undefined) {
        autoFetchEnabled = storage.autoFetch;
        autoFetchToggle.checked = autoFetchEnabled;
      }
      
      if (autoFetchEnabled) {
        startAutoFetch();
      }
      
      fetchFromClipboard();
    }
  
    // 开始自动获取剪贴板内容
    function startAutoFetch() {
      stopAutoFetch();
      clipboardCheckInterval = setInterval(fetchFromClipboard, 2000);
    }
  
    // 停止自动获取剪贴板内容
    function stopAutoFetch() {
      if (clipboardCheckInterval) {
        clearInterval(clipboardCheckInterval);
        clipboardCheckInterval = null;
      }
    }
  
    // 切换自动获取
    function toggleAutoFetch() {
      autoFetchEnabled = autoFetchToggle.checked;
      chrome.storage.local.set({ autoFetch: autoFetchEnabled });
      
      if (autoFetchEnabled) {
        startAutoFetch();
      } else {
        stopAutoFetch();
      }
    }
  
    // 计算字符串中的汉字数量
    function countChineseCharacters(text) {
      const chineseRegex = /[\u4e00-\u9fa5]/g;
      const matches = text.match(chineseRegex);
      return matches ? matches.length : 0;
    }
  
    // 从剪贴板获取内容
    async function fetchFromClipboard() {
      // 检查焦点状态
      if (!document.hasFocus()) {
        return; // 如果 Side Panel 未聚焦，静默跳过
      }
      
      try {
        const text = await navigator.clipboard.readText();
        
        if (text && text.trim() !== '' && text !== lastClipboardContent) {
          const chineseCount = countChineseCharacters(text);
          
          if (chineseCount > 100) {
            return; // 超过100汉字，不予粘贴
          }
          
          lastClipboardContent = text;
          let newContent = editor.value;
          if (newContent && newContent.trim() !== '') {
            newContent += '\n\n';
          }
          newContent += text;
          addToHistory(newContent);
          updateEditorAndPreview(newContent);
          saveContent();
        }
      } catch (error) {
        // 静默忽略错误（如权限不足或焦点丢失）
      }
    }
  
    // 处理编辑器输入
    function handleEditorInput() {
      const content = editor.value;
      addToHistory(content);
      updatePreview();
      saveContent();
    }
  
    // 更新编辑器和预览区域
    function updateEditorAndPreview(content) {
      editor.value = content;
      updatePreview();
      if (isEditMode) {
        editor.style.display = 'block';
        preview.style.display = 'none';
      } else {
        editor.style.display = 'none';
        preview.style.display = 'block';
      }
    }
  
    // 更新预览
    function updatePreview() {
      preview.innerHTML = marked.parse(editor.value);
      updateUndoRedoState();
    }
  
    // 切换编辑模式
    function toggleEditMode() {
      isEditMode = !isEditMode;
      toggleEditBtn.textContent = isEditMode ? '👁️' : '✏️';
      toggleEditBtn.title = isEditMode ? '切换到预览模式' : '切换到编辑模式';
      updateEditorAndPreview(editor.value);
    }
  
    // 添加到历史记录
    function addToHistory(content) {
      if (history.length > 0 && history[currentHistoryIndex] === content) {
        return;
      }
      
      if (currentHistoryIndex < history.length - 1) {
        history = history.slice(0, currentHistoryIndex + 1);
      }
      
      history.push(content);
      currentHistoryIndex = history.length - 1;
      
      if (history.length > 50) {
        history.shift();
        currentHistoryIndex--;
      }
      
      updateUndoRedoState();
    }
  
    // 撤销操作
    function undo() {
      if (currentHistoryIndex > 0) {
        currentHistoryIndex--;
        updateEditorAndPreview(history[currentHistoryIndex]);
        saveContent();
      }
    }
  
    // 重做操作
    function redo() {
      if (currentHistoryIndex < history.length - 1) {
        currentHistoryIndex++;
        updateEditorAndPreview(history[currentHistoryIndex]);
        saveContent();
      }
    }
  
    // 更新撤销/重做按钮状态
    function updateUndoRedoState() {
      undoBtn.disabled = currentHistoryIndex <= 0;
      redoBtn.disabled = currentHistoryIndex >= history.length - 1;
    }
  
    // 清空内容
    function clearContent() {
      if (confirm('确定要清空所有内容吗？')) {
        addToHistory('');
        updateEditorAndPreview('');
        saveContent();
      }
    }
  
    // 导出内容为Markdown文件
    function exportContent() {
      const content = editor.value;
      if (!content) {
        alert('没有内容可导出');
        return;
      }
  
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date();
      const fileName = `clipboard-notes-${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.md`;
      
      a.href = url;
      a.download = fileName;
      a.click();
      
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
    }
  
    // 保存内容
    function saveContent() {
      chrome.storage.local.set({ content: editor.value });
    }
  
    // 在窗口关闭时保存内容并清理资源
    window.addEventListener('beforeunload', () => {
      saveContent();
      stopAutoFetch();
    });
  });