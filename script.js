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

// 現在時刻（秒単位の日付・時刻を表示のみ）
const clockDate = document.getElementById('clock-date');
const clock = document.getElementById('clock');
function updateClock() {
  const now = new Date();
  clockDate.textContent = now.toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  });
  clock.textContent = now.toLocaleTimeString('ja-JP', { hour12: false });
}
updateClock();
setInterval(updateClock, 1000);

// カレンダー（月表示。日付クリックでその日の日記へ）
const calTitle = document.getElementById('cal-title');
const calGrid = document.getElementById('cal-grid');
const today = new Date();
let calYear = today.getFullYear();
let calMonth = today.getMonth(); // 0〜11（0 = 1月）

// 2026, 10, 5 → "2026-11-05"
function fmtDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 画面に表示するカレンダーをつくる（calYear / calMonth を変えたらこれを呼ぶ）
function renderCalendar() {
  calTitle.textContent = `${calYear}年${calMonth + 1}月`;

  const firstWeekday = new Date(calYear, calMonth, 1).getDay();  // 1日は何曜日？（0 = 日）
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate(); // その月は何日まで？
  const todayStr = fmtDate(today.getFullYear(), today.getMonth(), today.getDate());

  // 曜日の見出し
  let html = '<div class="cal-week sun">日</div><div class="cal-week">月</div>'
    + '<div class="cal-week">火</div><div class="cal-week">水</div>'
    + '<div class="cal-week">木</div><div class="cal-week">金</div>'
    + '<div class="cal-week sat">土</div>';

  // 1日の前の空白
  for (let i = 0; i < firstWeekday; i++) {
    html += '<div></div>';
  }

  // 1日〜月末のボタン
  for (let d = 1; d <= daysInMonth; d++) {
    const date = fmtDate(calYear, calMonth, d);
    let cls = 'cal-day';
    if (date === todayStr) cls += ' today';                          // 今日
    if (localStorage.getItem(DIARY_KEY + date)) cls += ' has-diary'; // 日記あり
    html += `<button class="${cls}" data-date="${date}">${d}</button>`;
  }

  calGrid.innerHTML = html;
}

// 日付ボタンのクリック（カレンダー全体でまとめて受ける）
calGrid.addEventListener('click', (e) => {
  const date = e.target.dataset.date; // 日付ボタン以外なら undefined
  if (!date) return;
  loadDiary(date);
  showView('view-journal');
});

// 前の月 / 次の月 / 今日
document.getElementById('cal-prev').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});
document.getElementById('cal-today').addEventListener('click', () => {
  calYear = today.getFullYear();
  calMonth = today.getMonth();
  renderCalendar();
});

// 日記保存後にカレンダーの記録マークを更新
document.getElementById('diary-save').addEventListener('click', renderCalendar);

renderCalendar();
