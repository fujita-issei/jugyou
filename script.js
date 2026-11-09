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
  diaryStatus.classList.remove('err');
}

document.getElementById('diary-save').addEventListener('click', () => {
  localStorage.setItem(DIARY_KEY + currentDate, diaryText.value);
  diaryStatus.textContent = '保存しました';
});

// 自動保存 (debounce)
let _diaryTimer = null;
diaryText.addEventListener('input', () => {
  clearTimeout(_diaryTimer);
  _diaryTimer = setTimeout(() => {
    localStorage.setItem(DIARY_KEY + currentDate, diaryText.value);
    diaryStatus.textContent = '自動保存しました';
    renderCalendar();
  }, 400);
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
    if (date === currentDate) cell.classList.add('selected');
    cell.textContent = d;

    // 複数マーク (緑=日記, 青=ToDo, 灰=完了ログ)
    const marks = document.createElement('span');
    marks.className = 'marks';
    if (localStorage.getItem(DIARY_KEY + date)) {
      const i = document.createElement('i'); i.style.background = '#2e7d32'; marks.appendChild(i);
    }
    if ((loadJSON(TODO_KEY + date, []) || []).length) {
      const i = document.createElement('i'); i.style.background = '#1a56db'; marks.appendChild(i);
    }
    if ((loadJSON(LOG_KEY + date, []) || []).length) {
      const i = document.createElement('i'); i.style.background = '#999'; marks.appendChild(i);
    }
    cell.appendChild(marks);

    cell.addEventListener('click', () => {
      setCurrentDate(date);
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

/* ================================================================
 * 追加分: ToDo / タイマー / ToDo完了ログ / ローカルLLM要約
 * - 全データ localStorage
 * - fujita-issei の UI (タブ構造・配色・既存の日記/カレンダー/時計) をベース
 * ================================================================ */

/* ---------- 共通ユーティリティ ---------- */
const pad2 = n => String(n).padStart(2, '0');
const dateFromStr = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => new Date().toLocaleDateString('sv-SE');
const addDays = (s, n) => {
  const d = dateFromStr(s); d.setDate(d.getDate() + n);
  return fmtDate(d.getFullYear(), d.getMonth(), d.getDate());
};
const fmtJP = s => {
  const d = dateFromStr(s);
  const w = ['日','月','火','水','木','金','土'][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日(${w})`;
};
const fmtTime = sec => {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
};
const loadJSON = (k, def) => {
  try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); }
  catch { return def; }
};
const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* ---------- ストレージキー ---------- */
const TODO_KEY = 'todos:';         // todos:YYYY-MM-DD
const LOG_KEY  = 'todolog:';       // todolog:YYYY-MM-DD
const LLM_KEY  = 'llm:saved';
const SETTINGS_KEY = 'settings';

const getTodos = date => loadJSON(TODO_KEY + date, []);
const setTodos = (date, arr) => saveJSON(TODO_KEY + date, arr);

/* ---------- 日付ナビ (ToDo・日記タブ) ---------- */
const dateLabel = document.getElementById('date-label');
const dateBadge = document.getElementById('selected-date-badge');

function setCurrentDate(ymd) {
  loadDiary(ymd);                        // currentDate を切替、日記を読み込み
  dateLabel.textContent = fmtJP(ymd);
  dateBadge.textContent = fmtJP(ymd);
  renderTodos();
  renderTodoLog();
  renderCalendar();
}

document.getElementById('date-prev').addEventListener('click', () => setCurrentDate(addDays(currentDate, -1)));
document.getElementById('date-next').addEventListener('click', () => setCurrentDate(addDays(currentDate, +1)));
document.getElementById('date-today').addEventListener('click', () => setCurrentDate(todayStr()));

/* ---------- ToDo ---------- */
const todoForm = document.getElementById('todo-form');
const todoTextEl = document.getElementById('todo-text');
const todoPlanEl = document.getElementById('todo-plan');
const todoListEl = document.getElementById('todo-list');
const todoEmptyEl = document.getElementById('todo-empty');

todoForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = todoTextEl.value.trim();
  if (!text) return;
  const planMin = Number(todoPlanEl.value) || null;
  const arr = getTodos(currentDate);
  arr.push({
    id: Date.now() + Math.floor(Math.random() * 999),
    text, planMin,
    elapsedSec: 0, done: false, note: '',
    running: false, startedAt: null, notified: false,
  });
  setTodos(currentDate, arr);
  todoTextEl.value = ''; todoPlanEl.value = '';
  renderTodos(); renderCalendar();
});

/* 選択日に関係なく全日のToDoを走査 */
function forEachAllTodos(cb) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(TODO_KEY)) continue;
    const date = key.slice(TODO_KEY.length);
    const arr = getTodos(date);
    let changed = false;
    for (const t of arr) {
      if (cb(t, date) === true) changed = true;
    }
    if (changed) setTodos(date, arr);
  }
}

function currentElapsed(t) {
  if (t.running && t.startedAt) return t.elapsedSec + (Date.now() - t.startedAt) / 1000;
  return t.elapsedSec;
}

function renderTodos() {
  const arr = getTodos(currentDate);
  todoListEl.innerHTML = '';
  todoEmptyEl.style.display = arr.length ? 'none' : 'block';

  arr.forEach(t => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (t.done ? ' done' : '') + (t.running ? ' running' : '');
    li.dataset.id = t.id;

    const row = document.createElement('div');
    row.className = 'todo-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!t.done;
    cb.title = '完了トグル';
    cb.addEventListener('change', () => {
      if (cb.checked) finishTask(t.id);
      else uncompleteTask(t.id);
    });

    const txt = document.createElement('span');
    txt.className = 'todo-text'; txt.textContent = t.text;

    const plan = document.createElement('span');
    plan.className = 'todo-plan';
    plan.textContent = t.planMin ? `予定 ${t.planMin}分` : '予定なし';

    const el = document.createElement('span');
    el.className = 'todo-elapsed';
    el.textContent = fmtTime(currentElapsed(t));

    const acts = document.createElement('span');
    acts.className = 'todo-actions';

    if (!t.done) {
      const sbtn = document.createElement('button');
      sbtn.className = t.running ? 'stop' : 'start';
      sbtn.textContent = t.running ? '⏸ 停止' : '▶ 開始';
      sbtn.addEventListener('click', () => toggleRun(t.id));
      acts.appendChild(sbtn);

      const fbtn = document.createElement('button');
      fbtn.className = 'finish'; fbtn.textContent = '✓ 終了';
      fbtn.addEventListener('click', () => finishTask(t.id));
      acts.appendChild(fbtn);
    }

    const dbtn = document.createElement('button');
    dbtn.className = 'del'; dbtn.textContent = '🗑'; dbtn.title = '削除';
    dbtn.addEventListener('click', () => deleteTask(t.id));
    acts.appendChild(dbtn);

    row.append(cb, txt, plan, el, acts);
    li.appendChild(row);

    // 完了時の差分表示 (+超過/赤、-短縮/緑)
    if (t.done && t.planMin) {
      const diffSec = t.elapsedSec - t.planMin * 60;
      const d = document.createElement('div');
      d.className = 'todo-diff ' + (diffSec > 0 ? 'pos' : 'neg');
      const abs = fmtTime(Math.abs(diffSec));
      d.textContent = diffSec > 0 ? `予定より +${abs} 超過` : `予定より -${abs} 短縮`;
      li.appendChild(d);
    }

    // 完了コメント欄
    if (t.done) {
      const nt = document.createElement('textarea');
      nt.className = 'todo-note';
      nt.placeholder = '実際にどこまで進んだか / 気づいたこと（ログに保存されます）';
      nt.value = t.note || '';
      nt.addEventListener('change', () => updateTaskNote(t.id, nt.value));
      li.appendChild(nt);
    }

    todoListEl.appendChild(li);
  });
}

function toggleRun(id) {
  const arr = getTodos(currentDate);
  const t = arr.find(x => x.id === id);
  if (!t || t.done) return;

  if (t.running) {
    t.elapsedSec += (Date.now() - t.startedAt) / 1000;
    t.running = false; t.startedAt = null;
  } else {
    stopAllRunningTasks();   // 同時走行は1タスクのみ
    t.running = true; t.startedAt = Date.now(); t.notified = false;
  }
  setTodos(currentDate, arr);
  renderTodos();
  renderActiveTimer();
}

function stopAllRunningTasks() {
  forEachAllTodos(t => {
    if (t.running && t.startedAt) {
      t.elapsedSec += (Date.now() - t.startedAt) / 1000;
      t.running = false; t.startedAt = null;
      return true;
    }
    return false;
  });
}

function uncompleteTask(id) {
  const arr = getTodos(currentDate);
  const t = arr.find(x => x.id === id);
  if (!t) return;
  t.done = false; t.finishedAt = null;
  setTodos(currentDate, arr);
  const log = loadJSON(LOG_KEY + currentDate, []);
  const idx = log.findIndex(x => x.id === id);
  if (idx >= 0) { log.splice(idx, 1); saveJSON(LOG_KEY + currentDate, log); }
  renderTodos(); renderTodoLog(); renderCalendar();
}

function finishTask(id) {
  const arr = getTodos(currentDate);
  const t = arr.find(x => x.id === id);
  if (!t) return;
  if (t.running && t.startedAt) {
    t.elapsedSec += (Date.now() - t.startedAt) / 1000;
    t.running = false; t.startedAt = null;
  }
  t.done = true; t.finishedAt = Date.now();
  const diffSec = t.planMin ? (t.elapsedSec - t.planMin * 60) : null;

  const log = loadJSON(LOG_KEY + currentDate, []);
  const entry = {
    id: t.id, text: t.text, planMin: t.planMin,
    elapsedSec: Math.round(t.elapsedSec),
    note: t.note || '',
    finishedAt: t.finishedAt,
    diffSec: diffSec == null ? null : Math.round(diffSec),
  };
  const existing = log.findIndex(x => x.id === id);
  if (existing >= 0) log[existing] = entry; else log.push(entry);
  saveJSON(LOG_KEY + currentDate, log);
  setTodos(currentDate, arr);
  renderTodos(); renderTodoLog(); renderActiveTimer(); renderCalendar();
}

function updateTaskNote(id, note) {
  const arr = getTodos(currentDate);
  const t = arr.find(x => x.id === id);
  if (!t) return;
  t.note = note;
  setTodos(currentDate, arr);
  const log = loadJSON(LOG_KEY + currentDate, []);
  const l = log.find(x => x.id === id);
  if (l) { l.note = note; saveJSON(LOG_KEY + currentDate, log); }
  renderTodoLog();
}

function deleteTask(id) {
  if (!confirm('このタスクを削除しますか？（完了ログは残ります）')) return;
  const arr = getTodos(currentDate).filter(x => x.id !== id);
  setTodos(currentDate, arr);
  renderTodos(); renderActiveTimer(); renderCalendar();
}

/* ---------- ToDo完了ログ ---------- */
const logEl = document.getElementById('todo-log');
const logEmpty = document.getElementById('todo-log-empty');

function renderTodoLog() {
  const log = loadJSON(LOG_KEY + currentDate, []);
  logEl.innerHTML = '';
  logEmpty.style.display = log.length ? 'none' : 'block';
  log.forEach(l => {
    const li = document.createElement('li');
    const title = document.createElement('div'); title.className = 'log-title'; title.textContent = l.text;
    const meta  = document.createElement('div'); meta.className  = 'log-meta';
    const parts = [`所要 ${fmtTime(l.elapsedSec)}`];
    if (l.planMin) parts.push(`予定 ${l.planMin}分`);
    if (l.diffSec != null) {
      const sign = l.diffSec >= 0 ? '+' : '-';
      parts.push(`差 ${sign}${fmtTime(Math.abs(l.diffSec))}`);
    }
    if (l.finishedAt) parts.push(new Date(l.finishedAt).toLocaleTimeString('ja-JP'));
    meta.textContent = parts.join(' / ');
    li.append(title, meta);
    if (l.note) {
      const nt = document.createElement('div'); nt.className = 'log-note'; nt.textContent = l.note;
      li.appendChild(nt);
    }
    logEl.appendChild(li);
  });
}

/* ---------- タイマータブ ---------- */
const activeTimerEl = document.getElementById('active-timer');
function findRunningTask() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(TODO_KEY)) continue;
    const date = key.slice(TODO_KEY.length);
    const arr = getTodos(date);
    const t = arr.find(x => x.running);
    if (t) return { task: t, date };
  }
  return null;
}

function renderActiveTimer() {
  const r = findRunningTask();
  if (!r) {
    activeTimerEl.innerHTML =
      '<div class="box-desc">ToDoタブのタスクで「▶ 開始」を押すとタイマーが動きます。<br>' +
      '予定(分)を設定したタスクは、超過時にブラウザ通知＆警告音でお知らせします。</div>';
    return;
  }
  const { task, date } = r;
  const elapsed = currentElapsed(task);
  const planSec = task.planMin ? task.planMin * 60 : null;

  const bigTime = document.createElement('div'); bigTime.className = 'big-time';
  bigTime.textContent = fmtTime(elapsed);

  const bigText = document.createElement('div'); bigText.className = 'big-text';
  bigText.textContent = `${task.text} （${fmtJP(date)}）`;

  const bigPlan = document.createElement('div'); bigPlan.className = 'big-plan';
  if (planSec != null) {
    const remain = planSec - elapsed;
    if (remain >= 0) bigPlan.textContent = `予定 ${task.planMin}分 / 残り ${fmtTime(remain)}`;
    else { bigPlan.textContent = `予定 ${task.planMin}分 / ⚠ 超過 +${fmtTime(-remain)}`; bigPlan.classList.add('over'); }
  } else {
    bigPlan.textContent = '予定時間なし（0秒から計測中）';
  }

  const row = document.createElement('div'); row.className = 'btn-row';
  const stop = document.createElement('button'); stop.className = 'link-btn sm'; stop.textContent = '⏸ 一時停止';
  stop.addEventListener('click', () => {
    const arr = getTodos(date);
    const t = arr.find(x => x.id === task.id);
    if (t && t.running) {
      t.elapsedSec += (Date.now() - t.startedAt) / 1000;
      t.running = false; t.startedAt = null;
      setTodos(date, arr);
      renderActiveTimer();
      if (date === currentDate) renderTodos();
    }
  });
  const fin = document.createElement('button'); fin.className = 'link-btn primary'; fin.textContent = '✓ 終了';
  fin.addEventListener('click', () => {
    const prev = currentDate;
    currentDate = date;   // その日のタスクとして確定
    diaryDate.textContent = currentDate;
    finishTask(task.id);
    currentDate = prev;
    diaryDate.textContent = currentDate;
    renderActiveTimer();
    renderTodos(); renderTodoLog(); renderCalendar();
  });
  row.append(stop, fin);

  activeTimerEl.innerHTML = '';
  activeTimerEl.append(bigTime, bigText, bigPlan, row);
}

/* 1秒ごとに走行中タスクの経過更新 + 予定超過通知 */
setInterval(() => {
  document.querySelectorAll('#todo-list .todo-item').forEach(li => {
    const id = Number(li.dataset.id);
    const t = getTodos(currentDate).find(x => x.id === id);
    if (!t || !t.running) return;
    const spanEl = li.querySelector('.todo-elapsed');
    if (spanEl) spanEl.textContent = fmtTime(currentElapsed(t));
  });
  renderActiveTimer();
  checkTimerNotification();
}, 1000);

/* ---------- 通知 ---------- */
const notifyBtn = document.getElementById('notify-enable');
const notifyStatus = document.getElementById('notify-status');
function updateNotifyStatus() {
  if (!('Notification' in window)) { notifyStatus.textContent = 'このブラウザは通知非対応'; return; }
  notifyStatus.textContent = `現在: ${Notification.permission}`;
}
notifyBtn.addEventListener('click', async () => {
  if (!('Notification' in window)) return;
  try { await Notification.requestPermission(); } catch {}
  updateNotifyStatus();
});
updateNotifyStatus();

function notifyUser(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body }); } catch {}
  }
  // ビープ音 (フォールバック/併用)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.08;
    o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 300);
  } catch {}
}

function checkTimerNotification() {
  forEachAllTodos(t => {
    if (!t.running || t.done || !t.planMin || t.notified) return false;
    const elapsed = currentElapsed(t);
    if (elapsed >= t.planMin * 60) {
      t.notified = true;
      notifyUser('⏰ 予定時間に到達', `${t.text}（${t.planMin}分）`);
      return true;
    }
    return false;
  });
}

/* ---------- 期間ふりかえり (ブラウザ内蔵AI → WebLLM 自動フォールバック) ----------
 * 戦略:
 *   1) window.ai (Chrome/Edge Prompt API, LanguageModel) が利用可能ならそれで生成
 *   2) 使えなければ WebLLM (@mlc-ai/web-llm) を CDN から動的 import してブラウザ内で実行
 *      - 既定モデル: Llama-3.2-1B-Instruct-q4f16_1 (約0.9GB、IndexedDB キャッシュ)
 *   3) どちらも不可なら対応外メッセージ
 * ユーザーは期間を選んでボタンを押すだけ。URL/APIキー/モデル指定は不要。
 */
const llmFrom   = document.getElementById('llm-from');
const llmTo     = document.getElementById('llm-to');
const llmOut    = document.getElementById('llm-output');
const llmStatus = document.getElementById('llm-status');
const llmSaveBtn = document.getElementById('llm-save');
const llmBackendNote = document.getElementById('llm-backend');
const llmProgress = document.getElementById('llm-progress');
const llmProgressFill = document.getElementById('llm-progress-fill');
const llmProgressText = document.getElementById('llm-progress-text');

/* 期間プリセット: 「今週」「今月」「直近3ヶ月」 */
function setRangeThisWeek() {
  const to = todayStr();
  const d = dateFromStr(to);
  const day = d.getDay(); // 0=Sun..6=Sat → 週始まりを月曜に
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  llmFrom.value = fmtDate(d.getFullYear(), d.getMonth(), d.getDate());
  llmTo.value = to;
}
function setRangeThisMonth() {
  const n = new Date();
  llmFrom.value = fmtDate(n.getFullYear(), n.getMonth(), 1);
  llmTo.value = todayStr();
}
function setRangeLast3Months() {
  const to = todayStr();
  const d = dateFromStr(to);
  d.setMonth(d.getMonth() - 3); d.setDate(d.getDate() + 1);
  llmFrom.value = fmtDate(d.getFullYear(), d.getMonth(), d.getDate());
  llmTo.value = to;
}

// 初期値: 今月
setRangeThisMonth();
document.getElementById('llm-range-week').addEventListener('click', setRangeThisWeek);
document.getElementById('llm-range-month').addEventListener('click', setRangeThisMonth);
document.getElementById('llm-range-3m').addEventListener('click', setRangeLast3Months);

function collectRange(from, to) {
  const rows = [];
  let cur = from;
  while (cur <= to) {
    const diary = localStorage.getItem(DIARY_KEY + cur) || '';
    const log = loadJSON(LOG_KEY + cur, []);
    if (diary || log.length) rows.push({ date: cur, diary, log });
    cur = addDays(cur, 1);
  }
  return rows;
}

function buildPrompt(rows, from, to) {
  const header =
    `以下は ${from} から ${to} までの個人の日々の記録です。` +
    `各日の「日記(今日あったこと)」と「完了したToDoタスク(所要時間・予定差分・コメント)」を踏まえ、` +
    `この期間に何があったかを日本語で分かりやすくまとめてください。要約ではなく、期間のふりかえりとして次の構成で出力:\n\n` +
    `## 期間ハイライト\n(印象的だった出来事・できごとを3〜5点)\n\n` +
    `## 時間の使い方\n(どんなタスクに時間を使ったか、予定との差分の傾向)\n\n` +
    `## 気づき / 次にやること\n(今後に活かせる学びや次のアクションを2〜3点)\n\n---\n\n`;
  const body = rows.map(r => {
    const lines = [`### ${r.date}`];
    if (r.diary) lines.push(`[日記] ${r.diary}`);
    if (r.log.length) {
      lines.push('[完了ToDo]');
      r.log.forEach(l => {
        const diff = l.diffSec == null ? '' :
          (l.diffSec >= 0 ? ` 差+${Math.round(l.diffSec/60)}分` : ` 差${Math.round(l.diffSec/60)}分`);
        lines.push(`- ${l.text} (所要${Math.round(l.elapsedSec/60)}分${l.planMin?` 予定${l.planMin}分${diff}`:''})${l.note?` / ${l.note}`:''}`);
      });
    }
    return lines.join('\n');
  }).join('\n\n');
  return header + body;
}

/* ---------- バックエンド: window.ai (Chrome/Edge 組み込みAI) ---------- */
async function tryBuiltinAI(prompt, onToken) {
  // 複数バージョンのAPI形に対応
  //  - 新: window.LanguageModel (Chrome 138+ 相当)
  //  - 旧: window.ai.languageModel
  //  - 旧: window.ai.createTextSession
  let session = null;
  let backendName = null;

  // Chrome の新 API では outputLanguage / expectedInputLanguages を指定しないと
  // 生成がブロックまたは警告される。日本語固定で指定する。
  const CREATE_OPTS = {
    outputLanguage: 'ja',
    expectedInputLanguages: ['ja'],
    initialPrompts: [
      { role: 'system', content: 'あなたは個人の日々の記録を日本語でわかりやすく振り返るアシスタントです。必ず日本語で回答してください。' },
    ],
  };

  if (typeof window.LanguageModel !== 'undefined' && window.LanguageModel.create) {
    const params = typeof window.LanguageModel.availability === 'function'
      ? await window.LanguageModel.availability(CREATE_OPTS) : 'available';
    if (params === 'unavailable') return null;
    // "downloadable" / "downloading" の場合もセッション作成でモデル取得が開始される
    session = await window.LanguageModel.create(CREATE_OPTS);
    backendName = 'Chrome/Edge 組み込みAI (Prompt API)';
  } else if (window.ai && window.ai.languageModel && window.ai.languageModel.create) {
    const caps = window.ai.languageModel.capabilities ? await window.ai.languageModel.capabilities() : { available: 'readily' };
    if (caps.available === 'no') return null;
    session = await window.ai.languageModel.create(CREATE_OPTS);
    backendName = 'ブラウザ組み込みAI (window.ai)';
  } else if (window.ai && typeof window.ai.createTextSession === 'function') {
    session = await window.ai.createTextSession();
    backendName = 'ブラウザ組み込みAI (window.ai)';
  } else {
    return null;
  }

  llmBackendNote.textContent = `バックエンド: ${backendName}`;
  llmStatus.textContent = '生成中…(組み込みAI)';

  // ストリーミング (promptStreaming) が使えればそれで、無ければ一括
  let text = '';
  if (session.promptStreaming) {
    const stream = await session.promptStreaming(prompt);
    // 実装により非同期イテレータ or ReadableStream
    if (stream && stream[Symbol.asyncIterator]) {
      for await (const chunk of stream) {
        if (typeof chunk === 'string') {
          // 新APIは累計で来るバージョンと差分で来るバージョンがあるので、
          // 長くなった場合は差分追記、既存プレフィックスなら累計置換とみなす。
          if (chunk.startsWith(text)) {
            text = chunk;
          } else {
            text += chunk;
          }
          onToken(text);
        }
      }
    } else if (stream && typeof stream.getReader === 'function') {
      const reader = stream.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const piece = typeof value === 'string' ? value : dec.decode(value);
        text += piece;
        onToken(text);
      }
    }
  } else {
    text = await session.prompt(prompt);
    onToken(text);
  }

  // ストリーミングで何も返ってこなかった場合、同一セッションで一括取得を試す
  if ((!text || !text.trim()) && typeof session.prompt === 'function') {
    try {
      const t2 = await session.prompt(prompt);
      if (t2 && t2.trim()) { text = t2; onToken(text); }
    } catch (e) {
      console.warn('Built-in AI prompt() fallback failed:', e);
    }
  }

  try { session.destroy && session.destroy(); } catch {}

  // 空応答の場合はフォールバックを試みるため null を返す
  if (!text || !text.trim()) {
    console.warn('Built-in AI returned empty output; falling back to WebLLM');
    return null;
  }
  return text;
}

/* ---------- バックエンド: WebLLM (CDN 動的 import) ---------- */
let _webllmEngine = null;

async function tryWebLLM(prompt, onToken) {
  llmBackendNote.textContent = 'バックエンド: WebLLM (ブラウザ内モデル)';

  // WebGPU 必須
  if (!('gpu' in navigator)) {
    throw new Error('このブラウザは WebGPU 非対応のため、ブラウザ内AIを利用できません。Chrome / Edge の最新版をお試しください。');
  }

  // 動的 import (file:// 環境では CORS で失敗することあり → 呼び出し元でハンドリング)
  if (!_webllmEngine) {
    llmStatus.textContent = 'ブラウザ内AIを準備しています…';
    const mod = await import('https://esm.run/@mlc-ai/web-llm');
    const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

    llmProgress.hidden = false;
    _webllmEngine = await mod.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report) => {
        // report.progress: 0..1, report.text: 進捗テキスト
        const pct = Math.round((report.progress || 0) * 100);
        llmProgressFill.style.width = pct + '%';
        llmProgressText.textContent = `${pct}% ${report.text || ''}`;
        if (report.text && report.text.includes('Finish')) {
          llmProgressText.textContent = 'モデルの準備が完了しました';
        }
      },
    });
    llmProgress.hidden = true;
  }

  llmStatus.textContent = '生成中…';
  let text = '';
  const stream = await _webllmEngine.chat.completions.create({
    messages: [
      { role: 'system', content: 'あなたは個人の日々の記録を日本語で分かりやすく振り返るアシスタントです。' },
      { role: 'user', content: prompt },
    ],
    stream: true,
    temperature: 0.7,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content || '';
    if (delta) { text += delta; onToken(text); }
  }
  return text;
}

/* ---------- メイン実行 ---------- */
let _running = false;
async function runLLM() {
  if (_running) return;
  const from = llmFrom.value, to = llmTo.value;
  llmStatus.classList.remove('err');
  if (!from || !to) { llmStatus.textContent = '期間を指定してください'; llmStatus.classList.add('err'); return; }
  if (from > to)    { llmStatus.textContent = '開始日が終了日より後です'; llmStatus.classList.add('err'); return; }

  const rows = collectRange(from, to);
  if (!rows.length) {
    llmOut.textContent = '指定期間に日記・ToDoログがありません。';
    llmStatus.textContent = ''; llmSaveBtn.disabled = true; return;
  }
  const prompt = buildPrompt(rows, from, to);

  _running = true;
  llmSaveBtn.disabled = true;
  llmOut.textContent = '';
  llmStatus.textContent = 'バックエンドを選択中…';
  llmBackendNote.textContent = '';
  let backendUsed = null;
  let text = '';

  const onToken = t => { text = t; llmOut.textContent = t; };

  try {
    // 1) 組み込みAI
    try {
      const r = await tryBuiltinAI(prompt, onToken);
      if (r !== null) { backendUsed = 'builtin'; text = r; }
    } catch (e) {
      console.warn('Builtin AI failed:', e);
    }

    // 2) WebLLM フォールバック
    if (backendUsed == null) {
      try {
        const r = await tryWebLLM(prompt, onToken);
        backendUsed = 'webllm'; text = r;
      } catch (e) {
        throw new Error(
          `このブラウザではふりかえりを実行できませんでした。\n\n` +
          `原因: ${e.message}\n\n` +
          `対応ブラウザ: Chrome 127+ / Edge 128+ の最新版(WebGPU 有効)。\n` +
          `※ index.html をローカルファイル(file://)で開いている場合、ブラウザの制限で` +
          `AIライブラリの読み込みが拒否されることがあります。その場合は Chrome/Edge をご利用ください。`
        );
      }
    }

    llmStatus.textContent = '完了';
    llmSaveBtn.disabled = !text.trim();
    llmSaveBtn.onclick = () => {
      const saved = loadJSON(LLM_KEY, []);
      saved.unshift({
        id: Date.now(), from, to,
        backend: backendUsed,
        savedAt: Date.now(),
        text, days: rows.length,
      });
      saveJSON(LLM_KEY, saved.slice(0, 50));
      renderSavedSummaries();
      llmStatus.textContent = '保存しました';
    };
  } catch (e) {
    llmStatus.classList.add('err');
    llmStatus.textContent = '実行できません';
    llmOut.textContent = e.message;
  } finally {
    _running = false;
  }
}
document.getElementById('llm-run').addEventListener('click', runLLM);

const savedUl = document.getElementById('llm-saved');
const savedEmpty = document.getElementById('llm-saved-empty');
function renderSavedSummaries() {
  const arr = loadJSON(LLM_KEY, []);
  savedUl.innerHTML = '';
  savedEmpty.style.display = arr.length ? 'none' : 'block';
  arr.forEach(s => {
    const li = document.createElement('li');
    const title = document.createElement('div'); title.className = 'log-title';
    const backendLabel = s.backend === 'builtin' ? '組み込みAI'
                     : s.backend === 'webllm'  ? 'WebLLM'
                     : (s.model || '—');
    title.textContent = `${s.from} 〜 ${s.to}  [${backendLabel}]`;
    const meta = document.createElement('div'); meta.className = 'log-meta';
    meta.textContent = `${new Date(s.savedAt).toLocaleString('ja-JP')} / ${s.days}日分`;
    const note = document.createElement('div'); note.className = 'log-note';
    note.textContent = s.text;
    const del = document.createElement('button'); del.className = 'link-btn sm danger';
    del.textContent = '削除'; del.style.marginTop = '4px';
    del.addEventListener('click', () => {
      const next = loadJSON(LLM_KEY, []).filter(x => x.id !== s.id);
      saveJSON(LLM_KEY, next); renderSavedSummaries();
    });
    li.append(title, meta, note, del);
    savedUl.appendChild(li);
  });
}
renderSavedSummaries();

/* 起動時にバックエンドの状態を示唆 */
(function initBackendHint() {
  if (typeof window.LanguageModel !== 'undefined'
      || (window.ai && (window.ai.languageModel || window.ai.createTextSession))) {
    llmBackendNote.textContent = 'バックエンド候補: ブラウザ組み込みAI (準備済み)';
  } else if ('gpu' in navigator) {
    llmBackendNote.textContent = 'バックエンド候補: WebLLM (初回のみ約1GBをダウンロード)';
  } else {
    llmBackendNote.textContent = 'このブラウザでは組み込みAI / WebLLM いずれも利用できません';
  }
})();

/* ---------- 初期化 ---------- */
setCurrentDate(currentDate);
renderActiveTimer();

renderCalendar();
