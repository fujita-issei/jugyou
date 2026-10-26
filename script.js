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

// 現在時刻（カレンダータブ内のダミー表示）
const clock = document.getElementById('clock');
function updateClock() {
  clock.textContent = new Date().toLocaleTimeString('ja-JP');
}
updateClock();
setInterval(updateClock, 1000);
