// 圖片壓縮工具
export const compressImage = async (file, { maxWidth = 1280, quality = 0.7 } = {}) => {
    // 如果不是圖片，直接回傳原檔案
    if (!file.type.startsWith('image/')) return file;
  
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        
        img.onload = () => {
          // 計算新的尺寸，保持長寬比
          let width = img.width;
          let height = img.height;
  
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
  
          // 建立 Canvas 繪製
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
  
          // 轉出 Blob (強制轉為 JPEG 以獲得最佳壓縮率)
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Canvas is empty'));
              return;
            }
            
            // 修正副檔名為 .jpg
            const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            
            const compressedFile = new File([blob], newName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            
            console.log(`壓縮完成: ${(file.size / 1024).toFixed(1)}KB -> ${(compressedFile.size / 1024).toFixed(1)}KB`);
            resolve(compressedFile);
          }, 'image/jpeg', quality);
        };
        
        img.onerror = (error) => reject(error);
      };
      
      reader.onerror = (error) => reject(error);
    });
  };