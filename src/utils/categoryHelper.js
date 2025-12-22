export const getCategoryInfo = (item, categories) => {
    const categoryMap = {};
    if (categories) {
        categories.forEach(c => categoryMap[c.firestoreId] = c);
    }

    // 1. 優先比對 categoryId
    if (item.categoryId && categoryMap[item.categoryId]) {
        return { ...categoryMap[item.categoryId], found: true };
    }
    // 2. 如果只有 ID 但找不到對應 (可能被刪除)，顯示未知
    if (item.categoryId) {
        return { label: '未知分類', color: '#9ca3af', found: false };
    }
    // 3. 舊資料相容 (只有文字 label)
    return { 
        label: item.category || '一般', 
        color: '#f3f4f6', 
        textColor: '#4b5563', 
        found: false 
    };
};