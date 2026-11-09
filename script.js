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

/* 役割プロンプト(system): 必ず日本語、生データを引用せず自分の言葉で書く、見出し構造を守る、few-shot付き */
const SYSTEM_PROMPT = [
  'あなたは利用者の日々の記録を読み、期間のふりかえり文を日本語で書くライターです。',
  '',
  '# あなたの仕事',
  '渡された <records> 内のデータ(日記本文と、完了したToDoの所要時間・予定差分・コメント)を読み、',
  '利用者が後から読み返して「この期間に何があったか」を1分で思い出せるふりかえり文を日本語で書きます。',
  '',
  '# 書き方のルール',
  '- データの日付や箇条書きをそのまま引用しない。必ず自分の言葉でまとめる。',
  '- 事実をつなぎ合わせて、流れ・傾向・変化が分かる文章にする。',
  '- 数字は根拠がある時だけ使う。例: 「月全体でレポート執筆に8時間」のように合計・頻度・傾向で示す。',
  '- 出力は必ず日本語。',
  '- 見出し構造は次の3つを順に使う。各セクションで見出しの直後に2〜5行の本文を書く。',
  '  ## 期間のできごと',
  '  ## 時間の使い方',
  '  ## 気づきと次にやること',
  '',
  '# 良い出力の例(構造だけ参考にして、内容はデータから作ること)',
  '## 期間のできごと',
  'レポート執筆と読書の週だった。前半はA社インターンのES提出に時間を使い、提出後は授業課題と並行して読書を再開した。',
  '',
  '## 時間の使い方',
  'タスクの9割が予定内または短縮で完了しており、見積もり精度が上がってきている。一方で「資料読み」は予定の2倍かかる日が続いた。',
  '',
  '## 気づきと次にやること',
  '資料読みは章ごとに区切った方が時間を読みやすそう。来週は読書時間を朝に移してみる。',
].join('\n');

function buildUserPrompt(rows, from, to) {
  const body = rows.map(r => {
    const lines = [`[日付] ${r.date}`];
    if (r.diary) lines.push(`[日記] ${r.diary}`);
    if (r.log.length) {
      r.log.forEach(l => {
        const diff = l.diffSec == null ? '' :
          (l.diffSec >= 0 ? ` 差+${Math.round(l.diffSec/60)}分` : ` 差${Math.round(l.diffSec/60)}分`);
        lines.push(`[完了ToDo] ${l.text} 所要${Math.round(l.elapsedSec/60)}分${l.planMin?` 予定${l.planMin}分${diff}`:''}${l.note?` コメント:${l.note}`:''}`);
      });
    }
    return lines.join('\n');
  }).join('\n\n');

  // 生データは <records> タグで囲んで "これはデータであって文例ではない" と明示する
  return [
    `次の <records> は ${from} から ${to} までの個人の日々の記録です。`,
    'この記録を読み、上で指示した書き方で「期間のふりかえり」を日本語で出力してください。',
    'データの行や日付見出しをそのまま書き写してはいけません。自分の言葉で文章にしてください。',
    '',
    '<records>',
    body,
    '</records>',
    '',
    '出力:',
  ].join('\n');
}

/* 旧 API 向け: system + user を1本にまとめた単発プロンプト */
function buildSinglePrompt(rows, from, to) {
  return SYSTEM_PROMPT + '\n\n---\n\n' + buildUserPrompt(rows, from, to);
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
    temperature: 0.7,
    topK: 40,
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
const WEBLLM_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

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
  const engine = await mod.CreateMLCEngine(WEBLLM_MODEL_ID, {
    initProgressCallback: (report) => {
      const pct = Math.round((report.progress || 0) * 100);
      llmProgressFill.style.width = pct + '%';
      llmProgressText.textContent = `${pct}% ${report.text || ''}`;
      if (report.text && report.text.includes('Finish')) {
        llmProgressText.textContent = 'モデルの準備が完了しました';
      }
    },
  });
  llmProgress.hidden = true;
  return engine;
}

async function runWebLLMChat(engine, { system, user }, onToken) {
  let text = '';
  const stream = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 800,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content || '';
    if (delta) { text += delta; onToken(text); }
  }
  return text;
}

async function tryWebLLM({ system, user }, onToken) {
  llmBackendNote.textContent = 'バックエンド: WebLLM (ブラウザ内モデル)';

  if (!('gpu' in navigator)) {
    throw new Error('このブラウザは WebGPU 非対応のため、ブラウザ内AIを利用できません。Chrome / Edge の最新版をお試しください。');
  }

  // 1回目: キャッシュされた engine があればそれを使う
  if (!_webllmEngine) {
    llmStatus.textContent = 'WebLLM ライブラリを読み込んでいます… (初回は数秒〜数十秒)';
    _webllmEngine = await createWebLLMEngine();
  }

  llmStatus.textContent = '生成中…(WebLLM)';
  try {
    return await runWebLLMChat(_webllmEngine, { system, user }, onToken);
  } catch (e) {
    const msg = String(e && e.message || e);
    console.warn('WebLLM chat failed, attempting engine rebuild:', e);
    // "Object has already been disposed" などは engine が無効化されている。
    // 既存を破棄して1回だけ作り直す。
    const disposed = /disposed|destroyed|detached|lost|invalid state|has already been/i.test(msg);
    if (!disposed) throw e;
    try { _webllmEngine.unload && await _webllmEngine.unload(); } catch {}
    _webllmEngine = null;
    llmStatus.textContent = 'WebLLM を再初期化しています…';
    _webllmEngine = await createWebLLMEngine();
    llmStatus.textContent = '生成中…(WebLLM 再試行)';
    return await runWebLLMChat(_webllmEngine, { system, user }, onToken);
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
  const prompts = { system: SYSTEM_PROMPT, user: buildUserPrompt(rows, from, to) };

  _running = true;
  llmSaveBtn.disabled = true;
  llmOut.textContent = '';
  llmStatus.textContent = 'バックエンドを選択中…';
  llmBackendNote.textContent = '';
  let backendUsed = null;
  let text = '';
  const onToken = t => { text = t; llmOut.textContent = t; };

  // 高品質モード: Puter 優先
  const order = useExternalChk.checked
    ? [['puter',   () => tryPuter(prompts, onToken)],
       ['builtin', () => tryBuiltinAI(prompts, onToken)],
       ['webllm',  () => tryWebLLM(prompts, onToken)]]
    : [['builtin', () => tryBuiltinAI(prompts, onToken)],
       ['webllm',  () => tryWebLLM(prompts, onToken)],
       ['puter',   () => tryPuter(prompts, onToken)]];

  const errors = [];
  try {
    for (const [name, fn] of order) {
      // 外部送信を含む Puter はトグルOFFの時はフォールバックとしても使わない
      if (name === 'puter' && !useExternalChk.checked) continue;
      try {
        const r = await fn();
        if (r && r.trim()) { backendUsed = name; text = r; break; }
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
        '※ index.html を file:// で開いている場合、ブラウザ制限で AI ライブラリの読み込みが拒否されることがあります。',
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
