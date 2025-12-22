// 这是一个新的 Helper 檔案，用來處理資料解析問題

/**
 * 安全解析圖片欄位
 * 相容 JSON 陣列字串、單一網址字串、或是已經是陣列的資料
 */
export const safeParseImages = (data) => {
  if (!data) return [];
  
  // 如果已經是陣列，直接回傳
  if (Array.isArray(data)) return data;
  
  try {
    // 嘗試解析 JSON
    const parsed = JSON.parse(data);
    // 如果解析出來是陣列，回傳；如果是單一字串，包成陣列
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    // 如果 JSON.parse 失敗 (例如遇到 "https://...")，
    // 就把原始資料當作單一字串處理，並包成陣列
    // 這樣就不會讓程式崩潰了
    return typeof data === 'string' ? [data] : [];
  }
};