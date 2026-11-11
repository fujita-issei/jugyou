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

/* ---------- 単独タイマー (ToDo に紐づかないタイマー) ----------
 * - 何の時間か(ラベル)と予定(分)はどちらも任意
 * - 状態は localStorage に保存するので、再読み込みしても計測は続く
 * - 「終了して記録」で solotimerlog:YYYY-MM-DD に記録し、ふりかえりの材料にもなる
 * - タスクのタイマーとは独立して動く
 */
const SOLO_KEY = 'solotimer';
const SOLO_LOG_KEY = 'solotimerlog:';   // solotimerlog:YYYY-MM-DD
const soloLabelEl = document.getElementById('solo-label');
const soloPlanEl  = document.getElementById('solo-plan');
const soloTimeEl  = document.getElementById('solo-time');
const soloPlanInfoEl = document.getElementById('solo-plan-info');
const soloStartBtn  = document.getElementById('solo-start');
const soloFinishBtn = document.getElementById('solo-finish');
const soloResetBtn  = document.getElementById('solo-reset');
const soloLogEl = document.getElementById('solo-log');
const soloLogEmptyEl = document.getElementById('solo-log-empty');

const SOLO_DEFAULT = { label: '', planMin: null, elapsedSec: 0, running: false, startedAt: null, notified: false, startDate: null };
const getSolo = () => ({ ...SOLO_DEFAULT, ...loadJSON(SOLO_KEY, {}) });
const setSolo = s => saveJSON(SOLO_KEY, s);
const soloElapsed = s => s.running && s.startedAt ? s.elapsedSec + (Date.now() - s.startedAt) / 1000 : s.elapsedSec;

// 入力欄の値はその場で保存(計測中にラベルを書き足してもよい)
soloLabelEl.addEventListener('input', () => { const s = getSolo(); s.label = soloLabelEl.value; setSolo(s); });
soloPlanEl.addEventListener('input', () => {
  const s = getSolo(); s.planMin = Number(soloPlanEl.value) || null; s.notified = false; setSolo(s); renderSolo();
});

soloStartBtn.addEventListener('click', () => {
  const s = getSolo();
  if (s.running) {
    s.elapsedSec += (Date.now() - s.startedAt) / 1000;
    s.running = false; s.startedAt = null;
  } else {
    s.running = true; s.startedAt = Date.now();
    if (!s.startDate) s.startDate = todayStr();
  }
  setSolo(s); renderSolo();
});

soloFinishBtn.addEventListener('click', () => {
  const s = getSolo();
  const elapsed = soloElapsed(s);
  if (elapsed < 1) return;
  const date = todayStr();
  const log = loadJSON(SOLO_LOG_KEY + date, []);
  log.push({
    id: Date.now(),
    label: (s.label || '').trim(),
    planMin: s.planMin,
    elapsedSec: Math.round(elapsed),
    diffSec: s.planMin ? Math.round(elapsed - s.planMin * 60) : null,
    finishedAt: Date.now(),
  });
  saveJSON(SOLO_LOG_KEY + date, log);
  // ラベルと予定は次回のために残し、時間だけ戻す
  setSolo({ ...SOLO_DEFAULT, label: s.label, planMin: s.planMin });
  renderSolo(); renderSoloLog();
});

soloResetBtn.addEventListener('click', () => {
  const s = getSolo();
  if (soloElapsed(s) >= 1 && !confirm('記録せずに時間を0に戻しますか？')) return;
  setSolo({ ...SOLO_DEFAULT, label: s.label, planMin: s.planMin });
  renderSolo();
});

function renderSolo() {
  const s = getSolo();
  const elapsed = soloElapsed(s);
  soloTimeEl.textContent = fmtTime(elapsed);
  if (document.activeElement !== soloLabelEl) soloLabelEl.value = s.label || '';
  if (document.activeElement !== soloPlanEl)  soloPlanEl.value = s.planMin || '';
  soloPlanInfoEl.classList.remove('over');
  if (s.planMin) {
    const remain = s.planMin * 60 - elapsed;
    if (remain >= 0) soloPlanInfoEl.textContent = `予定 ${s.planMin}分 / 残り ${fmtTime(remain)}`;
    else { soloPlanInfoEl.textContent = `予定 ${s.planMin}分 / ⚠ 超過 +${fmtTime(-remain)}`; soloPlanInfoEl.classList.add('over'); }
  } else {
    soloPlanInfoEl.textContent = '予定時間なし（0秒から計測）';
  }
  soloStartBtn.textContent = s.running ? '⏸ 一時停止' : (elapsed >= 1 ? '▶ 再開' : '▶ 開始');
  soloFinishBtn.disabled = elapsed < 1;
  soloResetBtn.disabled = elapsed < 1;
}

function renderSoloLog() {
  const log = loadJSON(SOLO_LOG_KEY + todayStr(), []);
  soloLogEl.innerHTML = '';
  soloLogEmptyEl.style.display = log.length ? 'none' : 'block';
  log.forEach(l => {
    const li = document.createElement('li');
    const title = document.createElement('div'); title.className = 'log-title';
    title.textContent = l.label || '（名前なし）';
    const meta = document.createElement('div'); meta.className = 'log-meta';
    const parts = [`所要 ${fmtTime(l.elapsedSec)}`];
    if (l.planMin) parts.push(`予定 ${l.planMin}分`);
    if (l.diffSec != null) parts.push(`差 ${l.diffSec >= 0 ? '+' : '-'}${fmtTime(Math.abs(l.diffSec))}`);
    if (l.finishedAt) parts.push(new Date(l.finishedAt).toLocaleTimeString('ja-JP'));
    meta.textContent = parts.join(' / ');
    li.append(title, meta);
    soloLogEl.appendChild(li);
  });
}

function checkSoloNotification() {
  const s = getSolo();
  if (!s.running || !s.planMin || s.notified) return;
  if (soloElapsed(s) >= s.planMin * 60) {
    s.notified = true; setSolo(s);
    notifyUser('⏰ 予定時間に到達', `${s.label || 'タイマー'}（${s.planMin}分）`);
  }
}

renderSolo();
renderSoloLog();
let _soloLogDate = todayStr();
setInterval(() => {
  renderSolo();
  checkSoloNotification();
  // 日付が変わったら「今日の記録」を切り替える
  if (todayStr() !== _soloLogDate) { _soloLogDate = todayStr(); renderSoloLog(); }
}, 1000);

/* ---------- 期間ふりかえり (ブラウザ内蔵AI → WebLLM 自動フォールバック) ----------
 * 戦略:
 *   1) window.ai (Chrome/Edge Prompt API, LanguageModel) が利用可能ならそれで生成
 *   2) 使えなければ WebLLM (@mlc-ai/web-llm) を CDN から動的 import してブラウザ内で実行
 *      - 既定モデル: Qwen2.5-1.5B-Instruct-q4f16_1 (約1GB、ブラウザにキャッシュ)。日本語のため Llama-3.2-1B から変更
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
    // 期間内に登録されたまま完了していない ToDo(「次にやること」の根拠)
    const pending = (loadJSON(TODO_KEY + cur, []) || []).filter(t => t && !t.done);
    const solo = loadJSON(SOLO_LOG_KEY + cur, []);   // 単独タイマーの記録
    if (diary || log.length || pending.length || solo.length) rows.push({ date: cur, diary, log, pending, solo });
    cur = addDays(cur, 1);
  }
  return rows;
}

/* 期間の翌日から days 日間に、すでに登録されている未完了 ToDo(予定済みの「次にやること」) */
const UPCOMING_DAYS = 14;
function collectUpcoming(to, days = UPCOMING_DAYS) {
  const out = [];
  let cur = addDays(to, 1);
  for (let i = 0; i < days; i++) {
    (loadJSON(TODO_KEY + cur, []) || []).forEach(t => {
      if (t && !t.done) out.push({ date: cur, text: t.text, planMin: t.planMin });
    });
    cur = addDays(cur, 1);
  }
  return out;
}

/* ふりかえりの組み立て方
 * 以前は日記と ToDo を日付ごとに混ぜて1回で生成させていたが、小型モデルは整形された
 * ToDo 行だけを拾い、日記を無視した。そこでセクションごとに分ける:
 *   ## 期間のできごと   … 日記「だけ」を渡して LLM で文章化
 *   ## タスクの取り組み … 合計時間などは JS で正確に計算し、LLM はそれを文章化するだけ
 *      次にやること:     … LLM を使わず、未完了/予定済み ToDo を JS で列挙(作り話の余地をなくす)
 * データが無いセクションは LLM を呼ばずに「記録なし」とする。
 */
/* 期間のできごと は2段階で作る。
 *   1) 抜き出し: 日記の区切りごとに「したこと」を短い行で抜き出す(日付なし・決まり文句なし)
 *   2) 振り返り: 抜き出した一覧だけを渡し、似た活動をまとめて期間を通した振り返り文にする
 * 1回で「漏れなく・正確に」と「まとめる」を同時に求めると、小型モデルは書き写すか作り話をする。
 * 以前のプロンプトは「すべての日に1文ずつ」と指示し、日付見出し付きで渡していたため、日ごとの羅列になっていた。
 */
const DIARY_EXTRACT_PROMPT = [
  'あなたは日記から事実を抜き出す係です。',
  '<data> の日記から、書いた人がしたこと・起きた出来事を抜き出してください。',
  '',
  '# 出力の形',
  '- 1行に1つ、「- 」で始めて、20字程度の短い言い方で書く(例の形: 「- 〇〇で△△をした」)。',
  '- 日付・曜日は書かない。',
  '- 人名・場所・作品名・数字は日記に書かれたとおりに残す。',
  '- 夕飯・就寝・「落ち着いた一日だった」など、毎日のように繰り返す決まった内容は抜き出さない。',
  '- 日記に書かれていないことは書かない。感想や説明も付けない。',
  '- 抜き出した行以外は何も出力しない。',
].join('\n');

/* 分類: 抜き出した各行を決まったテーマに振り分ける(選ぶだけなので小型モデルでも安定する) */
const DIARY_THEMES = ['勉強・卒論', '就職活動', 'アルバイト・仕事', '家族・友人', '健康・運動', '趣味・買い物・生活', 'その他'];
const DIARY_CLASSIFY_PROMPT = [
  'あなたは出来事をテーマに分類する係です。',
  '<data> の各行(番号付き)を、次のテーマのどれか1つに分類してください。',
  'テーマ: ' + DIARY_THEMES.join(' / '),
  '',
  '# 出力の形',
  '- 1行に1つ、「番号: テーマ」の形で書く(例の形: 「3: 健康・運動」)。',
  '- テーマは上の一覧の表記どおりに書く。',
  '- すべての番号について書く。それ以外は何も出力しない。',
].join('\n');

/* 振り返り: テーマ1つにつき1回呼び、そのテーマのメモだけを1文にまとめさせる。
 * 全テーマを一度に渡すと、2B モデルは1文に詰め込んだり、日付・評価・作り話(「入院」等)を足したりした。 */
const DIARY_REFLECT_PROMPT = [
  'あなたは、同じテーマの出来事メモを、日本語の1文にまとめる係です。',
  '',
  '# 書き方',
  '- <data> のメモを、指定された文数(1文は70字以内)にまとめる。',
  '- メモを全部並べるのではなく、似たものはまとめて言い換える。',
  '- メモの前半だけでなく後半も見て、提出・発表・参加・指摘・手伝いなど、その期間ならではの出来事を優先して入れる。',
  '  (例の考え方: 「計画書を提出」「先生から指摘」「中間発表」 → 「卒論は計画書の提出や中間発表を進め、先生から指摘も受けた。」)',
  '- 具体的な名前(人・場所・作品など)があれば1〜2個残す。',
  '- 「〜した。」「〜もあった。」のような、ふりかえる文体(常体)で書く。「です・ます」は使わない。',
  '- 出力はその文だけ。前置き・見出し・箇条書きは書かない。日本語だけで書く。',
  '',
  '# 想像で書かない(最重要)',
  '- メモにない出来事・人物・場所・感情・理由を足さない。',
  '- 日付・曜日・頻度(「毎日」「週末」など)を書かない。',
  '- 出来事の結果や効果を足さない。(悪い例: 「絆を深めた」「体調を回復させた」「方向性が明確になった」)',
  '- 出来事を評価・意味づけしない。(悪い例: 「充実」「成長」「楽しかった」)',
].join('\n');

const fmtMin = sec => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}時間${m % 60 ? (m % 60) + '分' : ''}` : `${m}分`;
};

/* 日記を約 maxChars 文字ずつ、日付順のまとまりに分ける。
 * WebLLM のモデルは入力が 4096 トークンまでなので、1か月分などを一度に渡すと溢れる。
 * まとまりごとに生成すれば、離れた日の出来事を混同することもない。 */
// 検証で 18日分(約1400字)を一度に渡すと、2B モデルは大半の日を飛ばしたため、小さめに区切る
const DIARY_CHUNK_CHARS = 700;
function chunkDiaryRows(rows, maxChars = DIARY_CHUNK_CHARS) {
  const chunks = []; let cur = []; let size = 0;
  rows.filter(r => r.diary.trim()).forEach(r => {
    const len = r.diary.trim().length + 20;
    if (cur.length && size + len > maxChars) { chunks.push(cur); cur = []; size = 0; }
    cur.push(r); size += len;
  });
  if (cur.length) chunks.push(cur);
  return chunks;
}

/* 抜き出し用: 日付見出しは付けない(付けるとモデルが日付ごとの構造を真似る) */
function buildExtractUser(rows) {
  const body = rows.filter(r => r.diary.trim())
    // 1日分が極端に長い場合も入力上限を超えないよう切り詰める
    .map(r => r.diary.trim().slice(0, 2500)).join('\n---\n');
  return ['次の <data> の日記から、したこと・出来事を抜き出してください。', '', '<data>', body, '</data>'].join('\n');
}

/* 抜き出し結果を行の配列に(「- 」「・」付きの行を優先) */
function parseExtracted(text) {
  const lines = stripThink(text).split('\n').map(s => s.trim()).filter(Boolean);
  const bullets = lines.filter(s => /^[-・*•]/.test(s)).map(s => s.replace(/^[-・*•]\s*/, ''));
  return (bullets.length ? bullets : lines).filter(s => s.length <= 80);
}

function buildClassifyUser(items) {
  return ['次の <data> の各行を分類してください。', '', '<data>',
    items.map((s, i) => `${i + 1}. ${s}`).join('\n'), '</data>'].join('\n');
}

/* 「番号: テーマ」を解釈して、テーマごとの配列にする(読めない行は「その他」) */
function groupByTheme(items, classifyText) {
  const themeOf = new Array(items.length).fill('その他');
  stripThink(classifyText || '').split('\n').forEach(line => {
    const m = line.match(/(\d+)\s*[:：.．、]\s*(.+)/);
    if (!m) return;
    const idx = Number(m[1]) - 1;
    const th = DIARY_THEMES.find(t => m[2].includes(t)) ||
               DIARY_THEMES.find(t => t.split('・').some(w => m[2].includes(w)));
    if (idx >= 0 && idx < items.length && th) themeOf[idx] = th;
  });
  const groups = DIARY_THEMES.map(t => ({ theme: t, items: items.filter((_, i) => themeOf[i] === t) }))
    .filter(g => g.items.length);
  // 件数の多い順(「その他」は最後)
  return groups.sort((a, b) => (a.theme === 'その他') - (b.theme === 'その他') || b.items.length - a.items.length);
}

/* 冒頭の1文は件数から JS で作る(中心だった取り組みを LLM に推測させない) */
function buildLeadSentence(groups) {
  const main = groups.filter(g => g.theme !== 'その他');
  if (!main.length) return '';
  const top = main.length >= 2 && main[1].items.length >= Math.max(2, main[0].items.length / 2)
    ? `${main[0].theme}と${main[1].theme}` : main[0].theme;
  return `この期間は${top}に関することが中心だった。`;
}

/* メモが多いテーマは2文まで(1文に詰めると前半しか拾われなかったため) */
const sentenceCount = group => group.items.length >= 5 ? 2 : 1;

function buildReflectUser(group) {
  return [
    `テーマ: ${group.theme}`,
    `次の <data> のメモを${sentenceCount(group)}文にまとめてください。`,
    '', '<data>', group.items.map(s => '- ' + s).join('\n'), '</data>',
  ].join('\n');
}

/* 先頭から n 文だけ取り出す(余計な改行や箇条書き記号、それ以降の文を落とす) */
function firstSentences(text, n = 1) {
  const t = stripThink(text || '').replace(/^[-・*•\s]+/gm, '').replace(/\s*\n+\s*/g, '').trim();
  const parts = t.match(/[^。]*。/g) || [];
  if (parts.length) return parts.slice(0, n).join('');
  return t ? t + '。' : '';
}

/* 完了タスクとタイマー記録を集計(数字は LLM に計算させない) */
function summarizeTasks(rows) {
  const items = [];
  rows.forEach(r => {
    r.log.forEach(l => items.push({ kind: 'ToDo', date: r.date, name: l.text, ...l }));
    (r.solo || []).forEach(l => items.push({ kind: 'タイマー', date: r.date, name: l.label || '（名前なし）', ...l }));
  });
  const byName = new Map();
  items.forEach(i => {
    const k = `${i.kind}:${i.name}`;
    const g = byName.get(k) || { kind: i.kind, name: i.name, count: 0, sec: 0 };
    g.count++; g.sec += i.elapsedSec || 0;
    byName.set(k, g);
  });
  const planned = items.filter(i => i.planMin && i.diffSec != null);
  const over = planned.filter(i => i.diffSec > 0);
  return {
    items,
    groups: [...byName.values()].sort((a, b) => b.sec - a.sec),
    totalSec: items.reduce((s, i) => s + (i.elapsedSec || 0), 0),
    plannedCount: planned.length,
    overCount: over.length,
    overSec: over.reduce((s, i) => s + i.diffSec, 0),
    underCount: planned.length - over.length,
  };
}

/* タスクの取り組み: 検証で小型モデルが数字や日付を書き換えたため、LLM を使わず記録から組み立てる */
function buildTaskSection(rows) {
  const s = summarizeTasks(rows);
  if (!s.items.length) return '完了したタスク・タイマーの記録なし';
  const lines = [`完了したタスクとタイマー記録は${s.items.length}件、合計${fmtMin(s.totalSec)}でした。`];
  s.groups.forEach(g => lines.push(`- ${g.name}（${g.kind}）: ${g.count}回・${fmtMin(g.sec)}`));
  if (s.plannedCount) {
    lines.push(`予定時間を決めていた${s.plannedCount}件のうち、予定内に終わったのは${s.underCount}件、予定を超えたのは${s.overCount}件` +
      (s.overCount ? `（超過の合計${fmtMin(s.overSec)}）` : '') + 'でした。');
  }
  const notes = s.items.filter(i => i.note && i.note.trim());
  if (notes.length) {
    lines.push('コメント:');
    notes.forEach(i => lines.push(`- ${fmtJP(i.date)}「${i.name}」: ${i.note.trim()}`));
  }
  return lines.join('\n');
}

/* 次にやること: LLM を使わず記録から列挙 */
function buildNextList(rows, to) {
  const out = [];
  rows.forEach(r => (r.pending || []).forEach(t =>
    out.push(`- ${t.text}（${fmtJP(r.date)}に登録・未完了）`)));
  collectUpcoming(to).forEach(u =>
    out.push(`- ${u.text}（${fmtJP(u.date)}の予定）`));
  return out.length ? out.join('\n') : '- 記録なし';
}

/* ---------- バックエンド: window.ai (Chrome/Edge 組み込みAI) ---------- */
async function tryBuiltinAI({ system, user }, onToken) {
  // 複数バージョンのAPI形に対応
  //  - 新: window.LanguageModel (Chrome 138+ 相当)
  //  - 旧: window.ai.languageModel
  //  - 旧: window.ai.createTextSession
  let session = null;
  let backendName = null;

  const CREATE_OPTS = {
    outputLanguage: 'ja',
    expectedInputLanguages: ['ja'],
    temperature: 0.1,
    topK: 3,
    initialPrompts: [
      { role: 'system', content: system },
    ],
  };

  if (typeof window.LanguageModel !== 'undefined' && window.LanguageModel.create) {
    const avail = typeof window.LanguageModel.availability === 'function'
      ? await window.LanguageModel.availability(CREATE_OPTS) : 'available';

    if (avail === 'unavailable') {
      throw new Error('Chrome 組み込みAI(LanguageModel)は現在の環境では unavailable です。chrome://on-device-internals で状態を確認してください。');
    }

    // availability が 'downloadable' / 'downloading' の場合、create() は
    // Gemini Nano(数GB)のDLを開始し完了まで戻らない。環境によっては DL が
    // 実質進まず延々待たされるため、既定ではここで即スキップして
    // 次のバックエンド(WebLLM)に回す。
    // 強制的に組み込みAI を使いたい場合は URL に ?force-builtin を付けると
    // DL を開始する(タイムアウト 10 分)。
    llmStatus.textContent = `組み込みAI availability=${avail}`;
    const needsDownload = (avail === 'downloadable' || avail === 'downloading');
    const forceBuiltin = new URLSearchParams(location.search).has('force-builtin');

    if (needsDownload && !forceBuiltin) {
      throw new Error(
        `組み込みAI は モデル(Gemini Nano)を未ダウンロードです(availability=${avail})。` +
        '次のバックエンド(WebLLM)に切り替えます。' +
        '組み込みAIで試したい場合は URL に ?force-builtin を付けて開き直してください。'
      );
    }

    if (needsDownload) {
      llmProgress.hidden = false;
      llmProgressFill.style.width = '0%';
      llmProgressText.textContent = '組み込みAIモデル(Gemini Nano)をダウンロード中…';
    }

    const createOpts = { ...CREATE_OPTS };
    createOpts.monitor = (m) => {
      m.addEventListener('downloadprogress', (ev) => {
        const ratio = typeof ev.loaded === 'number' && ev.loaded <= 1
          ? ev.loaded
          : (ev.total ? ev.loaded / ev.total : 0);
        const pct = Math.round(ratio * 100);
        llmProgress.hidden = false;
        llmProgressFill.style.width = pct + '%';
        llmProgressText.textContent = `組み込みAIモデル: ${pct}%`;
      });
    };

    // タイムアウト付き create: DL中は10分、通常は60秒
    const createPromise = window.LanguageModel.create(createOpts);
    const timeoutMs = needsDownload ? 10 * 60 * 1000 : 60 * 1000;
    session = await Promise.race([
      createPromise,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error(`組み込みAIのセッション作成が ${Math.round(timeoutMs/1000)}秒以内に完了しませんでした${needsDownload ? '(モデルDL中の可能性)' : ''}。次のバックエンドを試します。`)),
        timeoutMs
      )),
    ]);
    llmProgress.hidden = true;
    backendName = 'Chrome/Edge 組み込みAI (Prompt API)';
  } else if (window.ai && window.ai.languageModel && window.ai.languageModel.create) {
    const caps = window.ai.languageModel.capabilities ? await window.ai.languageModel.capabilities() : { available: 'readily' };
    if (caps.available === 'no') {
      throw new Error('window.ai.languageModel.capabilities()=no のため利用できません。');
    }
    session = await window.ai.languageModel.create(CREATE_OPTS);
    backendName = 'ブラウザ組み込みAI (window.ai)';
  } else if (window.ai && typeof window.ai.createTextSession === 'function') {
    session = await window.ai.createTextSession();
    backendName = 'ブラウザ組み込みAI (window.ai)';
  } else {
    throw new Error('Chrome 組み込みAI(LanguageModel / window.ai)が存在しません。Chrome の最新版および chrome://flags で Prompt API を有効化してください。');
  }

  llmBackendNote.textContent = `バックエンド: ${backendName}`;
  llmStatus.textContent = '生成中…(組み込みAI)';

  const promptBody = backendName.includes('window.ai') && typeof session.prompt === 'function' && !session.promptStreaming
    ? (system + '\n\n---\n\n' + user)  // 旧API互換
    : user;

  // 60秒以内に prompt() が解決しない場合はタイムアウトしてフォールバック
  const withTimeout = (p, ms, label) => Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} が ${ms/1000}秒以内に応答しませんでした`)), ms)),
  ]);

  let text = '';
  if (session.promptStreaming) {
    try {
      const stream = await session.promptStreaming(promptBody);
      if (stream && stream[Symbol.asyncIterator]) {
        for await (const chunk of stream) {
          if (typeof chunk === 'string') {
            if (chunk.startsWith(text)) text = chunk; else text += chunk;
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
    } catch (e) {
      console.warn('promptStreaming failed:', e);
    }
  } else {
    try {
      text = await withTimeout(session.prompt(promptBody), 90 * 1000, '組み込みAI prompt()');
      onToken(text);
    } catch (e) {
      console.warn('prompt() failed:', e);
    }
  }

  // ストリーミングが空のときは一括取得(タイムアウト付き)を試す
  if ((!text || !text.trim()) && typeof session.prompt === 'function') {
    try {
      const t2 = await withTimeout(session.prompt(promptBody), 90 * 1000, '組み込みAI prompt() フォールバック');
      if (t2 && t2.trim()) { text = t2; onToken(text); }
    } catch (e) {
      console.warn('Built-in AI prompt() fallback failed:', e);
    }
  }

  try { session.destroy && session.destroy(); } catch {}

  if (!text || !text.trim()) {
    throw new Error('組み込みAI: ストリーミング/一括ともに空応答を返しました。モデルのダウンロードがまだ完了していない可能性があります(chrome://on-device-internals で確認)。');
  }
  return text;
}

/* ---------- バックエンド: WebLLM (CDN 動的 import) ---------- */
let _webllmEngine = null;
let _webllmMod = null;
// Llama-3.2-1B は日本語がほぼ書けず意味不明な文になったため、日本語に強い Qwen2.5 を優先する。
// 上から順に、WebLLM の prebuiltAppConfig に存在する最初のモデルを使う。
// 2026-11-11 に同じテストデータで比較した結果(日記3日分):
//   Qwen3.5-2B      … 記録どおり・抜けなし・日付の取り違えなし (採用)
//   gemma-2-2b-jpn  … 作り話なし、ただし一部の出来事が抜ける
//   Qwen2.5-1.5B    … 別の日の出来事を混ぜる
//   Qwen2.5-3B      … 「毎日図書館に通い」など記録にない一般化をする
//   Llama-3.2-1B    … 日本語として意味が通らない
const WEBLLM_MODEL_CANDIDATES = [
  'Qwen3.5-2B-q4f16_1-MLC',
  'gemma-2-2b-jpn-it-q4f16_1-MLC',
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  'Llama-3.2-1B-Instruct-q4f16_1-MLC',
];
let WEBLLM_MODEL_ID = WEBLLM_MODEL_CANDIDATES[0];

function pickWebLLMModel(mod) {
  const list = mod && mod.prebuiltAppConfig && mod.prebuiltAppConfig.model_list;
  // 検証用: ?webllm-model=<model_id> で一時的にモデルを差し替えられる
  const override = new URLSearchParams(location.search).get('webllm-model');
  if (override && Array.isArray(list) && list.some(m => m.model_id === override)) return override;
  if (!Array.isArray(list)) return WEBLLM_MODEL_CANDIDATES[0];
  const ids = new Set(list.map(m => m.model_id));
  return WEBLLM_MODEL_CANDIDATES.find(id => ids.has(id)) || WEBLLM_MODEL_CANDIDATES[0];
}

async function loadWebLLMLib() {
  if (_webllmMod) return _webllmMod;
  try {
    _webllmMod = await import('https://esm.run/@mlc-ai/web-llm');
  } catch (e) {
    try {
      _webllmMod = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm');
    } catch (e2) {
      throw new Error(
        'WebLLM ライブラリを読み込めませんでした。' +
        '(esm.run: ' + e.message + ' / jsdelivr: ' + e2.message + ') ' +
        'index.html を file:// で開いている場合、ブラウザが CDN からの動的 import を拒否することがあります。'
      );
    }
  }
  return _webllmMod;
}

async function createWebLLMEngine() {
  const mod = await loadWebLLMLib();
  llmProgress.hidden = false;
  llmProgressFill.style.width = '0%';
  llmProgressText.textContent = 'WebLLM 初期化中…';
  WEBLLM_MODEL_ID = pickWebLLMModel(mod);
  llmBackendNote.textContent = `バックエンド: WebLLM (${WEBLLM_MODEL_ID})`;
  try {
    return await mod.CreateMLCEngine(WEBLLM_MODEL_ID, {
      initProgressCallback: (report) => {
        const pct = Math.round((report.progress || 0) * 100);
        llmProgressFill.style.width = pct + '%';
        llmProgressText.textContent = `${pct}% ${report.text || ''}`;
        if (report.text && report.text.includes('Finish')) {
          llmProgressText.textContent = 'モデルの準備が完了しました';
        }
      },
    });
  } finally {
    // 失敗時も進捗バーを残さない
    llmProgress.hidden = true;
  }
}

async function runWebLLMChat(engine, { system, user, maxTokens }, onToken) {
  let text = '';
  const stream = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
    stream: true,
    // 小型モデルは高温だと崩れ・同じ文の繰り返しが出やすいので低めにする
    // 想像で埋めないよう、ほぼ決定的に生成する
    temperature: 0.1,
    top_p: 0.8,
    repetition_penalty: 1.1,
    max_tokens: maxTokens || 800,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content || '';
    if (delta) { text += delta; onToken(stripThink(text)); }
  }
  return stripThink(text);
}

// Qwen3 系は <think>…</think>(思考欄)を出すことがあるので表示から除く
function stripThink(t) {
  return t.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').replace(/^\s+/, '');
}

// engine / WebGPU デバイスが無効化されたときのエラー("Object has already been disposed" 等)
const WEBLLM_DISPOSED_RE = /disposed|destroyed|detached|lost|invalid state|has already been/i;

async function tryWebLLM({ system, user, maxTokens }, onToken) {
  llmBackendNote.textContent = _webllmEngine
    ? `バックエンド: WebLLM (${WEBLLM_MODEL_ID})`
    : 'バックエンド: WebLLM (ブラウザ内モデル)';

  if (!('gpu' in navigator)) {
    throw new Error('このブラウザは WebGPU 非対応のため、ブラウザ内AIを利用できません。Chrome / Edge の最新版をお試しください。');
  }
  // navigator.gpu があっても GPU が使えない環境がある(ドライバ非対応・ブロックリスト等)
  const adapter = await navigator.gpu.requestAdapter().catch(() => null);
  if (!adapter) {
    throw new Error('WebGPU の GPU アダプタを取得できませんでした(GPU が無効、またはドライバが非対応)。chrome://gpu の「WebGPU」の状態を確認してください。');
  }

  // エンジン作成と生成のどちらで無効化エラーが出ても、作り直して1回だけ再試行する
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (!_webllmEngine) {
        llmStatus.textContent = attempt === 1
          ? 'WebLLM ライブラリを読み込んでいます… (初回は数秒〜数十秒)'
          : 'WebLLM を再初期化しています…';
        _webllmEngine = await createWebLLMEngine();
      }
      llmStatus.textContent = attempt === 1 ? '生成中…(WebLLM)' : '生成中…(WebLLM 再試行)';
      return await runWebLLMChat(_webllmEngine, { system, user, maxTokens }, onToken);
    } catch (e) {
      const msg = String(e && e.message || e);
      console.warn(`WebLLM attempt ${attempt} failed:`, e);
      // 失敗した engine は再利用しない(次回クリック時も作り直す)
      try { _webllmEngine && _webllmEngine.unload && await _webllmEngine.unload(); } catch {}
      _webllmEngine = null;
      if (attempt === 2 || !WEBLLM_DISPOSED_RE.test(msg)) throw e;
    }
  }
}

/* ---------- バックエンド: Puter.js (ユーザーがPuter.comに無料サインイン、彼ら側のクレジットで課金) ---------- */
let _puterLoaded = false;
async function loadPuter() {
  if (_puterLoaded && window.puter) return;
  if (window.puter) { _puterLoaded = true; return; }
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.puter.com/v2/';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Puter SDK の読み込みに失敗しました。インターネット接続を確認してください。'));
    document.head.appendChild(s);
  });
  _puterLoaded = true;
}

async function tryPuter({ system, user }, onToken) {
  llmBackendNote.textContent = 'バックエンド: Puter.js (外部LLM)';
  if (location.protocol === 'file:') {
    // Puter はページの origin でサインインするため、file:// では必ず失敗する
    throw new Error('Puter はファイルを直接開いた状態(file://)では使えません。start-app.ps1(またはデスクトップのショートカット)から http://localhost:8765/ で開いてください。');
  }
  llmStatus.textContent = 'Puter を準備しています…';
  await loadPuter();
  if (!window.puter || !window.puter.ai || typeof window.puter.ai.chat !== 'function') {
    throw new Error('Puter SDK が利用可能ではありません。');
  }
  llmStatus.textContent = '生成中…(Puter 外部LLM)';
  let text = '';
  // puter.ai.chat: stream:true で async iterable が返る
  const result = await window.puter.ai.chat(
    [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
    { model: 'gpt-5-nano', stream: true }
  );
  if (result && result[Symbol.asyncIterator]) {
    for await (const part of result) {
      const delta = part && (part.text || part.content || '');
      if (delta) { text += delta; onToken(text); }
    }
  } else if (typeof result === 'string') {
    text = result;
    onToken(text);
  } else if (result && (result.message || result.text)) {
    text = result.message?.content || result.text || '';
    onToken(text);
  }
  return text;
}

/* ---------- メイン実行 ---------- */
let _running = false;
const useExternalChk = document.getElementById('llm-use-external');
// トグル状態は保存
useExternalChk.checked = !!(loadJSON(SETTINGS_KEY, {}).useExternalLLM);
useExternalChk.addEventListener('change', () => {
  const s = loadJSON(SETTINGS_KEY, {});
  s.useExternalLLM = useExternalChk.checked;
  saveJSON(SETTINGS_KEY, s);
  updateBackendHint();
});

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
  // セクションごとの生成ジョブ(データがあるものだけ LLM を呼ぶ)
  const hasDiary = rows.some(r => r.diary.trim());
  // LLM に書かせるのは日記のまとめだけ。タスクと次にやることは記録から組み立てる
  const jobs = [];
  if (hasDiary) {
    chunkDiaryRows(rows).forEach(chunk =>
      jobs.push({ key: 'extract', system: DIARY_EXTRACT_PROMPT, user: buildExtractUser(chunk) }));
  }
  const nextList = buildNextList(rows, to);

  const sections = { diary: hasDiary ? '' : '日記の記録なし', task: buildTaskSection(rows) };
  const compose = () => [
    '## 期間のできごと', sections.diary.trim(), '',
    '## タスクの取り組み', sections.task.trim(), '',
    '次にやること:', nextList,
  ].join('\n');

  _running = true;
  llmSaveBtn.disabled = true;
  llmOut.textContent = '';
  llmStatus.textContent = 'バックエンドを選択中…';
  llmBackendNote.textContent = '';
  let backendUsed = null;
  let text = '';

  // 1つのバックエンドで全セクションを順に生成する
  const runAll = (backendFn) => async () => {
    // 1) 抜き出し(区切りごと)。途中経過は「読み込み中」とだけ表示する
    const items = [];
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      sections.diary = `（日記を読み込んでいます… ${i + 1}/${jobs.length}）`;
      llmOut.textContent = compose();
      const r = await backendFn({ system: job.system, user: job.user }, () => {});
      items.push(...parseExtracted(r || ''));
    }
    if (!items.length) throw new Error('日記から出来事を抜き出せませんでした');
    // 2) 振り返り(全体で1回)。一覧が長すぎる場合は、期間の後半が欠けないよう等間隔に間引く
    const totalLen = items.reduce((n, s) => n + s.length + 3, 0);
    const keep = totalLen > 1800 ? Math.max(1, Math.floor(items.length * 1800 / totalLen)) : items.length;
    const list = keep >= items.length ? items
      : Array.from({ length: keep }, (_, k) => items[Math.floor(k * items.length / keep)]);
    // 3) テーマ分類 → JS でまとめる
    sections.diary = '（出来事をテーマごとに整理しています…）';
    llmOut.textContent = compose();
    const cls = await backendFn({ system: DIARY_CLASSIFY_PROMPT, user: buildClassifyUser(list), maxTokens: 400 }, () => {});
    const groups = groupByTheme(list, cls);
    const lead = buildLeadSentence(groups);
    // 4) テーマごとに1回ずつ、1文にまとめさせてつなげる
    const sentences = [];
    for (const g of groups) {
      const n = sentenceCount(g);
      const r = await backendFn({ system: DIARY_REFLECT_PROMPT, user: buildReflectUser(g), maxTokens: 150 * n }, t => {
        sections.diary = lead + [...sentences, firstSentences(t, n)].join(''); llmOut.textContent = compose();
      });
      const s = firstSentences(r, n);
      if (s) sentences.push(s);
    }
    if (!sentences.length) throw new Error('「期間のできごと」の生成が空でした');
    sections.diary = lead + sentences.join('');
    return compose();
  };

  // 高品質モード: Puter 優先
  const order = useExternalChk.checked
    ? [['puter',   runAll(tryPuter)],
       ['builtin', runAll(tryBuiltinAI)],
       ['webllm',  runAll(tryWebLLM)]]
    : [['builtin', runAll(tryBuiltinAI)],
       ['webllm',  runAll(tryWebLLM)],
       ['puter',   runAll(tryPuter)]];

  const errors = [];
  try {
    for (const [name, fn] of order) {
      // 外部送信を含む Puter はトグルOFFの時はフォールバックとしても使わない
      if (name === 'puter' && !useExternalChk.checked) continue;
      try {
        const r = jobs.length ? await fn() : compose();
        if (r && r.trim()) { backendUsed = jobs.length ? name : 'none'; text = r; llmOut.textContent = r; break; }
      } catch (e) {
        errors.push(`${name}: ${e.message}`);
        console.warn(`backend ${name} failed:`, e);
      }
    }
    if (!backendUsed) {
      const detail = errors.length
        ? '試したバックエンドと失敗理由:\n  - ' + errors.join('\n  - ')
        : '利用可能なバックエンドがありませんでした。(組み込みAI/WebLLM/Puter いずれも試行せず)';
      const hints = [
        '対応ブラウザ: Chrome / Edge の最新版。',
        ...(location.protocol === 'file:'
          ? ['※ いまファイルを直接開いています(file://)。AI ライブラリの読み込みや Puter が拒否されるため、start-app.ps1(またはデスクトップのショートカット)から http://localhost:8765/ で開いてください。']
          : []),
        '※ Chrome 組み込みAI(Gemini Nano)は chrome://on-device-internals で有効化状況を確認できます。',
        '※ シークレットウィンドウでは WebLLM の IndexedDB キャッシュ/WebGPU が制限されることがあります。通常ウィンドウで開き直してください。',
        '高品質モードを ON にすると外部LLM (Puter) も試します。',
      ];
      throw new Error(
        'このブラウザではふりかえりを実行できませんでした。\n\n' +
        detail + '\n\n' +
        hints.join('\n')
      );
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
    // どのバックエンドで失敗しても進捗バーを残さない
    llmProgress.hidden = true;
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
                     : s.backend === 'puter'   ? 'Puter (外部)'
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
function updateBackendHint() {
  const parts = [];
  if (typeof window.LanguageModel !== 'undefined'
      || (window.ai && (window.ai.languageModel || window.ai.createTextSession))) {
    parts.push('組み込みAI');
  }
  if ('gpu' in navigator) parts.push('WebLLM(初回約1GB)');
  if (useExternalChk.checked) parts.push('Puter(外部LLM)');

  if (!parts.length) {
    llmBackendNote.textContent = 'このブラウザでは利用できるバックエンドがありません';
    return;
  }
  const order = useExternalChk.checked
    ? ['Puter(外部LLM)', '組み込みAI', 'WebLLM(初回約1GB)'].filter(x => parts.includes(x))
    : ['組み込みAI', 'WebLLM(初回約1GB)'].filter(x => parts.includes(x));
  llmBackendNote.textContent = `優先順: ${order.join(' → ')}`;
}
updateBackendHint();

/* ---------- 初期化 ---------- */
setCurrentDate(currentDate);
renderActiveTimer();

renderCalendar();
