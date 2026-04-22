// ===== ストレージ操作（localStorage） =====

let lastSavedState = null;

function requestSaveWorkspace() {
    if (isRestoring) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveWorkspaceState();
    }, 250);
}

function saveWorkspaceState() {
    if (isRestoring) return;
    try {
        const nodeElements = document.querySelectorAll('.node');
        const nodes = Array.from(nodeElements).map(n => {
            const x = parseInt(n.style.left || '0', 10);
            const y = parseInt(n.style.top || '0', 10);
            const width = parseInt(n.style.width || '160', 10);
            const height = parseInt(n.style.height || 'auto', 10);
            const type = n.dataset.type;
            const nameInput = n.querySelector('.node-name');
            const name = nameInput?.value ?? '';
            const sockets = n.querySelectorAll('.socket-port');
            const socketCount = sockets.length;
            const plugCount = n.querySelectorAll('.plug-port').length;
            
            // 色を data-color 属性から取得（ノードに保存されている）
            const color = n.dataset.color || '#4CAF50';
            
            const iconSpan = n.querySelector('.node-icon');
            const iconSvg = iconSpan?.innerHTML ?? null;
            const nodeMemoEl = n.querySelector('.node-memo');
            const nodeMemo = nodeMemoEl?.value ?? '';
            
            // 説明テキストを保存
            const descriptionInput = n.querySelector('.description-input');
            const description = descriptionInput?.value ?? '';
            
            // 説明コンテナの高さを保存（パディング8px×2 + ボーダー1px×2 = 18pxを差し引く）
            const descriptionContainer = n.querySelector('.node-description');
            const descriptionHeight = descriptionContainer ? Math.max(20, descriptionContainer.offsetHeight - 18) : 50;
            
            const portTypes = Array.from(sockets).map(socket => ({
                portType: socket.dataset.currentPortType || '-',
                portLabel: socket.querySelector('.port-type-label')?.textContent || '-',
                portMemo: socket.querySelector('.port-label')?.value ?? ''
            }));

            const plugs = n.querySelectorAll('.plug-port');
            const plugMemos = Array.from(plugs).map(plug => ({
                plugMemo: plug.querySelector('.port-label')?.value ?? ''
            }));

            return {
                id: n.id,
                type,
                x,
                y,
                width,
                height,
                name,
                socketCount,
                plugCount,
                color,
                iconSvg,
                nodeMemo,
                description,
                descriptionHeight,
                portTypes,
                plugMemos
            };
        });

        const state = {
            version: 1,
            zoomLevel,
            workspaceOffset: { ...workspaceOffset },
            nodes,
            connections: connections.map(conn => ({
                fromNodeId: conn.fromNodeId,
                fromPortIndex: conn.fromPortIndex,
                toNodeId: conn.toNodeId,
                toPlugIndex: conn.toPlugIndex || 0
            }))
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
        // localStorageが使えない環境でも動作は継続
    }
}

function restoreWorkspaceState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        console.log('📦 Stored data exists:', !!raw, 'Key:', STORAGE_KEY);
        
        const state = JSON.parse(raw);
        if (!state || state.version !== 1) return false;

        isRestoring = true;

        // 既存データをクリア
        nodesLayer.innerHTML = '';
        const dragLine = connectionsLayer.querySelector('.cable-drag');
        connectionsLayer.innerHTML = '';
        if (dragLine) connectionsLayer.appendChild(dragLine);
        connections.length = 0;

        // ズーム・パン復元
        zoomLevel = typeof state.zoomLevel === 'number' ? state.zoomLevel : 1.0;
        workspaceOffset = state.workspaceOffset ? { ...state.workspaceOffset } : { x: 0, y: 0 };
        updateWorkspaceTransform();

        // ノード復元
        if (Array.isArray(state.nodes)) {
            console.log('✅ Restoring nodes:', state.nodes.length);
            state.nodes.forEach(n => {
                const nodeEl = createNode(n.type, n.x, n.y, n.id);
                const nameInput = nodeEl.querySelector('.node-name');
                if (nameInput && typeof n.name === 'string') nameInput.value = n.name;

                if (typeof n.socketCount === 'number') {
                    setSocketCount(nodeEl, Math.max(0, n.socketCount));
                }

                if (typeof n.plugCount === 'number') {
                    setPlugCount(nodeEl, Math.max(0, n.plugCount));
                }

                if (typeof n.width === 'number' && n.width > 0) {
                    nodeEl.style.width = n.width + 'px';
                    updateNodeSocketsGap(nodeEl, n.width);
                }
                if (typeof n.height === 'number' && n.height > 0) {
                    nodeEl.style.height = n.height + 'px';
                }

                if (n.color) {
                    applyNodeColor(nodeEl, n.color);
                }

                if (n.iconSvg) {
                    const iconSpan = nodeEl.querySelector('.node-icon');
                    if (iconSpan) {
                        iconSpan.innerHTML = n.iconSvg;
                    }
                }

                if (n.nodeMemo) {
                    const nodeMemoEl = nodeEl.querySelector('.node-memo');
                    if (nodeMemoEl) {
                        nodeMemoEl.value = n.nodeMemo;
                    }
                }

                // 説明を復元
                if (n.description) {
                    const descriptionInput = nodeEl.querySelector('.description-input');
                    if (descriptionInput) {
                        descriptionInput.value = n.description;
                    }
                }

                // 説明コンテナの高さを復元
                if (typeof n.descriptionHeight === 'number' && n.descriptionHeight > 0) {
                    const descriptionContainer = nodeEl.querySelector('.node-description');
                    if (descriptionContainer) {
                        descriptionContainer.style.height = n.descriptionHeight + 'px';
                    }
                }
                
                if (Array.isArray(n.portTypes)) {
                    const sockets = Array.from(nodeEl.querySelectorAll('.socket-port'));
                    n.portTypes.forEach((portInfo, index) => {
                        if (sockets[index] && portInfo) {
                            sockets[index].dataset.currentPortType = portInfo.portType;
                            const label = sockets[index].querySelector('.port-type-label');
                            if (label) {
                                label.textContent = portInfo.portLabel || '-';
                                label.title = portInfo.portType !== '-' ? portInfo.portType : '';
                            }
                            // メモを復元
                            const portMemoEl = sockets[index].querySelector('.port-label');
                            if (portMemoEl && portInfo.portMemo) {
                                portMemoEl.value = portInfo.portMemo;
                            }
                        }
                    });
                }

                // プラグメモ復元
                if (Array.isArray(n.plugMemos)) {
                    const plugs = Array.from(nodeEl.querySelectorAll('.plug-port'));
                    n.plugMemos.forEach((plugInfo, index) => {
                        if (plugs[index] && plugInfo && plugInfo.plugMemo) {
                            const plugMemoEl = plugs[index].querySelector('.port-label');
                            if (plugMemoEl) {
                                plugMemoEl.value = plugInfo.plugMemo;
                            }
                        }
                    });
                }
            });
        }

        // ケーブル接続復元
        if (Array.isArray(state.connections)) {
            state.connections.forEach(c => {
                if (!c) return;
                if (!document.getElementById(c.toNodeId)) return;
                if (!document.getElementById(c.fromNodeId)) return;
                connections.push({ 
                    fromNodeId: c.fromNodeId, 
                    fromPortIndex: parseInt(c.fromPortIndex, 10) || 0,
                    toNodeId: c.toNodeId,
                    toPlugIndex: parseInt(c.toPlugIndex, 10) || 0
                });
            });
        }

        renderAllConnections();

        return true;
    } catch (err) {
        console.error('❌ Restore error:', err);
        return false;
    } finally {
        isRestoring = false;
    }
}

// ===== エクスポート/インポート機能 =====

function exportWorkspace() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            alert('保存されたデータがありません。');
            return;
        }

        const state = JSON.parse(raw);
        const filename = `workspace-${new Date().toISOString().slice(0, 10)}.json`;
        const dataStr = JSON.stringify(state, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('✅ Workspace exported:', filename);
    } catch (err) {
        console.error('❌ Export error:', err);
        alert('エクスポート中にエラーが発生しました。');
    }
}

function importWorkspace() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            console.log('❌ No file selected');
            return;
        }

        console.log('📂 File selected:', file.name);
        
        // 保留中の自動保存をキャンセル
        if (saveTimer) {
            clearTimeout(saveTimer);
            console.log('⏸️ Cancelled pending save');
        }
        
        const reader = new FileReader();
        
        reader.onerror = () => {
            console.error('❌ FileReader error:', reader.error);
            alert('ファイルの読み込みに失敗しました。');
        };
        
        reader.onload = (event) => {
            try {
                console.log('📄 File content length:', event.target.result.length);
                const state = JSON.parse(event.target.result);
                console.log('✅ JSON parsed successfully');
                console.log('📦 State object:', state);
                
                // バージョン確認
                if (!state || state.version !== 1) {
                    console.error('❌ Invalid version:', state?.version);
                    alert('不正なフォーマットです。このファイルは対応していません。');
                    return;
                }

                console.log('🔍 About to show confirmation dialog...');
                // 確認ダイアログ
                const shouldImport = confirm('現在の作業内容を上書きします。よろしいですか？');
                console.log('✋ Dialog result:', shouldImport);
                
                if (!shouldImport) {
                    console.log('📌 Import cancelled by user');
                    return;
                }

                console.log('💾 Starting to save data to localStorage...');
                
                // 再度、保留中の自動保存をキャンセル（念のため）
                if (saveTimer) {
                    clearTimeout(saveTimer);
                    console.log('⏸️ Cancelled pending save (again)');
                }
                
                // isRestoring フラグを設定して、自動保存ロジックを防止
                isRestoring = true;
                console.log('🔒 Set isRestoring = true');
                
                // localStorageに保存
                const jsonString = JSON.stringify(state);
                console.log('🔤 JSON string length:', jsonString.length);
                
                try {
                    localStorage.setItem(STORAGE_KEY, jsonString);
                    console.log('✅ localStorage.setItem() succeeded');
                } catch (storageErr) {
                    console.error('❌ localStorage.setItem() failed:', storageErr);
                    isRestoring = false;
                    alert('ストレージへの保存に失敗しました: ' + storageErr.message);
                    return;
                }
                
                console.log('💾 Data saved to localStorage, key:', STORAGE_KEY);
                console.log('✅ Workspace imported, reloading page in 200ms...');
                
                // ページをリロード（isRestoring フラグが true のため、自動保存は実行されない）
                setTimeout(() => {
                    console.log('🔄 Executing location.reload()...');
                    location.reload();
                }, 200);
            } catch (err) {
                console.error('❌ Import error:', err);
                console.error('Error stack:', err.stack);
                isRestoring = false;
                alert('ファイルの読み込みに失敗しました: ' + err.message);
            }
        };
        
        console.log('📖 Reading file as text...');
        reader.readAsText(file);
    });
    
    input.click();
}
