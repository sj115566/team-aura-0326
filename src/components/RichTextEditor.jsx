import React, { useMemo, useRef, useEffect, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // 引入 Quill 樣式
import { Icon } from './Icons';

// 取得 Quill 的 Delta 物件，用於處理剪貼簿邏輯
const Quill = ReactQuill.Quill;
const Delta = Quill.import('delta');

export const RichTextEditor = ({ value, onChange, placeholder, onImageUpload }) => {
  const quillRef = useRef(null);
  const onImageUploadRef = useRef(onImageUpload);
  onImageUploadRef.current = onImageUpload;

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image', 'clean']
      ],
      handlers: {
        image: () => {
            const input = document.createElement('input');
            input.setAttribute('type', 'file');
            input.setAttribute('accept', 'image/*');
            input.setAttribute('multiple', 'true');
            input.click();

            input.onchange = async () => {
                const files = Array.from(input.files);
                if (files.length > 0 && onImageUploadRef.current) {
                    for (const file of files) {
                        try {
                            const url = await onImageUploadRef.current(file);
                            const quill = quillRef.current.getEditor();
                            const currentSelection = quill.getSelection(true);
                            const index = currentSelection ? currentSelection.index : quill.getLength();
                            quill.insertEmbed(index, 'image', url);
                            setTimeout(() => {
                                try {
                                    quill.focus();
                                    const newIndex = quill.getLength(); 
                                    quill.setSelection(newIndex); 
                                } catch (e) {
                                    console.warn("Selection restore failed:", e);
                                }
                            }, 0);
                        } catch (error) {
                            console.error("Image upload failed:", error);
                            alert(`圖片 ${file.name} 上傳失敗，請稍後再試`);
                        }
                    }
                }
            };
        }
      }
    },
    clipboard: {
        matchers: [
            ['img', (node, delta) => {
                if (node.src && node.src.startsWith('data:')) {
                    console.warn("Blocked base64 image paste");
                    return new Delta();
                }
                return delta; 
            }]
        ]
    }
  }), []);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'color', 'background', 'align'
  ];

  return (
    // 修改：加入 dark:bg-slate-900 dark:border-slate-700
    <div className="bg-white rounded-lg overflow-hidden border border-gray-200 flex flex-col dark:bg-slate-900 dark:border-slate-700">
      <ReactQuill 
        ref={quillRef}
        theme="snow"
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder || '寫些什麼...'}
        modules={modules}
        formats={formats}
        className="custom-quill flex-1"
      />
      {/* 修改：底部提示列深色化 */}
      <div className="bg-gray-50 text-[10px] text-gray-400 p-1 text-center border-t border-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500">
         💡 提示：已停用直接貼上圖片功能，請使用上方圖片按鈕上傳 (支援多選)。
      </div>
    </div>
  );
};