import React, { useMemo, useState } from 'react';
import PdfPreviewModal from './common/PdfPreviewModal.jsx';

// ============================================================================
// Hero3DMapPanel — trang "3D Map for Hero".
//
// Trước đây trang này gồm nhiều tính năng (Google 3D globe, chat Gemini,
// Affiliate dashboard, Body Care...) được cắm vào qua Web Components (Lit)
// nằm trong thư mục `./Hero3DMap/`. Toàn bộ các tính năng đó đã bị gỡ bỏ,
// chỉ còn lại "Body Pixel" — nên toàn bộ nội dung (map_app, body_pixel_panel,
// body_pixel_detail, body_data, i18n, style) đã được convert từ Lit sang
// React thuần và gộp vào MỘT file duy nhất này. Phần xem-trước/tải PDF được
// tách ra thành thư viện dùng chung tại `./common/PdfPreviewModal.jsx` để các
// panel khác trong dự án cũng có thể tái sử dụng.
// ============================================================================

// ---------------------------------------------------------------------------
// i18n (rút gọn — chỉ giữ các khoá thực sự dùng cho Body Pixel)
// ---------------------------------------------------------------------------
const TRANSLATIONS = {
  en: {
    selectArea: 'Select an area to continue',
    continueDetail: 'Continue to details',
    selectSection: 'Select a section to continue',
    continue: 'Continue',
    back: 'Back',
    analysisTitle: 'Pain Analysis',
    analysisSubtitle: 'Answer a few quick questions so we can understand your symptoms',
    question1: 'What type of pain are you experiencing?',
    question2: 'How long have you had this pain?',
    question3: 'How severe is the pain?',
    summary: 'Summary',
    pain: 'Pain type',
    duration: 'Duration',
    severity: 'Severity',
    specialists: 'Recommended specialists',
    orthopedist: 'Orthopedist',
    generalPractitioner: 'General practitioner',
    startOver: 'Start over',
    close: 'Close',
    downloadPdf: 'Download PDF',
    gameSimulation: 'Game Mô Phỏng Cách Bảo Vệ Nội Tạng',
  },
  vi: {
    selectArea: 'Chọn một vùng để tiếp tục',
    continueDetail: 'Tiếp tục xem chi tiết',
    selectSection: 'Chọn một phần để tiếp tục',
    continue: 'Tiếp tục',
    back: 'Quay lại',
    analysisTitle: 'Phân Tích Cơn Đau',
    analysisSubtitle: 'Trả lời một vài câu hỏi nhanh để chúng tôi hiểu rõ triệu chứng của bạn',
    question1: 'Bạn đang gặp loại đau nào?',
    question2: 'Bạn bị đau này bao lâu rồi?',
    question3: 'Mức độ đau như thế nào?',
    summary: 'Tóm tắt',
    pain: 'Loại đau',
    duration: 'Thời gian',
    severity: 'Mức độ',
    specialists: 'Bác sĩ chuyên khoa đề xuất',
    orthopedist: 'Bác sĩ chỉnh hình',
    generalPractitioner: 'Bác sĩ đa khoa',
    startOver: 'Bắt đầu lại',
    close: 'Đóng',
    downloadPdf: 'Tải PDF',
    gameSimulation: 'Game Mô Phỏng Cách Bảo Vệ Nội Tạng',
  },
};

const OPTION_TRANSLATIONS = {
  en: {
    options1: ['Sharp', 'Dull / aching', 'Throbbing', 'Burning'],
    options2: ['Less than a day', 'A few days', 'About a week', 'Chronic (months or more)'],
    options3: ['Mild', 'Moderate', 'Severe', 'Unbearable'],
  },
  vi: {
    options1: ['Đau nhói', 'Đau âm ỉ', 'Đau theo nhịp', 'Nóng rát'],
    options2: ['Dưới 1 ngày', 'Vài ngày', 'Khoảng 1 tuần', 'Mãn tính (nhiều tháng)'],
    options3: ['Nhẹ', 'Vừa', 'Nặng', 'Không chịu nổi'],
  },
};

// ---------------------------------------------------------------------------
// body_data (bản đồ chấm điểm cơ thể)
// ---------------------------------------------------------------------------
const BODY_AREAS = [
  { id: 'head', label: 'Head', dots: [[10, 5], [11, 5], [12, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [9, 7], [10, 7], [11, 7], [12, 7], [13, 7], [10, 8], [11, 8], [12, 8]] },
  { id: 'neck', label: 'Neck', dots: [[10, 9], [11, 9], [12, 9], [10, 10], [11, 10], [12, 10]] },
  { id: 'chest', label: 'Chest', dots: [[8, 11], [9, 11], [10, 11], [11, 11], [12, 11], [13, 11], [14, 11], [8, 12], [9, 12], [10, 12], [11, 12], [12, 12], [13, 12], [14, 12], [8, 13], [9, 13], [10, 13], [11, 13], [12, 13], [13, 13], [14, 13]] },
  { id: 'stomach', label: 'Stomach', dots: [[9, 14], [10, 14], [11, 14], [12, 14], [13, 14], [9, 15], [10, 15], [11, 15], [12, 15], [13, 15], [10, 16], [11, 16], [12, 16]] },
  { id: 'leftArm', label: 'Left Arm', dots: [[6, 12], [6, 13], [6, 14], [6, 15], [6, 16], [6, 17], [6, 18], [7, 12], [7, 13], [7, 14], [7, 15], [7, 16], [7, 17], [7, 18]] },
  { id: 'rightArm', label: 'Right Arm', dots: [[16, 12], [16, 13], [16, 14], [16, 15], [16, 16], [16, 17], [16, 18], [15, 12], [15, 13], [15, 14], [15, 15], [15, 16], [15, 17], [15, 18]] },
  { id: 'leftLeg', label: 'Left Leg', dots: [[9, 17], [10, 17], [9, 18], [10, 18], [9, 19], [10, 19], [9, 20], [10, 20], [9, 21], [10, 21], [9, 22], [10, 22], [9, 23], [10, 23]] },
  { id: 'rightLeg', label: 'Right Leg', dots: [[12, 17], [13, 17], [12, 18], [13, 18], [12, 19], [13, 19], [12, 20], [13, 20], [12, 21], [13, 21], [12, 22], [13, 22], [12, 23], [13, 23]] },
];

function allBodyDots() {
  const map = new Map();
  BODY_AREAS.forEach((area) =>
    area.dots.forEach(([x, y], index) =>
      map.set(`${area.id}-${index}`, { id: `${area.id}-${index}`, x, y, areaId: area.id, areaLabel: area.label })
    )
  );
  return Array.from(map.values());
}

const PARTS = [
  { id: 'head', label: 'Head', sections: ['Eyes & Brows', 'Nose', 'Mouth', 'Jaw & Chin'] },
  { id: 'chest', label: 'Chest', sections: ['Right Chest', 'Left Chest', 'Left Lower Chest', 'Right Lower Chest'] },
  { id: 'stomach', label: 'Stomach', sections: ['Upper Right Abdomen', 'Upper Left Abdomen', 'Navel (Center)', 'Lower Right Abdomen', 'Lower Left Abdomen'] },
  { id: 'leftHand', label: 'Left Hand', sections: ['Thumb', 'Index Finger', 'Middle Finger', 'Ring Finger', 'Pinky Finger', 'Palm'] },
  { id: 'rightHand', label: 'Right Hand', sections: ['Pinky Finger', 'Ring Finger', 'Middle Finger', 'Thumb', 'Index Finger', 'Palm'] },
  { id: 'leftLeg', label: 'Left Leg', sections: ['Thigh', 'Knee', 'Shin', 'Ankle', 'Foot'] },
  { id: 'rightLeg', label: 'Right Leg', sections: ['Thigh', 'Knee', 'Foot', 'Ankle', 'Shin'] },
  { id: 'back', label: 'Back', sections: ['Right Shoulder Blade', 'Lower Right Back', 'Mid Left Back', 'Left Shoulder Blade'] },
];

const isEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2) <= 1;
const between = (v, min, max) => v >= min && v <= max;

function buildOrganDots(partId) {
  const dots = [];
  for (let y = 0; y < 38; y += 1) {
    for (let x = 0; x < 42; x += 1) {
      let section = null;
      if (partId === 'head') {
        const visible = isEllipse(x, y, 21, 18, 11.5, 12.5) || isEllipse(x, y, 13, 22, 3.4, 3.2) || isEllipse(x, y, 29, 22, 3.4, 3.2) || isEllipse(x, y, 21, 30, 6.7, 4.8);
        if (visible) section = y < 18 ? 'Eyes & Brows' : between(y, 18, 23) ? 'Nose' : y < 29 ? 'Mouth' : 'Jaw & Chin';
      } else if (partId === 'chest') {
        const visible = isEllipse(x, y, 21, 20, 14.5, 13);
        if (visible) section = x < 21 ? (y > 24 ? 'Left Lower Chest' : 'Left Chest') : (y > 24 ? 'Right Lower Chest' : 'Right Chest');
      } else if (partId === 'stomach') {
        const visible = isEllipse(x, y, 21, 19, 13.5, 12.5);
        if (visible) section = isEllipse(x, y, 21, 20, 4.4, 4.4) ? 'Navel (Center)' : y < 19 ? (x < 21 ? 'Upper Left Abdomen' : 'Upper Right Abdomen') : (x < 21 ? 'Lower Left Abdomen' : 'Lower Right Abdomen');
      } else if (partId === 'back') {
        const visible = isEllipse(x, y, 21, 20, 14, 14);
        if (visible) section = y < 20 ? (x < 21 ? 'Right Shoulder Blade' : 'Left Shoulder Blade') : (x < 21 ? 'Lower Right Back' : 'Mid Left Back');
      } else if (partId === 'leftLeg' || partId === 'rightLeg') {
        const visible = (between(x, 15, 27) && between(y, 8, 28)) || isEllipse(x, y, 21, 6, 5.2, 3.8) || isEllipse(x, y, 21, 31, 4.5, 3.5) || (between(x, 15, 27) && between(y, 34, 35));
        if (visible) section = y < 12 ? 'Thigh' : y < 16 ? 'Knee' : y < 27 ? 'Shin' : y < 33 ? 'Ankle' : 'Foot';
      } else {
        const fingers = [
          { section: partId === 'leftHand' ? 'Thumb' : 'Pinky Finger', cx: 6, cy: 13, rx: 2.4, ry: 6.5 },
          { section: partId === 'leftHand' ? 'Index Finger' : 'Ring Finger', cx: 13, cy: 11, rx: 3, ry: 7.4 },
          { section: 'Middle Finger', cx: 21, cy: 10, rx: 3, ry: 8.2 },
          { section: partId === 'leftHand' ? 'Ring Finger' : 'Thumb', cx: 29, cy: 11, rx: 3, ry: 7.4 },
          { section: partId === 'leftHand' ? 'Pinky Finger' : 'Index Finger', cx: 36, cy: 13, rx: 2.5, ry: 6.5 },
        ];
        const finger = fingers.find((item) => isEllipse(x, y, item.cx, item.cy, item.rx, item.ry));
        const palm = isEllipse(x, y, 21, 29, 14.5, 7.2);
        if (finger) section = finger.section;
        else if (palm) section = 'Palm';
      }

      if (section) dots.push({ id: `${x}-${y}`, x, y, section });
    }
  }
  return dots;
}

// ---------------------------------------------------------------------------
// Sub-component: Body Pixel Detail (bước "zoom" vào từng bộ phận)
// ---------------------------------------------------------------------------
function BodyPixelDetail({ activePart, selectedSections, onPartChange, onToggleSection, t }) {
  const part = PARTS.find((p) => p.id === activePart) || PARTS[0];
  const dots = useMemo(() => buildOrganDots(activePart), [activePart]);

  return (
    <div className="h3dm-pixelPane">
      <span className="h3dm-kicker">BODY PART</span>
      <select className="h3dm-select" value={activePart} onChange={(e) => onPartChange(e.target.value)}>
        {PARTS.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>

      <div className="h3dm-dotMap" aria-label="Interactive internal pixel pain map">
        {dots.map((dot) => {
          const isSelected = selectedSections.includes(dot.section);
          return (
            <button
              key={dot.id}
              type="button"
              className="h3dm-dot"
              title={dot.section}
              aria-label={`${isSelected ? 'Deselect' : 'Select'} ${dot.section}`}
              onClick={() => onToggleSection(dot.section)}
              style={{ left: `${dot.x * 2.38}%`, top: `${dot.y * 2.45}%`, background: isSelected ? '#cc623d' : '#77736a' }}
            />
          );
        })}
      </div>

      <div className="h3dm-chipsTitle">{part.label.toUpperCase()} · TAP A SECTION</div>
      <div className="h3dm-chips">
        {selectedSections.length === 0 ? (
          <span className="h3dm-emptyHint">{t('selectSection')}</span>
        ) : (
          selectedSections.map((section) => (
            <button key={section} type="button" className="h3dm-chip" onClick={() => onToggleSection(section)}>
              {section} <span className="h3dm-chipX">×</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export default function Hero3DMapPanel({ onOpenBodyProtectionJourney }) {
  const [lang, setLang] = useState('vi');
  const [wizardStep, setWizardStep] = useState('body'); // body | detailed | q1 | q2 | q3 | result
  const [view, setView] = useState('front');
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [activePart, setActivePart] = useState('head');
  const [selectedSections, setSelectedSections] = useState([]);
  const [answers, setAnswers] = useState({ painType: '', duration: '', severity: '' });
  const [showPreview, setShowPreview] = useState(false);

  const t = (key) => TRANSLATIONS[lang][key] || key;
  const tOptions = (key) => OPTION_TRANSLATIONS[lang][key] || [];

  React.useEffect(() => {
    const handleLangChange = (e) => setLang(e.detail === 'en' ? 'en' : 'vi');
    window.addEventListener('language-changed', handleLangChange);
    return () => window.removeEventListener('language-changed', handleLangChange);
  }, []);

  const navigateToJourney = () => {
    if (onOpenBodyProtectionJourney) onOpenBodyProtectionJourney();
  };

  const handleBodyDotClick = (areaId) => {
    setSelectedAreas((prev) => (prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]));
  };

  const handlePartChange = (partId) => {
    setActivePart(partId);
    setSelectedSections([]);
  };

  const toggleSection = (section) => {
    setSelectedSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]));
  };

  const resetAll = () => {
    setWizardStep('body');
    setAnswers({ painType: '', duration: '', severity: '' });
    setSelectedAreas([]);
    setSelectedSections([]);
  };

  // --- Step 1: Body map -----------------------------------------------------
  const renderBodyStep = () => {
    const dots = allBodyDots();
    const selectedCount = selectedAreas.length;
    const chips = selectedAreas.map((id) => ({ id, label: BODY_AREAS.find((area) => area.id === id)?.label || id }));

    return (
      <div className="h3dm-stage">
        <button type="button" className="h3dm-gameFab" onClick={navigateToJourney}>
          {t('gameSimulation')}
        </button>

        <h1 className="h3dm-title">Tell us where it hurts.</h1>
        <p className="h3dm-subtitle">Tap on the body below, and we'll help you understand what's going on.</p>

        <div className="h3dm-card">
          <div className="h3dm-pixelPane">
            <div className="h3dm-tabs">
              <button className={view === 'front' ? 'h3dm-tabActive' : 'h3dm-tab'} onClick={() => setView('front')}>FRONT</button>
              <button className={view === 'back' ? 'h3dm-tabActive' : 'h3dm-tab'} onClick={() => setView('back')}>BACK</button>
            </div>

            <div className="h3dm-dotMapBody" aria-label="Interactive pain body map">
              {dots.map((dot) => {
                const isSelected = selectedAreas.includes(dot.areaId);
                return (
                  <button
                    key={dot.id}
                    className="h3dm-dot"
                    title={dot.areaLabel}
                    onClick={() => handleBodyDotClick(dot.areaId)}
                    style={{ left: `${dot.x * 4}%`, top: `${dot.y * 3.6}%`, background: isSelected ? '#cc5d38' : '#747166' }}
                  />
                );
              })}
            </div>

            <div className="h3dm-chipsTitle">BODY MAP · SELECT AFFECTED AREAS</div>
            <div className="h3dm-chips">
              {chips.length === 0 ? (
                <span className="h3dm-emptyHint">{t('selectArea')}</span>
              ) : (
                chips.map((chip) => (
                  <button key={chip.id} type="button" className="h3dm-chip" onClick={() => handleBodyDotClick(chip.id)}>
                    {chip.label} <span className="h3dm-chipX">×</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="h3dm-infoPane">
            <div className="h3dm-meta">
              <span>STAGE</span><b>&gt; BODY SELECTION</b>
              <span>SELECTED</span><b>&gt; {selectedCount} {selectedCount === 1 ? 'AREA' : 'AREAS'}</b>
            </div>
            <hr className="h3dm-rule" />
            <h2 className="h3dm-question">Where does it hurt?</h2>
            <p className="h3dm-helper">Choose how you'd like to select, then tap on the body to the left.</p>

            <button
              className="h3dm-continueButton"
              disabled={selectedCount === 0}
              onClick={() => {
                if (selectedCount === 0) return;
                const lastId = selectedAreas[selectedAreas.length - 1];
                if (PARTS.find((p) => p.id === lastId)) {
                  setActivePart(lastId);
                } else if (lastId === 'neck') {
                  setActivePart('head');
                } else if (lastId === 'leftArm') {
                  setActivePart('leftHand');
                } else if (lastId === 'rightArm') {
                  setActivePart('rightHand');
                }
                setWizardStep('detailed');
              }}
            >
              {selectedCount === 0 ? t('selectArea') : t('continueDetail')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- Step 2: Detailed organ ------------------------------------------------
  const renderDetailedStep = () => {
    const part = PARTS.find((p) => p.id === activePart) || PARTS[0];
    const selectedCount = selectedSections.length;

    return (
      <div className="h3dm-stage h3dm-stage-detailed">
        <button className="h3dm-backStepBtn" onClick={() => setWizardStep('body')}>{t('back')}</button>
        <button type="button" className="h3dm-gameFab" onClick={navigateToJourney}>
          {t('gameSimulation')}
        </button>

        <h1 className="h3dm-title">Detailed Body Pixel Check</h1>
        <p className="h3dm-subtitle">Zoom into specific organs and sections to locate your pain</p>

        <div className="h3dm-card">
          <BodyPixelDetail
            activePart={activePart}
            selectedSections={selectedSections}
            onPartChange={handlePartChange}
            onToggleSection={toggleSection}
            t={t}
          />

          <div className="h3dm-infoPane">
            <div className="h3dm-meta">
              <span>PART</span><b>&gt; {part.label.toUpperCase()}</b>
              <span>SELECTED</span><b>&gt; {selectedCount} {selectedCount === 1 ? 'SECTION' : 'SECTIONS'}</b>
            </div>
            <hr className="h3dm-rule" />
            <h2 className="h3dm-question">Show me exactly where</h2>
            <p className="h3dm-helper">Pick a body part from the dropdown, then tap the section that's bothering you. Tap an orange section again to remove it.</p>

            <div className="h3dm-detailedActions">
              <button className="h3dm-btn" disabled={selectedCount === 0} onClick={() => setWizardStep('q1')}>
                {selectedCount === 0 ? t('selectSection') : t('continue')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Step 3: Q&A wizard -----------------------------------------------------
  const renderQuestionStep = (questionNum, question, options, onSelect, nextStep, selected) => (
    <div className="h3dm-stage h3dm-stage-detailed">
      <button
        className="h3dm-backStepBtn"
        onClick={() => setWizardStep(questionNum === 1 ? 'detailed' : questionNum === 2 ? 'q1' : 'q2')}
      >
        {t('back')}
      </button>
      <button type="button" className="h3dm-gameFab" onClick={navigateToJourney}>
        {t('gameSimulation')}
      </button>

      <h1 className="h3dm-title">{t('analysisTitle')}</h1>
      <p className="h3dm-subtitle">{t('analysisSubtitle')}</p>

      <div className="h3dm-card">
        <div className="h3dm-pixelPane h3dm-pixelPane-placeholder">Visual placeholder</div>

        <div className="h3dm-infoPane">
          <div className="h3dm-meta">
            <span>STAGE</span><b>&gt; QUESTION {questionNum} OF 3</b>
          </div>
          <hr className="h3dm-rule" />
          <h2 className="h3dm-question">{question}</h2>

          <div className="h3dm-optionsGrid">
            {options.map((option) => (
              <button
                key={option}
                className="h3dm-chip h3dm-optionChip"
                style={{
                  background: selected === option ? '#c85d3a' : '#fff',
                  color: selected === option ? '#fff' : '#282725',
                }}
                onClick={() => onSelect(option)}
              >
                {option}
              </button>
            ))}
          </div>

          <button className="h3dm-continueButton" disabled={!selected} onClick={() => setWizardStep(nextStep)}>
            {t('continue')}
          </button>
        </div>
      </div>
    </div>
  );

  // --- Step 4: Result ----------------------------------------------------------
  const renderResultStep = () => {
    const part = PARTS.find((p) => p.id === activePart) || PARTS[0];

    return (
      <>
        <div className="h3dm-stage h3dm-stage-detailed">
          <button className="h3dm-backStepBtn" onClick={() => setWizardStep('q3')}>{t('back')}</button>
          <button type="button" className="h3dm-gameFab" onClick={navigateToJourney}>
            {t('gameSimulation')}
          </button>

          <h1 className="h3dm-title">{t('analysisTitle')}</h1>
          <p className="h3dm-subtitle">{t('analysisSubtitle')}</p>

          <div className="h3dm-card">
            <div className="h3dm-pixelPane h3dm-pixelPane-placeholder">Visual placeholder</div>

            <div className="h3dm-infoPane">
              <h2 className="h3dm-question">{t('summary')}</h2>
              <p className="h3dm-helper">{t('pain')}: {answers.painType}</p>
              <p className="h3dm-helper">{t('duration')}: {answers.duration}</p>
              <p className="h3dm-helper">{t('severity')}: {answers.severity}</p>

              <hr className="h3dm-rule" />

              <h2 className="h3dm-question">{t('specialists')}</h2>
              <p className="h3dm-helper">1. {t('orthopedist')} - 50%</p>
              <p className="h3dm-helper">2. {t('generalPractitioner')} - 25%</p>

              <div className="h3dm-resultActions">
                <button className="h3dm-continueButton h3dm-continueButton-static" onClick={() => setShowPreview(true)}>
                  {t('downloadPdf')}
                </button>
                <button className="h3dm-continueButton h3dm-continueButton-static h3dm-continueButton-outline" onClick={resetAll}>
                  {t('startOver')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {showPreview ? (
          <PdfPreviewModal
            title="Symptom Summary"
            subtitle={`Body area examined: ${part.label} · Generated for informational use only.`}
            lists={[
              { heading: 'Selected sections', items: selectedSections },
              {
                heading: 'Responses',
                items: [
                  `How would you describe the pain or discomfort?: ${answers.painType}`,
                  `How long has this been going on?: ${answers.duration}`,
                  `How would you rate the severity?: ${answers.severity}`,
                ],
              },
            ]}
            table={{
              heading: 'Possible specialists (ranked)',
              headers: ['#', 'Specialist', 'Confidence'],
              rows: [
                ['1', t('orthopedist'), '50%'],
                ['2', t('generalPractitioner'), '25%'],
              ],
            }}
            disclaimer="DISCLAIMER: I am not a doctor. This document was generated by an AI-based prediction tool for informational purposes only, based on self-reported answers. It is not a medical diagnosis. Always consult a licensed medical professional."
            filename="SymptomSummary.pdf"
            downloadLabel={t('downloadPdf')}
            closeLabel={t('close')}
            onClose={() => setShowPreview(false)}
          />
        ) : null}
      </>
    );
  };

  let content;
  switch (wizardStep) {
    case 'body':
      content = renderBodyStep();
      break;
    case 'detailed':
      content = renderDetailedStep();
      break;
    case 'q1':
      content = renderQuestionStep(1, t('question1'), tOptions('options1'), (val) => setAnswers((a) => ({ ...a, painType: val })), 'q2', answers.painType);
      break;
    case 'q2':
      content = renderQuestionStep(2, t('question2'), tOptions('options2'), (val) => setAnswers((a) => ({ ...a, duration: val })), 'q3', answers.duration);
      break;
    case 'q3':
      content = renderQuestionStep(3, t('question3'), tOptions('options3'), (val) => setAnswers((a) => ({ ...a, severity: val })), 'result', answers.severity);
      break;
    case 'result':
      content = renderResultStep();
      break;
    default:
      content = renderBodyStep();
  }

  return (
    <div className="hero3dmap-scope" style={{ width: '100%', height: '100vh', overflowY: 'auto' }}>
      <style>{HERO3DMAP_CSS}</style>
      <div className="h3dm-app">{content}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style (gộp từ index.css + phần <style> của body_pixel_panel.ts /
// body_pixel_detail.ts, đổi hết class sang tiền tố "h3dm-" để tránh đụng độ
// với các panel khác trong dự án).
// ---------------------------------------------------------------------------
const HERO3DMAP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inconsolata:wght@200..900&display=swap');

.hero3dmap-scope * {
  box-sizing: border-box;
}

.hero3dmap-scope {
  font-family: 'Google Sans Text', 'Google Sans', system-ui, -apple-system, sans-serif;
  background: #f5f3ee;
  color: #282725;
}

.h3dm-app {
  min-height: 100%;
  padding-bottom: 26px;
}

.h3dm-stage {
  position: relative;
  width: calc(100% - 24px);
  margin: 10px auto 0;
  border-radius: 18px;
  background: #282724;
  padding: clamp(28px, 6vw, 50px) clamp(14px, 3vw, 24px) 12px;
  min-height: clamp(560px, 92vh, 820px);
  text-align: center;
  box-sizing: border-box;
}
.h3dm-stage-detailed { background: #c75d3b; }

.h3dm-title { color: #fff; margin: 0 0 10px; font-size: clamp(20px, 4vw, 30px); font-weight: 850; letter-spacing: -0.02em; }
.h3dm-subtitle { color: #fff6ef; margin: 0; font-size: clamp(14px, 2.4vw, 20px); }

.h3dm-card {
  width: min(1260px, calc(100% - 24px));
  margin: 18px auto 0;
  display: grid;
  grid-template-columns: 45% 55%;
  border-radius: 22px;
  overflow: hidden;
  background: #fff;
  text-align: left;
}

/* Tablet (~768–1024px): giữ layout 2 cột nhưng bớt padding/kích thước để vừa
   màn hình, tránh tràn ngang hoặc dồn cụm quá chật. */
@media (max-width: 1024px) {
  .h3dm-card { width: calc(100% - 24px); }
  .h3dm-pixelPane, .h3dm-infoPane { padding: 28px 26px; min-height: 560px; }
}

@media (max-width: 900px) {
  .h3dm-card { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .h3dm-card { grid-template-columns: 1fr; width: calc(100% - 16px); }
  .h3dm-stage { width: calc(100% - 16px); min-height: auto; padding: 20px 12px 16px; }
  .h3dm-pixelPane, .h3dm-infoPane { min-height: auto; padding: 18px; }
  .h3dm-continueButton { position: static !important; width: 100%; margin-top: 14px; }
  .h3dm-detailedActions { position: static; margin-top: 16px; }
  .h3dm-tabs { justify-content: center; }
  .h3dm-dotMap, .h3dm-dotMapBody { height: 340px; }
  .h3dm-optionsGrid { grid-template-columns: 1fr; }
  .h3dm-meta { grid-template-columns: 90px 1fr; font-size: 12px; }
  .h3dm-question { font-size: 22px; }
}

.h3dm-pixelPane { min-height: clamp(420px, 70vh, 690px); background: #272622; padding: clamp(18px, 3vw, 30px) clamp(16px, 3vw, 30px) 26px; color: #c4bcb0; position: relative; box-sizing: border-box; }
.h3dm-pixelPane-placeholder { display: flex; align-items: center; justify-content: center; color: #8d887f; }

.h3dm-kicker { display: block; color: #8d887f; font-family: monospace; letter-spacing: .18em; font-size: 12px; margin-bottom: 10px; }

.h3dm-select {
  width: 100%;
  border: 1px solid rgba(255,255,255,.13);
  border-radius: 12px;
  padding: 13px 18px;
  font-size: 16px;
  color: #f5f0e8;
  background: #2b2925;
  outline: none;
  box-sizing: border-box;
}

.h3dm-dotMap { position: relative; height: clamp(320px, 55vh, 520px); margin-top: 18px; }
.h3dm-dotMapBody {
  position: relative;
  height: clamp(320px, 55vh, 520px);
  margin-top: 20px;
  background-image: radial-gradient(rgba(255,255,255,.08) 1px, transparent 1px);
  background-size: 32px 32px;
}

.h3dm-dot {
  position: absolute;
  width: 9px;
  height: 9px;
  border-radius: 99px;
  border: 0;
  transform: translate(-50%, -50%);
  cursor: pointer;
  transition: background 0.15s;
}

.h3dm-chipsTitle { font-family: monospace; letter-spacing: .16em; color: #9c968d; font-size: 12px; margin-bottom: 12px; margin-top: 16px; }
.h3dm-chips { display: flex; flex-wrap: wrap; gap: 9px; min-height: 36px; }
.h3dm-chip { border: 0; border-radius: 18px; background: #56524b; color: #f0ece5; padding: 8px 12px; font-size: 14px; cursor: pointer; }
.h3dm-chipX { color: #d86b45; font-weight: 900; margin-left: 4px; }
.h3dm-emptyHint { color: #837d73; font-size: 14px; font-style: italic; }

.h3dm-infoPane { min-height: clamp(420px, 70vh, 690px); padding: clamp(24px, 4vw, 50px) clamp(20px, 4vw, 52px); position: relative; background: #fffdfa; box-sizing: border-box; }

.h3dm-meta { display: grid; grid-template-columns: 120px 1fr; gap: 7px 18px; font-family: monospace; color: #948e85; letter-spacing: .08em; font-size: 13px; }
.h3dm-rule { border: 0; border-top: 1px solid #e4dfd6; margin: 28px 0; }
.h3dm-question { font-size: clamp(20px, 3.2vw, 30px); margin: 0; letter-spacing: -0.04em; }
.h3dm-helper { color: #69645e; font-size: clamp(14px, 2vw, 17px); line-height: 1.5; }

.h3dm-continueButton {
  position: absolute;
  left: clamp(20px, 4vw, 52px);
  right: clamp(20px, 4vw, 52px);
  bottom: clamp(20px, 4vw, 46px);
  border: 0;
  border-radius: 12px;
  background: #c85d3a;
  color: #fff;
  padding: 16px;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
}
.h3dm-continueButton:disabled { opacity: 0.5; cursor: not-allowed; }
.h3dm-continueButton-blue { background: #60a5fa; }
.h3dm-continueButton-static { position: static; flex: 1; }
.h3dm-continueButton-outline { background: #fff; color: #c85d3a; border: 1px solid #c85d3a; }

/* Nhóm nút xếp chồng (vd: "Tiếp tục" + "Game Mô Phỏng...") ở bước detailed.
   Dùng flex-column trong luồng bình thường thay vì offset âm (bottom: -50px)
   để không bao giờ bị thanh điều hướng/khung ngoài của app che mất hoặc
   nằm ngoài vùng có thể bấm được. */
.h3dm-detailedActions {
  position: absolute;
  left: clamp(20px, 4vw, 52px);
  right: clamp(20px, 4vw, 52px);
  bottom: clamp(20px, 4vw, 46px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.h3dm-btn {
  width: 100%;
  border: 0;
  border-radius: 12px;
  background: #c85d3a;
  color: #fff;
  padding: 16px;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  box-sizing: border-box;
}
.h3dm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.h3dm-btn-blue { background: #60a5fa; }

/* Nút Game Mô Phỏng — nằm ở góc trên-phải của MỌI bước (h3dm-stage có
   position: relative), cùng hàng với nút "Quay lại" (top-left). Luôn hiển
   thị, không bao giờ có thuộc tính disabled. */
.h3dm-gameFab {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 5;
  border: 0;
  border-radius: 999px;
  background: #60a5fa;
  color: #fff;
  font-family: monospace;
  padding: 8px 16px;
  font-size: clamp(11px, 1.5vw, 13px);
  font-weight: 800;
  letter-spacing: .02em;
  line-height: 1.35;
  cursor: pointer;
  text-align: center;
  max-width: min(280px, 58vw);
  box-shadow: 0 4px 14px rgba(0,0,0,.25);
}
.h3dm-gameFab:hover { filter: brightness(1.06); }

@media (max-width: 600px) {
  .h3dm-gameFab {
    top: 10px;
    right: 10px;
    padding: 7px 11px;
    font-size: 10px;
    max-width: 48vw;
  }
}

.h3dm-resultActions { display: flex; gap: 10px; margin-top: 20px; }

.h3dm-optionsGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; }
.h3dm-optionChip { text-align: left; padding: 20px; border: 1px solid #e4dfd6; }

.h3dm-tabs { display: flex; gap: 20px; margin-bottom: 20px; }
.h3dm-tab, .h3dm-tabActive { border: 0; background: transparent; letter-spacing: .12em; font-family: monospace; cursor: pointer; padding-bottom: 4px; }
.h3dm-tab { color: #8c857b; }
.h3dm-tabActive { border-bottom: 1px solid #c85d3a; color: #c85d3a; }

.h3dm-backStepBtn {
  position: absolute;
  top: 16px;
  left: 16px;
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  font-family: monospace;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.h3dm-backStepBtn:hover { color: #c85d3a; }
`;
