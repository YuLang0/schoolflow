import { useEffect, useRef, useState } from 'react';
import { canvasToBlob, drawTimetable, type ImageLayout, type ImageTheme } from '../lib/timetableImage';
import { LUNCH_TIME, type AppData } from '../lib/types';
import { Banner, Modal } from './ui';

export function TimetableImageModal({ data, onClose }: { data: AppData; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<ImageLayout>(() => (window.innerWidth < 720 ? 'portrait' : 'landscape'));
  const [theme, setTheme] = useState<ImageTheme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  const [error, setError] = useState<string | null>(null);
  const s = data.settings;
  const cls = s.gradeNo && s.classNo ? `${s.gradeNo}학년 ${s.classNo}반 ` : '';
  // 한글 파일 이름은 일부 브라우저에서 'download'로 바뀌어 영문으로
  const fileName = `schoolflow-timetable${s.gradeNo && s.classNo ? `-${s.gradeNo}-${s.classNo}` : ''}-${layout}.png`;

  useEffect(() => {
    if (!canvas.current) return;
    try {
      drawTimetable(canvas.current, {
        timetable: data.timetable,
        periods: s.periodTimes,
        lunch: LUNCH_TIME,
        title: `${cls}시간표`,
        subtitle: s.schoolName || '경기모바일과학고등학교',
        layout,
        theme,
      });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [layout, theme, data.timetable, s.periodTimes, s.schoolName, cls]);

  const save = async () => {
    if (!canvas.current) return;
    const blob = await canvasToBlob(canvas.current);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const file = () => canvasToBlob(canvas.current!).then((b) => new File([b], fileName, { type: 'image/png' }));
  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] });
  const share = async () => {
    try {
      await navigator.share({ files: [await file()], title: `${cls}시간표` });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError('공유하지 못했습니다. 이미지 저장을 이용해 주세요.');
    }
  };

  return (
    <Modal title="시간표 이미지" onClose={onClose}>
      <div className="toolbar">
        <div className="seg">
          <button className={layout === 'landscape' ? 'on' : ''} onClick={() => setLayout('landscape')}>
            가로 (공유용)
          </button>
          <button className={layout === 'portrait' ? 'on' : ''} onClick={() => setLayout('portrait')}>
            세로 (배경화면)
          </button>
        </div>
        <div className="seg">
          <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>
            밝게
          </button>
          <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>
            어둡게
          </button>
        </div>
      </div>
      <div className={`tt-image-preview ${layout}`}>
        <canvas ref={canvas} aria-label="시간표 이미지 미리보기" />
      </div>
      {data.timetable.length === 0 && <Banner kind="info">시간표가 비어 있습니다. 먼저 시간표를 채워 주세요.</Banner>}
      {error && <Banner kind="error">{error}</Banner>}
      <div className="actions">
        <span className="grow" />
        {canShare && (
          <button className="btn ghost" onClick={() => void share()}>
            공유하기
          </button>
        )}
        <button className="btn primary" onClick={() => void save()}>
          이미지 저장
        </button>
      </div>
    </Modal>
  );
}
