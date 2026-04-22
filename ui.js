// ===== UI操作（色・アイコン選択） =====

function showIconPickerMenu(node) {
    // 既存モーダルを削除
    const existingModal = document.querySelector('.icon-modal');
    if (existingModal) existingModal.remove();

    // SVGファイルのリストを取得
    const svgFiles = [
        // 新しく追加（1,2,3番目）
        { name: 'ライン開始', file: 'line_start_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'バイタルサイン', file: 'vital_signs_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'ライン終了', file: 'line_end_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        // 既存アイテム（削除対象3つ除外）
        { name: 'バッテリー', file: 'battery_5_bar_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: '電源', file: 'bolt_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'ブランド', file: 'brand_awareness_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'ケーブル', file: 'cable_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'コード', file: 'deployed_code_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'デバイス', file: 'devices_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'ヘッドホン', file: 'headphones_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'ホーム', file: 'home_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'キー', file: 'key_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: '電子レンジ', file: 'microwave_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'マイク', file: 'mic_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'カメラ', file: 'photo_camera_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'フレーム', file: 'photo_frame_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'コンポーネント', file: 'settings_input_component_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'ショッピング', file: 'shopping_cart_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'スピーカー', file: 'speaker_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'コントローラ', file: 'stadia_controller_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'スイッチ', file: 'switch_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'タイマー', file: 'timer_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: '電球', file: 'wb_incandescent_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
        { name: 'Wifi', file: 'wifi_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg' },
    ];

    // モーダルを作成
    const modal = document.createElement('div');
    modal.className = 'icon-modal';
    modal.style.position = 'fixed';
    modal.style.zIndex = '10000';
    modal.style.background = '#f9f9f9';
    modal.style.border = '2px solid #333';
    modal.style.borderRadius = '6px';
    modal.style.padding = '0px';
    modal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    modal.style.minWidth = '280px';
    modal.style.maxHeight = '400px';
    modal.style.overflowY = 'auto';
    modal.style.overflowX = 'hidden';

    // アイコングリッド
    const iconGrid = document.createElement('div');
    iconGrid.style.display = 'grid';
    iconGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    iconGrid.style.gap = '0px';

    svgFiles.forEach((iconInfo) => {
        const iconBtn = document.createElement('div');
        iconBtn.style.display = 'flex';
        iconBtn.style.flexDirection = 'column';
        iconBtn.style.alignItems = 'center';
        iconBtn.style.justifyContent = 'center';
        iconBtn.style.padding = '0px';
        iconBtn.style.border = 'none';
        iconBtn.style.borderRadius = '0px';
        iconBtn.style.cursor = 'pointer';
        iconBtn.style.transition = 'all 0.2s';
        iconBtn.style.height = '70px';
        iconBtn.style.width = '70px';
        iconBtn.style.backgroundColor = 'transparent';

        // アイコン画像
        const imgContainer = document.createElement('div');
        imgContainer.style.width = '24px';
        imgContainer.style.height = '24px';
        imgContainer.style.marginBottom = '0px';
        
        const img = document.createElement('img');
        img.src = `svgs/${iconInfo.file}`;
        img.style.width = '100%';
        img.style.height = '100%';
        imgContainer.appendChild(img);

        iconBtn.appendChild(imgContainer);

        // ホバー効果
        iconBtn.addEventListener('mouseenter', () => {
            iconBtn.style.transform = 'scale(1.15)';
        });
        iconBtn.addEventListener('mouseleave', () => {
            iconBtn.style.transform = 'scale(1)';
        });

        // クリックイベント
        iconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const iconSpan = node.querySelector('.node-icon');
            if (iconSpan) {
                iconSpan.innerHTML = `<img src="svgs/${iconInfo.file}" style="width: 100%; height: 100%;" />`;
                requestSaveWorkspace();
            }
            modal.remove();
        });

        iconGrid.appendChild(iconBtn);
    });

    modal.appendChild(iconGrid);

    // モーダル位置設定
    const nodeRect = node.getBoundingClientRect();
    const modalX = Math.min(nodeRect.right + 10, window.innerWidth - 350);
    const modalY = nodeRect.top;

    modal.style.left = modalX + 'px';
    modal.style.top = modalY + 'px';

    document.body.appendChild(modal);

    // モーダル外クリックで閉じる
    function closeIconModal(e) {
        if (!modal.contains(e.target)) {
            if (modal.parentElement) {
                modal.remove();
            }
            document.removeEventListener('click', closeIconModal);
        }
    }
    
    document.addEventListener('click', closeIconModal);
}

function showColorModal(node) {
    const existingModal = document.querySelector('.color-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'color-modal';
    modal.style.position = 'fixed';
    modal.style.zIndex = '10000';
    modal.style.background = '#f9f9f9';
    modal.style.border = '2px solid #333';
    modal.style.borderRadius = '6px';
    modal.style.padding = '12px';
    modal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    modal.style.minWidth = '200px';

    const colorContainer = document.createElement('div');
    colorContainer.style.display = 'grid';
    colorContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
    colorContainer.style.gap = '6px';

    const colorPalette = node.querySelector('.color-palette');
    const colorBtns = colorPalette ? colorPalette.querySelectorAll('.color-btn') : [];
    
    colorBtns.forEach(btn => {
        const color = btn.dataset.color;
        const colorBtn = document.createElement('button');
        colorBtn.style.width = '40px';
        colorBtn.style.height = '40px';
        colorBtn.style.border = '2px solid #ddd';
        colorBtn.style.borderRadius = '4px';
        colorBtn.style.backgroundColor = color;
        colorBtn.style.cursor = 'pointer';
        colorBtn.style.transition = 'all 0.2s';

        colorBtn.addEventListener('mouseenter', () => {
            colorBtn.style.borderColor = '#333';
            colorBtn.style.transform = 'scale(1.1)';
        });
        colorBtn.addEventListener('mouseleave', () => {
            colorBtn.style.borderColor = '#ddd';
            colorBtn.style.transform = 'scale(1)';
        });

        colorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            applyNodeColor(node, color);
            modal.remove();
            requestSaveWorkspace();
        });

        colorContainer.appendChild(colorBtn);
    });

    modal.appendChild(colorContainer);

    const nodeRect = node.getBoundingClientRect();
    const modalX = nodeRect.right + 10;
    const modalY = nodeRect.top;

    modal.style.left = modalX + 'px';
    modal.style.top = modalY + 'px';

    document.body.appendChild(modal);
    
    // モーダル外クリックで閉じる
    function closeModal(e) {
        if (!modal.contains(e.target)) {
            if (modal.parentElement) {
                modal.remove();
            }
            document.removeEventListener('click', closeModal);
        }
    }
    
    document.addEventListener('click', closeModal);
}
