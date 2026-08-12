/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './main.css';

const rootElement = document.getElementById('bring-any-idea-to-life-khanh-root');
if (!rootElement) {
  console.warn('[bring-any-idea-to-life-khanh] Không tìm thấy phần tử #bring-any-idea-to-life-khanh-root trong DOM — bỏ qua khởi tạo thay vì crash.');
} else {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
