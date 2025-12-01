import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // 引入 Quill 樣式

export const RichTextEditor = ({ value, onChange, placeholder }) => {
  const modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'clean']
    ]
  };

  return (
    <div className="bg-white rounded-lg overflow-hidden">
      <ReactQuill 
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder || '寫些什麼...'}
        modules={modules}
      />
    </div>
  );
};