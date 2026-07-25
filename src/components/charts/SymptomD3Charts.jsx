import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

// ============================================================================
// SymptomD3Charts — file CHUYÊN xử lý logic vẽ D3.js cho các biểu đồ mô tả
// kết luận triệu chứng (Hero3DMapPanel).
//
// Nguyên tắc thiết kế:
//  - Các component ở đây CHỈ nhận dữ liệu đã được xử lý/dịch sẵn (label,
//    value, index...) từ nơi gọi — không chứa logic i18n hay nghiệp vụ.
//  - Toàn bộ style dùng inline (không phụ thuộc class CSS ngoài) vì các biểu
//    đồ này được tái sử dụng ở HAI nơi: (1) màn hình kết quả trong app, và
//    (2) bên trong `PdfPreviewModal`, nơi nội dung bị `cloneNode` ra khỏi cây
//    DOM gốc rồi chụp bằng html2canvas — mọi thứ phụ thuộc vào stylesheet
//    ngoài (kể cả `.hero3dmap-scope ...`) sẽ KHÔNG được áp dụng trong bản
//    clone đó.
//  - Vẽ bằng D3 thuần (scale, arc/line generator...) trong SVG, không dùng
//    `foreignObject` hay CSS animation phức tạp để đảm bảo html2canvas chụp
//    đúng khi xuất PDF.
// ============================================================================

/**
 * HorizontalBarChart — biểu đồ cột ngang, dùng cho danh sách "độ tin cậy"
 * (vd: bác sĩ chuyên khoa đề xuất theo %).
 *
 * @param {{label: string, value: number}[]} data  value trong khoảng 0–100
 * @param {number} maxValue  giá trị tối đa của trục (mặc định 100)
 * @param {number} width     chiều rộng viewBox (px)
 * @param {string} color     màu cột giá trị
 * @param {string} valueSuffix  hậu tố hiển thị cạnh giá trị (mặc định '%')
 */
export function HorizontalBarChart({
  data = [],
  maxValue = 100,
  width = 520,
  color = '#c85d3a',
  trackColor = '#eee7dd',
  labelColor = '#282725',
  valueColor = '#282725',
  valueSuffix = '%',
}) {
  const svgRef = useRef(null);

  const rowLabelH = 18;
  const rowBarH = 22;
  const rowGap = 14;
  const rowStep = rowLabelH + rowBarH + rowGap;
  const marginTop = 4;
  const marginRight = 46;
  const height = Math.max(rowStep * data.length + marginTop, 40);

  useEffect(() => {
    if (!svgRef.current) return undefined;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const innerWidth = width - marginRight;
    const x = d3.scaleLinear().domain([0, maxValue]).range([0, innerWidth]);

    const rows = svg
      .selectAll('g.bar-row')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'bar-row')
      .attr('transform', (_d, i) => `translate(0, ${marginTop + i * rowStep})`);

    rows
      .append('text')
      .attr('x', 0)
      .attr('y', rowLabelH - 4)
      .attr('font-size', 13)
      .attr('font-weight', 700)
      .attr('fill', labelColor)
      .text((d) => d.label);

    rows
      .append('rect')
      .attr('x', 0)
      .attr('y', rowLabelH)
      .attr('width', innerWidth)
      .attr('height', rowBarH)
      .attr('rx', 6)
      .attr('fill', trackColor);

    rows
      .append('rect')
      .attr('x', 0)
      .attr('y', rowLabelH)
      .attr('height', rowBarH)
      .attr('rx', 6)
      .attr('fill', color)
      .attr('width', 0)
      .transition()
      .duration(700)
      .attr('width', (d) => Math.max(x(d.value), 4));

    rows
      .append('text')
      .attr('x', innerWidth + 8)
      .attr('y', rowLabelH + rowBarH / 2 + 4)
      .attr('font-size', 12)
      .attr('font-weight', 800)
      .attr('fill', valueColor)
      .text((d) => `${d.value}${valueSuffix}`);

    return undefined;
  }, [data, width, maxValue, color, trackColor, labelColor, valueColor, valueSuffix]);

  if (data.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ display: 'block', maxWidth: width }}
      role="img"
      aria-label="Bar chart"
    />
  );
}

/**
 * StageProgressChart — dòng thời gian dạng chấm nối (vd: mức độ nghiêm
 * trọng, thời gian kéo dài...), highlight chấm hiện tại theo `activeIndex`.
 *
 * @param {string[]} stages       nhãn từng mốc, theo đúng thứ tự tăng dần
 * @param {number} activeIndex    chỉ số (0-based) của mốc hiện tại
 * @param {number} width          chiều rộng viewBox (px)
 * @param {string} color          màu của phần đã đạt tới + chấm hiện tại
 */
export function StageProgressChart({
  stages = [],
  activeIndex = 0,
  width = 520,
  color = '#c85d3a',
  trackColor = '#e4dfd6',
  labelColor = '#948e85',
  activeLabelColor = '#282725',
}) {
  const svgRef = useRef(null);
  const height = 56;
  const marginX = 26;
  const cy = 16;

  useEffect(() => {
    if (!svgRef.current) return undefined;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const n = stages.length;
    if (n === 0) return undefined;

    const innerWidth = width - marginX * 2;
    const step = n > 1 ? innerWidth / (n - 1) : 0;
    const clampedIndex = Math.max(0, Math.min(activeIndex, n - 1));
    const activeX = marginX + step * clampedIndex;

    svg
      .append('line')
      .attr('x1', marginX)
      .attr('x2', marginX + innerWidth)
      .attr('y1', cy)
      .attr('y2', cy)
      .attr('stroke', trackColor)
      .attr('stroke-width', 4)
      .attr('stroke-linecap', 'round');

    svg
      .append('line')
      .attr('x1', marginX)
      .attr('x2', marginX)
      .attr('y1', cy)
      .attr('y2', cy)
      .attr('stroke', color)
      .attr('stroke-width', 4)
      .attr('stroke-linecap', 'round')
      .transition()
      .duration(700)
      .attr('x2', activeX);

    const g = svg
      .selectAll('g.stage-dot')
      .data(stages)
      .enter()
      .append('g')
      .attr('class', 'stage-dot')
      .attr('transform', (_d, i) => `translate(${marginX + step * i}, ${cy})`);

    g.append('circle')
      .attr('r', (_d, i) => (i === clampedIndex ? 8 : 5))
      .attr('fill', (_d, i) => (i <= clampedIndex ? color : trackColor))
      .attr('stroke', (_d, i) => (i === clampedIndex ? '#fff' : 'none'))
      .attr('stroke-width', 2);

    g.append('text')
      .attr('y', 26)
      .attr('text-anchor', (_d, i) => (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'))
      .attr('font-size', 11)
      .attr('font-weight', (_d, i) => (i === clampedIndex ? 800 : 500))
      .attr('fill', (_d, i) => (i === clampedIndex ? activeLabelColor : labelColor))
      .text((d) => d);

    return undefined;
  }, [stages, activeIndex, width, color, trackColor, labelColor, activeLabelColor]);

  if (stages.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ display: 'block', maxWidth: width }}
      role="img"
      aria-label="Progress timeline"
    />
  );
}

/**
 * SymptomConclusionCharts — bố cục tổng hợp sẵn của 3 biểu đồ (tiến triển
 * thời gian, mức độ nghiêm trọng, độ tin cậy chuyên khoa) dùng chung cho cả
 * màn hình kết quả và nội dung PDF. Mọi label/heading truyền vào đây đã được
 * dịch sẵn (i18n) từ nơi gọi.
 */
export default function SymptomConclusionCharts({
  chartsHeading,
  durationStages = [],
  durationIndex = -1,
  durationLabel,
  severityStages = [],
  severityIndex = -1,
  severityLabel,
  specialists = [],
  specialistsLabel,
  width = 520,
}) {
  const hasAnyChart = durationStages.length > 0 || severityStages.length > 0 || specialists.length > 0;
  if (!hasAnyChart) return null;

  return (
    <div style={{ marginTop: 8 }}>
      {chartsHeading ? (
        <h2 style={{ fontSize: 22, letterSpacing: '-0.02em', margin: '0 0 4px' }}>{chartsHeading}</h2>
      ) : null}

      {durationStages.length > 0 ? (
        <ChartBlock label={durationLabel}>
          <StageProgressChart stages={durationStages} activeIndex={durationIndex} width={width} color="#60a5fa" />
        </ChartBlock>
      ) : null}

      {severityStages.length > 0 ? (
        <ChartBlock label={severityLabel}>
          <StageProgressChart stages={severityStages} activeIndex={severityIndex} width={width} color="#c85d3a" />
        </ChartBlock>
      ) : null}

      {specialists.length > 0 ? (
        <ChartBlock label={specialistsLabel}>
          <HorizontalBarChart data={specialists} width={width} color="#c85d3a" />
        </ChartBlock>
      ) : null}
    </div>
  );
}

function ChartBlock({ label, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      {label ? (
        <div style={{ fontSize: 13, fontWeight: 700, color: '#69645e', marginBottom: 8 }}>{label}</div>
      ) : null}
      {children}
    </div>
  );
}
