// ===== ポート型管理（ドロップダウン） =====

function reindexSocketPorts(node) {
    // ポート削除後、残っているポート要素のdata-portIndexを再計算
    const socketsContainer = node.querySelector('.sockets-container');
    if (!socketsContainer) return;
    
    const socketPorts = socketsContainer.querySelectorAll('.socket-port');
    socketPorts.forEach((port, newIndex) => {
        port.dataset.portIndex = newIndex;
    });
    
    // setupOutputPortを再度呼び出して、新しいインデックスでイベントハンドラを再設定
    socketPorts.forEach((port, newIndex) => {
        // 古いイベントリスナーをクローンで置き換えるため、再度setupOutputPortを呼び出す
        // ただし、すでにセットアップ済みのポートを再度セットアップすると、重複するリスナーが出来る
        // そのため、removeBtn以外のリスナー設定済みフラグを確認する必要がある
        // 簡略化のため、ここではデータ属性のみ更新し、イベントハンドラはそのポート内で data-portIndex を参照するように修正
    });
}

function initPortTypeDropdown(socketEl, node, socketIndex) {
    const dropdown = socketEl.querySelector('.port-type-dropdown');
    if (!dropdown) return;
    
    if (dropdown.dataset.initialized === 'true') return;
    if (!portTypeData || Object.keys(portTypeData).length === 0) return;
    
    dropdown.dataset.initialized = 'true';
    const typeLabel = socketEl.querySelector('.port-type-label');
    dropdown.innerHTML = '';
    
    // Object.keys()をキャッシュ化して重複計算を削減
    const genres = Object.keys(portTypeData);
    genres.forEach(genre => {
        const genreBtn = document.createElement('div');
        genreBtn.className = 'port-genre-btn';
        genreBtn.textContent = genre;

        const subMenu = document.createElement('div');
        subMenu.className = 'port-sub-menu';

        portTypeData[genre].forEach(type => {
            const typeBtn = document.createElement('div');
            typeBtn.textContent = type;
            typeBtn.dataset.type = type;
            
            // イベントリスナーを正しい場所に配置
            typeBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                socketEl.dataset.currentPortType = type;
                if (typeLabel) {
                    const shortLabel = type.length > 10 ? type.substring(0, 10) + '...' : type;
                    typeLabel.textContent = shortLabel;
                    typeLabel.title = type;
                }
                dropdown.style.display = 'none';
                requestSaveWorkspace();
            });

            subMenu.appendChild(typeBtn);
        });

        genreBtn.appendChild(subMenu);
        genreBtn.addEventListener('mouseenter', () => {
            subMenu.classList.add('visible');
        });
        genreBtn.addEventListener('mouseleave', () => {
            subMenu.classList.remove('visible');
        });

        dropdown.appendChild(genreBtn);
    });
    
    dropdown.addEventListener('mouseleave', () => {
        dropdown.querySelectorAll('.port-sub-menu').forEach(subm => {
            subm.classList.remove('visible');
        });
    });
}

function setupOutputPort(portEl, node, index) {
    // 既に初期化済みの場合はスキップ
    if (portEl.dataset.outputPortSetup === 'true') {
        portEl.dataset.portIndex = index;
        return;
    }
    
    portEl.dataset.outputPortSetup = 'true';
    portEl.dataset.portType = 'output';
    portEl.dataset.nodeId = node.id;
    portEl.dataset.portIndex = index;
    
    const dropdown = portEl.querySelector('.port-type-dropdown');
    const portLabel = portEl.querySelector('.port-label');
    const portPoint = portEl.querySelector('.port-point');
    const selector = portEl.querySelector('.port-type-selector');
    const removeBtn = portEl.querySelector('.remove-socket-btn');
    
    // ポート型セレクターのクリックでドロップダウンをtoggle
    if (selector && dropdown) {
        selector.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCurrentlyOpen = dropdown.style.display !== 'none' && dropdown.style.display !== '';
            
            document.querySelectorAll('.port-type-dropdown').forEach(d => {
                d.style.display = 'none';
            });
            
            if (dropdown) {
                dropdown.style.display = isCurrentlyOpen ? 'none' : 'block';
            }
        });
    }

    // ポイント（丸）のドラッグでケーブル接続
    if (portPoint) {
        portPoint.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (dropdown) dropdown.style.display = 'none';
            // indexはクロージャで保持されるため、portEl.dataset.portIndexから取得
            const currentIndex = parseInt(portEl.dataset.portIndex, 10) || 0;
            startCableDrag(node.id, currentIndex, 'output', e.clientX, e.clientY);
        });
    }

    // ラベルをクリック時にドロップダウンを閉じる
    if (portLabel) {
        portLabel.addEventListener('focus', (e) => {
            e.stopPropagation();
            if (dropdown) dropdown.style.display = 'none';
        });
    }

    // 削除ボタン
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // クロージャの portEl に依存せず、実行時に正確なポート要素を取得
            const socketElement = e.currentTarget.closest('.socket-port');
            if (!socketElement) return;
            
            // ソケットが1つだけの場合は削除を無効化
            const socketCount = node.querySelectorAll('.socket-port').length;
            if (socketCount <= 1) {
                return;
            }
            
            // このポートに接続されているケーブルを削除
            const nodeId = node.id;
            const deletedPortIndex = parseInt(socketElement.dataset.portIndex, 10) || 0;
            
            // 出力ポート（output）の場合：このポートから出ているケーブルを削除
            if (socketElement.dataset.portType === 'output') {
                // 削除対象のケーブルを配列から削除（後ろから削除してインデックスのズレを防ぐ）
                for (let i = connections.length - 1; i >= 0; i--) {
                    const conn = connections[i];
                    if (conn.fromNodeId === nodeId && conn.fromPortIndex === deletedPortIndex) {
                        connections.splice(i, 1);
                    }
                }
                
                // 削除されたポートより後のポートのケーブル接続情報を更新
                connections.forEach(conn => {
                    if (conn.fromNodeId === nodeId && conn.fromPortIndex > deletedPortIndex) {
                        conn.fromPortIndex = conn.fromPortIndex - 1;
                    }
                });
            }
            // 入力ポート（input）の場合：このポートへ入ってくるケーブルを削除
            else if (socketElement.dataset.portType === 'input') {
                const plugIndex = parseInt(socketElement.dataset.plugIndex, 10) || 0;
                // 削除対象のケーブルを配列から削除
                for (let i = connections.length - 1; i >= 0; i--) {
                    const conn = connections[i];
                    if (conn.toNodeId === nodeId && conn.toPlugIndex === plugIndex) {
                        connections.splice(i, 1);
                    }
                }
                // 削除されたポートより後のポートの接続インデックスを更新
                connections.forEach(conn => {
                    if (conn.toNodeId === nodeId && conn.toPlugIndex > plugIndex) {
                        conn.toPlugIndex = conn.toPlugIndex - 1;
                    }
                });
            }
            
            // このポート要素を直接削除
            socketElement.remove();
            // ポートインデックスを再計算
            reindexSocketPorts(node);
            // ノード幅を調整
            adjustNodeWidth(node);
            // gap を更新
            updateNodeSocketsGap(node, node.offsetWidth);
            // 上部ポートのギャップも再計算
            updatePlugSocketsGap(node);
            
            // ソケット数が1つになった場合、中央配置に変更
            const socketsContainer = node.querySelector('.sockets-container');
            const remainingSocketCount = node.querySelectorAll('.socket-port').length;
            if (socketsContainer) {
                if (remainingSocketCount === 1) {
                    socketsContainer.classList.add('single-socket');
                } else {
                    socketsContainer.classList.remove('single-socket');
                }
            }
            
            // ケーブルを再描画
            renderAllConnections();
            // 保存
            requestSaveWorkspace();
        });
        removeBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    }
}

function setupInputPort(portEl, node) {
    // 既に初期化済みの場合はスキップ
    if (portEl.dataset.inputPortSetup === 'true') {
        return;
    }
    
    portEl.dataset.inputPortSetup = 'true';
    portEl.dataset.portType = 'input';
    portEl.dataset.nodeId = node.id;
    
    // ポイントのドラッグ処理
    const point = portEl.querySelector('.port-point');
    if (point) {
        point.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const plugIndex = parseInt(portEl.dataset.plugIndex, 10);
            
            // このプラグへの接続を確認
            const existingConn = connections.find(
                (conn) => conn.toNodeId === node.id && conn.toPlugIndex === plugIndex
            );
            if (existingConn) {
                removeConnection(existingConn.toNodeId, existingConn.toPlugIndex);
                return;
            }
            
            startCableDrag(node.id, plugIndex, 'input', e.clientX, e.clientY);
        });
    }

    // メモ入力フィールド
    const label = portEl.querySelector('.port-label');
    if (label) {
        label.addEventListener('mousedown', (e) => e.stopPropagation());
        label.addEventListener('input', () => requestSaveWorkspace());
    }

    // 削除ボタンの処理
    const removeBtn = portEl.querySelector('.remove-plug-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // クロージャの portEl に依存せず、実行時に正確なプラグ要素を取得
            const plugElement = e.currentTarget.closest('.plug-port');
            const plugIndex = parseInt(plugElement.dataset.plugIndex, 10);

            // プラグが1つだけの場合は削除を無効化
            const plugCount = node.querySelectorAll('.plug-port').length;
            if (plugCount <= 1) {
                return;
            }

            // このプラグに接続しているすべてのケーブルを削除
            for (let i = connections.length - 1; i >= 0; i--) {
                const conn = connections[i];
                if (conn.toNodeId === node.id && conn.toPlugIndex === plugIndex) {
                    connections.splice(i, 1);
                }
            }

            // このプラグを削除
            plugElement.remove();

            // 後続のプラグのインデックスを更新
            reindexPlugPorts(node);

            // 後続の接続インデックスを更新
            connections.forEach(conn => {
                if (conn.toNodeId === node.id && conn.toPlugIndex > plugIndex) {
                    conn.toPlugIndex--;
                }
            });

            // ノード幅を調整
            adjustNodeWidth(node);
            // 上部ポートのギャップを再計算
            updatePlugSocketsGap(node);
            
            // プラグ数が1つになった場合、中央配置に変更
            const plugContainer = node.querySelector('.plug-container');
            const remainingPlugCount = node.querySelectorAll('.plug-port').length;
            if (plugContainer) {
                if (remainingPlugCount === 1) {
                    plugContainer.classList.add('single-plug');
                } else {
                    plugContainer.classList.remove('single-plug');
                }
            }
            
            // ケーブルを再描画
            renderAllConnections();
            // 保存
            requestSaveWorkspace();
        });
    }
}

function reindexPlugPorts(node) {
    const plugs = Array.from(node.querySelectorAll('.plug-port'));
    plugs.forEach((plug, idx) => {
        plug.dataset.plugIndex = idx;
    });
}

