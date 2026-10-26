const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');

function showView(id) {
  views.forEach(v => v.classList.toggle('active', v.id === id));
  tabs.forEach(t => t.classList.toggle('active', t.dataset.target === id));
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => showView(tab.dataset.target));
});

document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.goto));
});

// 日記（日付ごとに localStorage へ保存）
const diaryDate = document.getElementById('diary-date');
const diaryText = document.getElementById('diary-text');
const diaryStatus = document.getElementById('diary-status');
const DIARY_KEY = 'diary:';
let currentDate = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD

function loadDiary(date) {
  currentDate = date;
  diaryDate.textContent = date;
  diaryText.value = localStorage.getItem(DIARY_KEY + date) || '';
  diaryStatus.textContent = '';
}

document.getElementById('diary-save').addEventListener('click', () => {
  localStorage.setItem(DIARY_KEY + currentDate, diaryText.value);
  diaryStatus.textContent = '保存しました';
});

loadDiary(currentDate);

// 現在時刻（カレンダータブ内のダミー表示）
const clock = document.getElementById('clock');
function updateClock() {
  clock.textContent = new Date().toLocaleTimeString('ja-JP');
}
updateClock();
setInterval(updateClock, 1000);

// カレンダー（月表示。日付クリックでその日の日記へ）
const calTitle = document.getElementById('cal-title');
const calGrid = document.getElementById('cal-grid');
const today = new Date();
let calYear = today.getFullYear();
let calMonth = today.getMonth();

function fmtDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function renderCalendar() {
  calTitle.textContent = `${calYear}年${calMonth + 1}月`;
  calGrid.innerHTML = '';
  ['日', '月', '火', '水', '木', '金', '土'].forEach((w, i) => {
    const h = document.createElement('div');
    h.className = 'cal-week' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '');
    h.textContent = w;
    calGrid.appendChild(h);
  });
  const first = new Date(calYear, calMonth, 1).getDay();
  const days = new Date(calYear, calMonth + 1, 0).getDate();
  for (let i = 0; i < first; i++) calGrid.appendChild(document.createElement('div'));
  const todayStr = fmtDate(today.getFullYear(), today.getMonth(), today.getDate());
  for (let d = 1; d <= days; d++) {
    const date = fmtDate(calYear, calMonth, d);
    const cell = document.createElement('button');
    cell.className = 'cal-day';
    if (date === todayStr) cell.classList.add('today');
    if (localStorage.getItem(DIARY_KEY + date)) cell.classList.add('has-diary');
    cell.textContent = d;
    cell.addEventListener('click', () => {
      loadDiary(date);
      showView('view-journal');
    });
    calGrid.appendChild(cell);
  }
}

function moveMonth(delta) {
  const d = new Date(calYear, calMonth + delta, 1);
  calYear = d.getFullYear();
  calMonth = d.getMonth();
  renderCalendar();
}

document.getElementById('cal-prev').addEventListener('click', () => moveMonth(-1));
document.getElementById('cal-next').addEventListener('click', () => moveMonth(1));
document.getElementById('cal-today').addEventListener('click', () => {
  calYear = today.getFullYear();
  calMonth = today.getMonth();
  renderCalendar();
});

// 日記保存後にカレンダーの記録マークを更新
document.getElementById('diary-save').addEventListener('click', renderCalendar);

renderCalendar();
