// ===== ユーティリティ関数 =====

function hexToRgb(hex) {
    // rgb形式の場合（例：rgb(76, 175, 80)）
    if (hex && hex.startsWith('rgb')) {
        const result = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i.exec(hex);
        if (result) {
            return {
                r: parseInt(result[1], 10),
                g: parseInt(result[2], 10),
                b: parseInt(result[3], 10)
            };
        }
    }
    
    // hex形式の場合（例：#4CAF50）
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}
