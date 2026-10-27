// 시간표를 PNG 이미지로 그립니다 (공유용 가로 / 휴대폰 배경화면용 세로)
import { DAY_NAMES, type PeriodTime, type TimetableEntry } from './types';

export type ImageLayout = 'landscape' | 'portrait';
export type ImageTheme = 'light' | 'dark';

const FONT = `'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif`;

const PALETTE = {
  light: ['#e8e3ff', '#dff3ea', '#fde8d6', '#e1edff', '#fde3ec', '#fff3c4', '#e6f6fb', '#efe6dc'],
  dark: ['#2e2860', '#173d31', '#4a2f17', '#1b2f52', '#4a1c2f', '#47400f', '#16404c', '#3b3026'],
};

/** 같은 과목은 늘 같은 색 */
export function subjectColorIndex(subject: string, n: number): number {
  let h = 0;
  for (const ch of subject) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % n;
}

/** 글자가 칸보다 길면 두 줄로 나누고, 그래도 길면 글자 크기를 줄임 */
export function fitLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  if (measure(text) <= maxWidth) return [text];
  const words = text.split(/\s+/);
  if (words.length > 1) {
    for (let i = words.length - 1; i > 0; i--) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      if (measure(a) <= maxWidth && measure(b) <= maxWidth) return [a, b];
    }
  }
  // 띄어쓰기가 없으면 글자 수로 반씩
  const mid = Math.ceil(text.length / 2);
  return [text.slice(0, mid), text.slice(mid)];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface DrawOptions {
  timetable: TimetableEntry[];
  periods: PeriodTime[];
  lunch: PeriodTime;
  title: string;
  subtitle: string;
  layout: ImageLayout;
  theme: ImageTheme;
}

export function drawTimetable(canvas: HTMLCanvasElement, o: DrawOptions) {
  const portrait = o.layout === 'portrait';
  const W = portrait ? 1080 : 1600;
  const H = portrait ? 1920 : 1000;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서는 이미지를 만들 수 없습니다.');
  const dark = o.theme === 'dark';
  const c = {
    bg: dark ? '#0b1020' : '#f5f6fb',
    text: dark ? '#eef0f8' : '#161a2b',
    muted: dark ? '#9aa3bd' : '#646b85',
    lunchBg: dark ? '#3a2a10' : '#fff1d6',
    lunchText: dark ? '#f5b454' : '#b45309',
    accent: '#6f55ff',
    empty: dark ? '#151c2e' : '#ffffff',
  };
  const palette = PALETTE[o.theme];

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  // 세로(배경화면)는 위쪽을 잠금화면 시계 자리로 비워 둡니다
  const pad = portrait ? 56 : 56;
  const top = portrait ? 520 : 60;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = c.text;
  ctx.font = `800 ${portrait ? 64 : 56}px ${FONT}`;
  ctx.fillText(o.title, pad, top);
  ctx.fillStyle = c.muted;
  ctx.font = `500 ${portrait ? 34 : 30}px ${FONT}`;
  ctx.fillText(o.subtitle, pad, top + (portrait ? 64 : 54));

  const gridTop = top + (portrait ? 130 : 110);
  const footer = portrait ? 140 : 64;
  const labelW = portrait ? 120 : 170;
  const gap = portrait ? 10 : 10;
  const headerH = portrait ? 64 : 56;
  const lunchH = portrait ? 56 : 46;
  const n = o.periods.length;
  const gridH = H - gridTop - footer - headerH - lunchH - gap * (n + 1);
  const rowH = gridH / n;
  const colW = (W - pad * 2 - labelW - gap * 5) / 5;
  const x0 = pad + labelW + gap;

  // 요일 머리
  ctx.textAlign = 'center';
  ctx.font = `700 ${portrait ? 36 : 32}px ${FONT}`;
  DAY_NAMES.forEach((d, i) => {
    ctx.fillStyle = c.muted;
    ctx.fillText(d, x0 + i * (colW + gap) + colW / 2, gridTop + headerH / 2);
  });

  let y = gridTop + headerH + gap;
  o.periods.forEach((p, pi) => {
    if (p.start === o.lunch.end) {
      roundRect(ctx, pad, y, W - pad * 2, lunchH, 16);
      ctx.fillStyle = c.lunchBg;
      ctx.fill();
      ctx.fillStyle = c.lunchText;
      ctx.textAlign = 'center';
      ctx.font = `700 ${portrait ? 30 : 26}px ${FONT}`;
      ctx.fillText(`점심시간  ${o.lunch.start} ~ ${o.lunch.end}`, W / 2, y + lunchH / 2);
      y += lunchH + gap;
    }
    // 교시 이름과 시간
    ctx.textAlign = 'left';
    ctx.fillStyle = c.text;
    ctx.font = `800 ${portrait ? 34 : 30}px ${FONT}`;
    ctx.fillText(`${pi + 1}교시`, pad, y + rowH / 2 - (portrait ? 16 : 14));
    ctx.fillStyle = c.muted;
    ctx.font = `500 ${portrait ? 24 : 22}px ${FONT}`;
    ctx.fillText(p.start, pad, y + rowH / 2 + (portrait ? 20 : 18));

    for (let d = 0; d < 5; d++) {
      const x = x0 + d * (colW + gap);
      const e = o.timetable.find((t) => t.day === d && t.period === pi + 1);
      roundRect(ctx, x, y, colW, rowH, 16);
      ctx.fillStyle = e ? palette[subjectColorIndex(e.subject, palette.length)] : c.empty;
      ctx.fill();
      if (!e) continue;
      ctx.fillStyle = c.text;
      ctx.textAlign = 'center';
      const base = portrait ? 34 : 32;
      let size = base;
      ctx.font = `700 ${size}px ${FONT}`;
      // 한 줄로 조금만 넘치면 글자를 줄여 한 줄로 (단어가 어색하게 잘리지 않게)
      while (ctx.measureText(e.subject).width > colW - 20 && size > base * 0.78) {
        size -= 1;
        ctx.font = `700 ${size}px ${FONT}`;
      }
      if (ctx.measureText(e.subject).width > colW - 20) {
        size = base;
        ctx.font = `700 ${size}px ${FONT}`;
      }
      let lines = fitLines(e.subject, colW - 20, (s) => ctx.measureText(s).width);
      while (lines.some((l) => ctx.measureText(l).width > colW - 16) && size > 16) {
        size -= 2;
        ctx.font = `700 ${size}px ${FONT}`;
        lines = fitLines(e.subject, colW - 20, (s) => ctx.measureText(s).width);
      }
      const lh = size * 1.2;
      lines.forEach((l, i) => ctx.fillText(l, x + colW / 2, y + rowH / 2 + (i - (lines.length - 1) / 2) * lh));
    }
    y += rowH + gap;
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = c.muted;
  ctx.font = `500 ${portrait ? 26 : 22}px ${FONT}`;
  ctx.fillText('SchoolFlow · schoolflow-yulang.netlify.app', W / 2, H - footer / 2);
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했습니다.'))), 'image/png'));
}
