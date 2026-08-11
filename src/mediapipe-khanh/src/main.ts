/**
 * Copyright 2026 The MediaPipe Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import './app_clean.css';
import { setupObjectDetector, cleanupObjectDetector } from './tasks/object-detector';
import { setupImageSegmenter, cleanupImageSegmenter } from './tasks/image-segmenter';
import { setupAudioClassifier, cleanupAudioClassifier } from './tasks/audio-classifier';
import { setupTextClassifier, cleanupTextClassifier } from './tasks/text-classifier';
import { setupTextEmbedder, cleanupTextEmbedder } from './tasks/text-embedder';
import { setupFaceDetector, cleanupFaceDetector } from './tasks/face-detector';
import { setupFaceLandmarker, cleanupFaceLandmarker } from './tasks/face-landmarker';
import { setupHandLandmarker, cleanupHandLandmarker } from './tasks/hand-landmarker';
import { setupPoseLandmarker, cleanupPoseLandmarker } from './tasks/pose-landmarker';
import { setupGestureRecognizer, cleanupGestureRecognizer } from './tasks/gesture-recognizer';
import { setupLanguageDetector, cleanupLanguageDetector } from './tasks/language-detector';
import { setupImageEmbedder, cleanupImageEmbedder } from './tasks/image-embedder';
import { setupInteractiveSegmenter, cleanupInteractiveSegmenter } from './tasks/interactive-segmenter';
import { setupHolisticLandmarker, cleanupHolisticLandmarker } from './tasks/holistic-landmarker';
import { setupImageClassifier, cleanupImageClassifier } from './tasks/image-classifier';

import { renderSidebar } from './ui/sidebar';
import { renderMobileNav } from './ui/mobile-nav';

// Bọc toàn bộ phần khởi tạo trong boot()/init() thay vì chạy thẳng ở top-level
// như trước — phòng trường hợp hiếm gặp document.querySelector('#app') trả về
// null (VD: trình duyệt/webview nào đó thực thi module script sớm hơn dự kiến),
// gây crash trắng trang với "Cannot set properties of null (setting
// 'innerHTML')". Nếu không thấy #app ngay, đợi DOMContentLoaded rồi thử lại
// đúng 1 lần; nếu vẫn không có thì chỉ log lỗi, không throw.
function init(app: HTMLDivElement) {
  // 1. Setup App Shell
  app.innerHTML = `
    <div class="app-container">
      <aside class="sidebar"></aside>
      <div class="sidebar-backdrop"></div>
      <div class="mobile-header">
         <button class="menu-toggle material-icons" style="margin-right: 12px; color: var(--text-secondary); background: none; border: none; font-size: 24px; cursor: pointer;">menu</button>
         <div id="mobile-nav-container" style="display: flex; align-items: center; flex-grow: 1;"></div>
      </div>
      <main class="main-content"></main>
    </div>
  `;

  // 2. Render Global Components
  const sidebar = app.querySelector('.sidebar') as HTMLElement;
  renderSidebar(sidebar);

  const sidebarBackdrop = app.querySelector('.sidebar-backdrop') as HTMLElement;
  const mobileNavContainer = app.querySelector('#mobile-nav-container') as HTMLElement;
  renderMobileNav(mobileNavContainer);

  // 3. Setup Navigation Logic
  const closeSidebar = () => {
    sidebar.classList.remove('open');
    sidebarBackdrop.classList.remove('open');
  };
  const menuToggles = app.querySelectorAll('.menu-toggle');
  menuToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const willOpen = !sidebar.classList.contains('open');
      sidebar.classList.toggle('open', willOpen);
      sidebarBackdrop.classList.toggle('open', willOpen);
    });
  });

  // Tap outside the menu (on the backdrop) to close it again
  sidebarBackdrop.addEventListener('click', closeSidebar);

  // Close sidebar when a link is clicked
  sidebar.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) {
      closeSidebar();
    }
  });

  const mainContent = app.querySelector('.main-content') as HTMLElement;

  // 4. Router Setup
  const routes = {
    '/vision/object_detector': {
      setup: setupObjectDetector,
      cleanup: cleanupObjectDetector,
      label: 'Object Detector',
    },
    '/vision/face_detector': { setup: setupFaceDetector, cleanup: cleanupFaceDetector, label: 'Face Detector' },
    '/vision/face_landmarker': { setup: setupFaceLandmarker, cleanup: cleanupFaceLandmarker, label: 'Face Landmarker' },
    '/vision/hand_landmarker': { setup: setupHandLandmarker, cleanup: cleanupHandLandmarker, label: 'Hand Landmarker' },
    '/vision/pose_landmarker': { setup: setupPoseLandmarker, cleanup: cleanupPoseLandmarker, label: 'Pose Landmarker' },
    '/vision/holistic_landmarker': {
      setup: setupHolisticLandmarker,
      cleanup: cleanupHolisticLandmarker,
      label: 'Holistic Landmarker',
    },
    '/vision/image_classifier': {
      setup: setupImageClassifier,
      cleanup: cleanupImageClassifier,
      label: 'Image Classifier',
    },
    '/vision/gesture_recognizer': {
      setup: setupGestureRecognizer,
      cleanup: cleanupGestureRecognizer,
      label: 'Gesture Recognizer',
    },
    '/vision/interactive_segmenter': {
      setup: setupInteractiveSegmenter,
      cleanup: cleanupInteractiveSegmenter,
      label: 'Interactive Segmenter',
    },
    '/vision/image_segmenter': {
      setup: setupImageSegmenter,
      cleanup: cleanupImageSegmenter,
      label: 'Image Segmenter',
    },
    '/vision/image_embedder': { setup: setupImageEmbedder, cleanup: cleanupImageEmbedder, label: 'Image Embedder' },
    '/audio/audio_classifier': {
      setup: setupAudioClassifier,
      cleanup: cleanupAudioClassifier,
      label: 'Audio Classifier',
    },
    '/text/text_classifier': {
      setup: setupTextClassifier,
      cleanup: cleanupTextClassifier,
      label: 'Text Classifier',
    },
    '/text/language_detector': {
      setup: setupLanguageDetector,
      cleanup: cleanupLanguageDetector,
      label: 'Language Detector',
    },
    '/text/text_embedder': { setup: setupTextEmbedder, cleanup: cleanupTextEmbedder, label: 'Text Embedder' },
  };

  let currentCleanup: (() => void) | undefined;

  async function router() {
    let hash = window.location.hash.slice(1);

    // Handle root or invalid routes by defaulting to object detector
    if (!hash || !routes[hash as keyof typeof routes]) {
      hash = '/vision/object_detector';
      window.location.hash = hash;
    }

    const route = routes[hash as keyof typeof routes];

    // Cleanup previous task
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = undefined;
    }

    // Clear main content area only
    mainContent.innerHTML = '';

    // Setup new task
    if (route) {
      await route.setup(mainContent);
      currentCleanup = route.cleanup;
      document.title = `${route.label} - MediaPipe Web Task Demo`;

      // Update active state in sidebar
      const links = sidebar.querySelectorAll('a');
      links.forEach((l) => {
        if (l.getAttribute('href') === `#${hash}`) l.classList.add('active');
        else l.classList.remove('active');
      });
    }
  }

  window.addEventListener('hashchange', router);
  window.addEventListener('load', router);

  // Initialize router immediately to handle initial load
  router();

  // Expose cleanup method for testing environments to prevent leaks between tests
  (window as any).cleanupActiveTask = () => {
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = undefined;
    }
  };
}

function boot() {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      console.error('[mediapipe-khanh] Không tìm thấy phần tử #app trong DOM — bỏ qua khởi tạo thay vì crash.');
    }
    return;
  }
  init(app);
}

boot();
