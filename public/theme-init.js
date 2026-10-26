// 첫 화면이 깜빡이지 않도록 저장된 테마를 렌더링 전에 적용합니다.
try {
  var t = localStorage.getItem('sf:theme') || 'system';
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch (e) {
  document.documentElement.dataset.theme = 'light';
}
