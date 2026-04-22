// ===== メイン初期化・イベント設定 =====

function initializeApp() {
    // port-data.jsからポート型データを読み込む
    portTypeData = Object.assign({}, portTypeDataJSON);

    // ツールバーのボタン
    document.getElementById('add-wall-outlet').addEventListener('click', () => createNode('outlet'));
    document.getElementById('add-power-strip').addEventListener('click', () => createNode('strip'));
    document.getElementById('add-device').addEventListener('click', () => createNode('device'));

    // ズームボタン
    document.getElementById('zoom-in').addEventListener('click', () => {
        const rect = workspaceContainer.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const newZoom = Math.min(zoomLevel + ZOOM_STEP, MAX_ZOOM);
        updateZoom(newZoom, centerX, centerY);
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        const rect = workspaceContainer.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const newZoom = Math.max(zoomLevel - ZOOM_STEP, MIN_ZOOM);
        updateZoom(newZoom, centerX, centerY);
    });

    // インポート/エクスポートボタン
    document.getElementById('import-btn').addEventListener('click', importWorkspace);
    document.getElementById('export-btn').addEventListener('click', exportWorkspace);

    // キャンバス上のイベント
    workspaceContainer.addEventListener('mousedown', handleWorkspaceMouseDown);
    workspaceContainer.addEventListener('mousemove', handleMouseMove);
    workspaceContainer.addEventListener('mouseup', handleMouseUp);
    workspaceContainer.addEventListener('mouseleave', handleMouseUp);
    
    // Ctrl + ホイールでのズーム
    workspaceContainer.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const rect = workspaceContainer.getBoundingClientRect();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            const newZoom = Math.min(Math.max(zoomLevel + delta, MIN_ZOOM), MAX_ZOOM);
            
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            updateZoom(newZoom, mouseX, mouseY);
        }
    }, { passive: false });

    // ドロップダウンメニューを初期化
    document.querySelectorAll('.socket-port').forEach((socketEl) => {
        const node = socketEl.closest('.node');
        if (node) {
            const sockets = node.querySelectorAll('.socket-port');
            const index = Array.from(sockets).indexOf(socketEl);
            if (index >= 0) {
                initPortTypeDropdown(socketEl, node, index);
            }
        }
    });

    window.addEventListener('beforeunload', () => {
        saveWorkspaceState();
    });

    // ノード削除ボタン
    document.addEventListener('pointerdown', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.stopPropagation();
            e.preventDefault();
            const node = deleteBtn.closest('.node');
            if (node) {
                deleteNode(node.id);
            }
        }
    }, true);
    
    // 保存データ復元
    const restored = restoreWorkspaceState();
    if (!restored) {
        setTimeout(() => {
            const rect = workspaceContainer.getBoundingClientRect();
            createNode('outlet', rect.width / 2 - 40, rect.height / 2 - 40);
        }, 100);
    }
}

// DOMContentLoadedイベント時に初期化を実行
document.addEventListener('DOMContentLoaded', initializeApp);
