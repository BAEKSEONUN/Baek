/**
 * 품질관리 브라우저 - 메뉴 및 페이지 설정
 * 새 메뉴를 추가하려면 MENU_ITEMS 배열에 항목을 추가하고,
 * 해당 id로 render 함수를 하나 만들어 연결하면 됩니다.
 */

const MENU_ITEMS = [
  { id: "dashboard", icon: "🏠", label: "대시보드", render: renderDashboard },
  { id: "inspection", icon: "🔍", label: "검사 관리", render: renderInspection },
  { id: "defect", icon: "⚠️", label: "불량 관리", render: renderDefect },
  { id: "report", icon: "📊", label: "리포트", render: renderPlaceholder },
  { id: "settings", icon: "⚙️", label: "설정", render: renderPlaceholder },
];

const menuListEl = document.getElementById("menu-list");
const contentEl = document.getElementById("content");
const pageTitleEl = document.getElementById("page-title");

function renderMenu(activeId) {
  menuListEl.innerHTML = "";
  MENU_ITEMS.forEach((item) => {
    const btn = document.createElement("button");
    btn.className = "menu-item" + (item.id === activeId ? " active" : "");
    btn.innerHTML = `<span class="icon">${item.icon}</span><span>${item.label}</span>`;
    btn.addEventListener("click", () => navigateTo(item.id));
    menuListEl.appendChild(btn);
  });
}

function navigateTo(id) {
  const item = MENU_ITEMS.find((m) => m.id === id) || MENU_ITEMS[0];
  pageTitleEl.textContent = item.label;
  renderMenu(item.id);
  contentEl.innerHTML = "";
  item.render(contentEl);
  window.location.hash = item.id;
}

/* ---------- Page renderers ---------- */

function renderDashboard(root) {
  root.innerHTML = `
    <div class="page-header">
      <h2>품질관리 현황</h2>
      <p>오늘의 검사 및 불량 현황을 한눈에 확인하세요.</p>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">오늘 검사 건수</div><div class="value">0</div></div>
      <div class="stat-card"><div class="label">합격</div><div class="value">0</div></div>
      <div class="stat-card"><div class="label">불량</div><div class="value">0</div></div>
      <div class="stat-card"><div class="label">불량률</div><div class="value">0%</div></div>
    </div>
    <div class="panel">
      <h3>최근 검사 이력</h3>
      <div class="empty-state">
        <div class="icon">🗂️</div>
        <p>아직 등록된 검사 이력이 없습니다.</p>
      </div>
    </div>
  `;
}

function renderInspection(root) {
  root.innerHTML = `
    <div class="page-header">
      <h2>검사 관리</h2>
      <p>제품 검사 항목을 등록하고 결과를 기록합니다.</p>
    </div>
    <div class="panel">
      <table class="qc-table">
        <thead>
          <tr><th>검사 항목</th><th>담당자</th><th>일자</th><th>결과</th></tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="4">
              <div class="empty-state">
                <div class="icon">🔍</div>
                <p>등록된 검사 항목이 없습니다.</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderDefect(root) {
  root.innerHTML = `
    <div class="page-header">
      <h2>불량 관리</h2>
      <p>발생한 불량 건을 등록하고 처리 상태를 추적합니다.</p>
    </div>
    <div class="panel">
      <table class="qc-table">
        <thead>
          <tr><th>불량 유형</th><th>발생일</th><th>처리 상태</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>예시: 표면 스크래치</td>
            <td>-</td>
            <td><span class="status-pill status-pending">확인중</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderPlaceholder(root, label) {
  root.innerHTML = `
    <div class="panel">
      <div class="empty-state">
        <div class="icon">🚧</div>
        <p>준비 중인 메뉴입니다. 필요에 따라 이어서 구현하세요.</p>
      </div>
    </div>
  `;
}

/* ---------- Sidebar collapse & add-menu button ---------- */

document.getElementById("sidebar-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("collapsed");
});

document.getElementById("add-menu-btn").addEventListener("click", () => {
  const label = prompt("추가할 메뉴 이름을 입력하세요:");
  if (!label) return;
  const id = "menu-" + Date.now();
  MENU_ITEMS.push({ id, icon: "📌", label, render: (root) => renderPlaceholder(root, label) });
  navigateTo(id);
});

/* ---------- Init ---------- */

const initialId = window.location.hash.replace("#", "") || MENU_ITEMS[0].id;
navigateTo(initialId);
