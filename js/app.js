/**
 * 골프 동호회 관리 브라우저
 * 새 메뉴를 추가하려면 MENU_ITEMS 배열에 항목을 추가하고,
 * 해당 id로 render 함수를 하나 만들어 연결하면 됩니다.
 * 모든 데이터는 브라우저 localStorage에 저장됩니다.
 */

/* ==================== 데이터 저장소 ==================== */

const STORAGE_KEY = "golfClubData_v1";

const DEFAULT_DATA = {
  courses: [], // {id, name, greenFee, caddieFee, mealIncluded, travelMinutes}
  schedules: [], // {id, date, courseId, memo}
  members: [], // {id, name, type: "member"|"guest"}
  rounds: [], // {id, courseId, date}  -- 스코어 리스트에 등록된 라운드
  scores: {}, // `${roundId}::${memberId}` -> strokes(number)
  rules: [], // {id, text}
  inventory: [], // {id, name, qty(초기 등록 수량), unit, note, logs: [{id, date, stockIn, stockOut, recipient}]}
  cashbook: [], // {id, date, desc, income, expense}
  teams: [], // memberId[][] -- 팀 분배 결과(수정 가능)
  consumableTypes: [], // {id, name, unit, category, note} -- 소모품 종류/정보
  consumableLogs: [], // {id, date, itemId, type: "in"|"out"|"discard", qty, note}
};

// 최초 도입 시 기존 데이터의 회원을 멤버/게스트로 분류하기 위한 기본 게스트 명단
const DEFAULT_GUEST_NAME_SET = new Set(
  ["choi sunyong", "song youwoo", "han geonsun", "jeon inpyo", "jo gisoo", "na euisoo", "zhao junwu"].map((n) => n.toLowerCase())
);

const MEMBER_TYPE_LABEL = { member: "멤버", guest: "게스트" };

function inferMemberType(name) {
  return DEFAULT_GUEST_NAME_SET.has(String(name).trim().toLowerCase()) ? "guest" : "member";
}

function migrateMemberTypes(data) {
  data.members.forEach((m) => {
    if (m.type !== "member" && m.type !== "guest") {
      m.type = inferMemberType(m.name);
    }
  });
  return data;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateMemberTypes(JSON.parse(JSON.stringify(DEFAULT_DATA)));
    const parsed = JSON.parse(raw);
    return migrateMemberTypes({ ...JSON.parse(JSON.stringify(DEFAULT_DATA)), ...parsed });
  } catch (e) {
    return migrateMemberTypes(JSON.parse(JSON.stringify(DEFAULT_DATA)));
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
}

let DATA = loadData();

/* ==================== 공용 유틸 ==================== */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function formatNumber(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return "0";
  return num.toLocaleString("ko-KR");
}

// 숫자 입력창에 천 단위 쉼표를 실시간으로 표시하기 위한 헬퍼
function formatNumberInputValue(raw) {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function parseFormattedNumber(value) {
  return Number(String(value ?? "").replace(/[^0-9]/g, "")) || 0;
}

function wireNumberInputs(root) {
  root.querySelectorAll(".number-input").forEach((input) => {
    input.addEventListener("input", () => {
      const digitsBeforeCursor = input.value.slice(0, input.selectionStart).replace(/[^0-9]/g, "").length;
      input.value = formatNumberInputValue(input.value);
      let seen = 0;
      let pos = input.value.length;
      for (let i = 0; i < input.value.length; i++) {
        if (/[0-9]/.test(input.value[i])) seen++;
        if (seen === digitsBeforeCursor) {
          pos = i + 1;
          break;
        }
      }
      input.setSelectionRange(pos, pos);
    });
  });
}

// 연/월/일을 각각 입력하는 날짜 입력창: 연 4자리, 월 2자리 입력이 끝나면 자동으로 다음 칸으로 이동한다.
// name(과 선택적 id)을 가진 hidden input에 "YYYY-MM-DD" 형식으로 값을 채워, 기존 FormData/getElementById 코드가 그대로 동작하게 한다.
function renderDateSplitInput(name, { id = "", required = false, value = "" } = {}) {
  const [y = "", m = "", d = ""] = (value || "").split("-");
  return `
    <div class="date-split-input">
      <input type="hidden" name="${name}" ${id ? `id="${id}"` : ""} ${required ? "required" : ""} value="${escapeHtml(value)}" />
      <input type="text" inputmode="numeric" class="date-seg date-seg-y" maxlength="4" placeholder="YYYY" aria-label="연" value="${escapeHtml(y)}" />
      <span>-</span>
      <input type="text" inputmode="numeric" class="date-seg date-seg-m" maxlength="2" placeholder="MM" aria-label="월" value="${escapeHtml(m)}" />
      <span>-</span>
      <input type="text" inputmode="numeric" class="date-seg date-seg-d" maxlength="2" placeholder="DD" aria-label="일" value="${escapeHtml(d)}" />
    </div>
  `;
}

function wireDateSplitInputs(root) {
  root.querySelectorAll(".date-split-input").forEach((wrap) => {
    const hidden = wrap.querySelector('input[type="hidden"]');
    const y = wrap.querySelector(".date-seg-y");
    const m = wrap.querySelector(".date-seg-m");
    const d = wrap.querySelector(".date-seg-d");

    function sync() {
      const yv = y.value;
      const mv = m.value;
      const dv = d.value;
      hidden.value = yv.length === 4 && mv.length > 0 && dv.length > 0 ? `${yv}-${mv.padStart(2, "0")}-${dv.padStart(2, "0")}` : "";
      hidden.dispatchEvent(new Event("input", { bubbles: true }));
    }

    y.addEventListener("input", () => {
      y.value = y.value.replace(/[^0-9]/g, "").slice(0, 4);
      sync();
      if (y.value.length === 4) m.focus();
    });
    m.addEventListener("input", () => {
      m.value = m.value.replace(/[^0-9]/g, "").slice(0, 2);
      sync();
      if (m.value.length === 2) d.focus();
    });
    d.addEventListener("input", () => {
      d.value = d.value.replace(/[^0-9]/g, "").slice(0, 2);
      sync();
    });
  });
}

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getWeekday(dateStr) {
  return WEEKDAYS_KO[parseLocalDate(dateStr).getDay()];
}

function getWeekOfMonth(dateStr) {
  const d = parseLocalDate(dateStr);
  const firstDayWeekday = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  return Math.ceil((d.getDate() + firstDayWeekday) / 7);
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "-";
  const d = parseLocalDate(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function findCourseByName(name) {
  const target = (name || "").trim().toLowerCase();
  if (!target) return null;
  return DATA.courses.find((c) => c.name.trim().toLowerCase() === target) || null;
}

function formatTravelTime(totalMinutes) {
  const n = Number(totalMinutes);
  if (!n) return "-";
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/* ==================== 스코어 엑셀 다운로드 ==================== */

function downloadScoreExcel(rounds, members) {
  if (typeof XLSX === "undefined") {
    alert("엑셀 기능을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.");
    return;
  }
  if (!rounds.length || !members.length) {
    alert("다운로드할 스코어 데이터가 없습니다.");
    return;
  }
  const header1 = [
    "이름",
    ...rounds.map((r) => {
      const course = DATA.courses.find((c) => c.id === r.courseId);
      return course ? course.name : "(삭제된 골프장)";
    }),
  ];
  const header2 = ["", ...rounds.map((r) => formatDateDisplay(r.date))];
  const body = members.map((m) => [m.name, ...rounds.map((r) => DATA.scores[`${r.id}::${m.id}`] ?? "")]);
  const ws = XLSX.utils.aoa_to_sheet([header1, header2, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Score List");
  XLSX.writeFile(wb, "스코어_리스트.xlsx");
}

/* ==================== 메뉴 구성 ==================== */

const MENU_ITEMS = [
  { id: "dashboard", icon: "🏠", label: "대시보드", render: renderDashboard },
  { id: "schedule", icon: "📅", label: "골프 일정", render: renderSchedule },
  { id: "courses", icon: "⛳", label: "골프장 정보", render: renderCourses },
  { id: "scores", icon: "🏌️", label: "스코어 리스트", render: renderScores },
  { id: "rules", icon: "📖", label: "골프룰", render: renderRules },
  { id: "inventory", icon: "🎁", label: "상품재고", render: renderInventory },
  { id: "cashbook", icon: "💰", label: "현금장부", render: renderCashbook },
  { id: "consumable-types", icon: "🧰", label: "소모품 종류", render: renderConsumableTypes },
  { id: "consumables", icon: "📦", label: "소모품 관리", render: renderConsumables },
];

const menuListEl = document.getElementById("menu-list");
const contentEl = document.getElementById("content");
const pageTitleEl = document.getElementById("page-title");

function renderMenu(activeId) {
  menuListEl.innerHTML = "";
  MENU_ITEMS.forEach((item) => {
    const btn = document.createElement("button");
    btn.className = "menu-item" + (item.id === activeId ? " active" : "");
    btn.innerHTML = `<span class="icon">${item.icon}</span><span>${escapeHtml(item.label)}</span>`;
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

/* ==================== 대시보드 ==================== */

function renderDashboard(root) {
  const upcoming = [...DATA.schedules]
    .filter((s) => s.date >= todayStr())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  const balance = DATA.cashbook.reduce((a, e) => a + (e.income || 0) - (e.expense || 0), 0);

  root.innerHTML = `
    <div class="page-header">
      <h2>골프 동호회 현황</h2>
      <p>다가오는 일정과 동호회 운영 현황을 한눈에 확인하세요.</p>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">등록 회원</div><div class="value">${DATA.members.length}</div></div>
      <div class="stat-card"><div class="label">등록 골프장</div><div class="value">${DATA.courses.length}</div></div>
      <div class="stat-card"><div class="label">예정된 일정</div><div class="value">${upcoming.length}</div></div>
      <div class="stat-card"><div class="label">현재 잔액</div><div class="value">${formatNumber(balance)}원</div></div>
    </div>
    <div class="panel">
      <h3>다가오는 일정</h3>
      ${
        upcoming.length
          ? `<table class="qc-table">
              <thead><tr><th>날짜</th><th>요일</th><th>주차</th><th>골프장</th></tr></thead>
              <tbody>
                ${upcoming
                  .map((s) => {
                    const course = DATA.courses.find((c) => c.id === s.courseId);
                    return `<tr>
                      <td>${formatDateDisplay(s.date)}</td>
                      <td>${getWeekday(s.date)}요일</td>
                      <td>${getWeekOfMonth(s.date)}주차</td>
                      <td>${course ? escapeHtml(course.name) : "-"}</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>`
          : `<div class="empty-state"><div class="icon">🗂️</div><p>예정된 일정이 없습니다.</p></div>`
      }
    </div>
  `;
}

/* ==================== 골프 일정 ==================== */

function renderSchedule(root) {
  function draw() {
    const sorted = [...DATA.schedules].sort((a, b) => a.date.localeCompare(b.date));
    root.innerHTML = `
      <div class="page-header">
        <h2>골프 일정</h2>
        <p>날짜를 입력하면 요일/주차가 자동으로 표시되고, 골프장 이름을 입력하면 골프장 정보에서 그린피/캐디피/식비 포함 여부/소요시간을 불러옵니다.</p>
      </div>
      <div class="panel">
        <h3>일정 추가</h3>
        <form class="form-grid" id="schedule-form">
          <label>날짜
            ${renderDateSplitInput("date", { id: "schedule-date", required: true })}
          </label>
          <label>요일 / 주차
            <input type="text" id="schedule-date-info" readonly placeholder="날짜를 선택하세요" />
          </label>
          <label>골프장 이름
            <input type="text" name="courseName" id="schedule-course" list="course-datalist" placeholder="등록된 골프장 이름 입력" autocomplete="off" />
          </label>
          <label>메모
            <input type="text" name="memo" placeholder="예: 조기출발, 우천 시 연기" />
          </label>
          <div class="form-actions" style="grid-column: 1 / -1">
            <button type="submit" class="btn btn-primary">일정 추가</button>
          </div>
        </form>
        <datalist id="course-datalist">
          ${DATA.courses.map((c) => `<option value="${escapeHtml(c.name)}"></option>`).join("")}
        </datalist>
        <div class="course-preview" id="course-preview"></div>
      </div>
      <div class="panel">
        <table class="qc-table">
          <thead>
            <tr>
              <th>날짜</th><th>요일</th><th>주차</th><th>골프장</th>
              <th>그린피</th><th>캐디피</th><th>식비</th><th>소요시간</th><th>메모</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${
              sorted.length
                ? sorted
                    .map((s) => {
                      const course = DATA.courses.find((c) => c.id === s.courseId);
                      return `<tr>
                        <td>${formatDateDisplay(s.date)}</td>
                        <td>${getWeekday(s.date)}요일</td>
                        <td>${getWeekOfMonth(s.date)}주차</td>
                        <td>${course ? escapeHtml(course.name) : "-"}</td>
                        <td>${course ? formatNumber(course.greenFee) + "원" : "-"}</td>
                        <td>${course ? formatNumber(course.caddieFee) + "원" : "-"}</td>
                        <td>${course ? (course.mealIncluded ? "포함" : "미포함") : "-"}</td>
                        <td>${course ? formatTravelTime(course.travelMinutes) : "-"}</td>
                        <td>${escapeHtml(s.memo || "-")}</td>
                        <td><button class="btn-icon" data-del="${s.id}" title="삭제">🗑️</button></td>
                      </tr>`;
                    })
                    .join("")
                : `<tr><td colspan="10"><div class="empty-state"><div class="icon">📅</div><p>등록된 일정이 없습니다.</p></div></td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
    wire();
    wireDateSplitInputs(root);
  }

  function updatePreview(courseInputEl, previewEl) {
    const course = findCourseByName(courseInputEl.value);
    if (!course) {
      previewEl.innerHTML = courseInputEl.value.trim()
        ? `<p class="empty-hint">일치하는 골프장 정보가 없습니다. '골프장 정보' 메뉴에서 먼저 등록하세요.</p>`
        : "";
      return;
    }
    previewEl.innerHTML = `
      <div class="preview-card">
        <div><span>그린피</span><strong>${formatNumber(course.greenFee)}원</strong></div>
        <div><span>캐디피</span><strong>${formatNumber(course.caddieFee)}원</strong></div>
        <div><span>식비</span><strong>${course.mealIncluded ? "포함" : "미포함"}</strong></div>
        <div><span>소요시간</span><strong>${formatTravelTime(course.travelMinutes)}</strong></div>
      </div>`;
  }

  function wire() {
    const dateInput = root.querySelector("#schedule-date");
    const dateInfo = root.querySelector("#schedule-date-info");
    dateInput.addEventListener("input", () => {
      if (!dateInput.value) {
        dateInfo.value = "";
        return;
      }
      dateInfo.value = `${getWeekday(dateInput.value)}요일 / ${getWeekOfMonth(dateInput.value)}주차`;
    });

    const courseInput = root.querySelector("#schedule-course");
    const preview = root.querySelector("#course-preview");
    courseInput.addEventListener("input", () => updatePreview(courseInput, preview));

    root.querySelector("#schedule-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const date = fd.get("date");
      if (!date) return;
      const courseName = fd.get("courseName").trim();
      let courseId = "";
      if (courseName) {
        const course = findCourseByName(courseName);
        if (!course) {
          alert("등록된 골프장 이름을 입력해주세요. ('골프장 정보' 메뉴에서 먼저 등록할 수 있습니다)");
          return;
        }
        courseId = course.id;
      }
      DATA.schedules.push({ id: uid(), date, courseId, memo: fd.get("memo").trim() });
      saveData();
      draw();
    });

    root.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", () => {
        DATA.schedules = DATA.schedules.filter((s) => s.id !== btn.dataset.del);
        saveData();
        draw();
      })
    );
  }

  draw();
}

/* ==================== 골프장 정보 ==================== */

function renderCourses(root) {
  let editingId = null;

  function draw() {
    const editing = editingId ? DATA.courses.find((c) => c.id === editingId) : null;
    root.innerHTML = `
      <div class="page-header">
        <h2>골프장 정보</h2>
        <p>골프장별 그린피, 캐디피, 식비 포함 여부, 회사 출발 기준 소요시간을 관리합니다.</p>
      </div>
      <div class="panel">
        <h3>${editing ? "골프장 수정" : "골프장 추가"}</h3>
        <form class="form-grid" id="course-form">
          <label>골프장 이름
            <input type="text" name="name" required value="${escapeHtml(editing?.name ?? "")}" placeholder="예: 남서울CC" />
          </label>
          <label>그린피 (원)
            <input type="text" inputmode="numeric" name="greenFee" class="number-input" value="${editing ? formatNumberInputValue(editing.greenFee) : ""}" />
          </label>
          <label>캐디피 (원)
            <input type="text" inputmode="numeric" name="caddieFee" class="number-input" value="${editing ? formatNumberInputValue(editing.caddieFee) : ""}" />
          </label>
          <label>식비 포함 여부
            <select name="mealIncluded">
              <option value="true" ${editing?.mealIncluded ? "selected" : ""}>포함</option>
              <option value="false" ${editing && !editing.mealIncluded ? "selected" : ""}>미포함</option>
            </select>
          </label>
          <label>회사 출발 기준 소요시간
            <div class="time-input-group">
              <input type="number" name="travelHours" min="0" placeholder="시간" value="${editing ? Math.floor(editing.travelMinutes / 60) : ""}" />
              <span>시간</span>
              <input type="number" name="travelMins" min="0" max="59" placeholder="분" value="${editing ? editing.travelMinutes % 60 : ""}" />
              <span>분</span>
            </div>
          </label>
          <div class="form-actions" style="grid-column: 1 / -1">
            <button type="submit" class="btn btn-primary">${editing ? "수정 완료" : "추가"}</button>
            ${editing ? `<button type="button" class="btn btn-ghost" id="cancel-edit">취소</button>` : ""}
          </div>
        </form>
      </div>
      <div class="panel">
        <table class="qc-table">
          <thead><tr><th>골프장</th><th>그린피</th><th>캐디피</th><th>식비</th><th>소요시간</th><th></th></tr></thead>
          <tbody>
            ${
              DATA.courses.length
                ? DATA.courses
                    .map(
                      (c) => `<tr>
                        <td>${escapeHtml(c.name)}</td>
                        <td>${formatNumber(c.greenFee)}원</td>
                        <td>${formatNumber(c.caddieFee)}원</td>
                        <td><span class="status-pill ${c.mealIncluded ? "status-pass" : "status-pending"}">${c.mealIncluded ? "포함" : "미포함"}</span></td>
                        <td>${formatTravelTime(c.travelMinutes)}</td>
                        <td class="row-actions">
                          <button class="btn-icon" data-edit="${c.id}" title="수정">✏️</button>
                          <button class="btn-icon" data-del="${c.id}" title="삭제">🗑️</button>
                        </td>
                      </tr>`
                    )
                    .join("")
                : `<tr><td colspan="6"><div class="empty-state"><div class="icon">⛳</div><p>등록된 골프장이 없습니다.</p></div></td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
    wire();
    wireNumberInputs(root);
  }

  function wire() {
    root.querySelector("#course-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        name: fd.get("name").trim(),
        greenFee: parseFormattedNumber(fd.get("greenFee")),
        caddieFee: parseFormattedNumber(fd.get("caddieFee")),
        mealIncluded: fd.get("mealIncluded") === "true",
        travelMinutes: (Number(fd.get("travelHours")) || 0) * 60 + (Number(fd.get("travelMins")) || 0),
      };
      if (!payload.name) return;
      if (editingId) {
        const c = DATA.courses.find((x) => x.id === editingId);
        Object.assign(c, payload);
        editingId = null;
      } else {
        DATA.courses.push({ id: uid(), ...payload });
      }
      saveData();
      draw();
    });

    const cancelBtn = root.querySelector("#cancel-edit");
    if (cancelBtn) cancelBtn.addEventListener("click", () => { editingId = null; draw(); });

    root.querySelectorAll("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () => { editingId = btn.dataset.edit; draw(); })
    );

    root.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (!confirm("이 골프장 정보를 삭제할까요? 연결된 일정/라운드의 골프장 정보가 함께 사라집니다.")) return;
        DATA.courses = DATA.courses.filter((c) => c.id !== btn.dataset.del);
        saveData();
        draw();
      })
    );
  }

  draw();
}

/* ==================== 스코어 리스트 (+ 팀 분배) ==================== */

function formatScoreDiff(previousScore, latestScore) {
  if (previousScore === null || latestScore === null) return "";
  const diff = latestScore - previousScore;
  if (diff === 0) return `<span class="diff-flat">±0</span>`;
  if (diff > 0) return `<span class="diff-up">${diff}↑</span>`;
  return `<span class="diff-down">${Math.abs(diff)}↓</span>`;
}

function renderTeamCardsHtml(teams) {
  if (!teams.length) {
    return `<p class="empty-hint">아직 배정된 팀이 없습니다. '팀 배정' 버튼을 눌러 자동으로 나눠보세요.</p>`;
  }
  const assignedIds = new Set(teams.flat());
  const availableMembers = DATA.members.filter((m) => !assignedIds.has(m.id));
  return `<div class="team-grid">${teams
    .map((team, i) => {
      const teamOptions = teams.map((_, ti) => `<option value="${ti}" ${ti === i ? "selected" : ""}>${ti + 1}팀</option>`).join("");
      return `<div class="team-card">
        <h4>${i + 1}팀 <span class="team-count">(${team.length}명)</span></h4>
        <ul class="team-member-list">
          ${
            team
              .map((mid) => {
                const mem = DATA.members.find((m) => m.id === mid);
                if (!mem) return "";
                return `<li>
                  <span>${escapeHtml(mem.name)}</span>
                  <select class="team-move-select" data-member="${mid}">
                    ${teamOptions}
                    <option value="remove">제외</option>
                  </select>
                </li>`;
              })
              .join("") || `<li class="empty-hint">배정된 회원이 없습니다.</li>`
          }
        </ul>
        <select class="team-add-select" data-team="${i}">
          <option value="">+ 회원 추가</option>
          ${availableMembers.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}${m.type === "guest" ? " (게스트)" : ""}</option>`).join("")}
        </select>
      </div>`;
    })
    .join("")}</div>`;
}

function renderScores(root) {
  function draw() {
    const chronoRounds = [...DATA.rounds].sort((a, b) => a.date.localeCompare(b.date));
    const rounds = [...chronoRounds].reverse(); // 표시용: 가장 최근 라운드가 왼쪽에 오도록
    const scheduleOptions = [...DATA.schedules]
      .filter((s) => s.courseId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => {
        const course = DATA.courses.find((c) => c.id === s.courseId);
        return `<option value="${s.id}">${formatDateDisplay(s.date)} - ${course ? escapeHtml(course.name) : "미정"}</option>`;
      })
      .join("");

    // 팀 분배: 회원별 직전/최근 라운딩 점수 (연대순으로 계산해야 "최근"이 정확함)
    const teamRows = DATA.members.map((m) => {
      const played = chronoRounds
        .map((r) => ({ round: r, score: DATA.scores[`${r.id}::${m.id}`] }))
        .filter((x) => x.score !== undefined && x.score !== null && x.score !== "");
      const latest = played[played.length - 1];
      const previous = played[played.length - 2];
      return {
        id: m.id,
        name: m.name,
        type: m.type || "member",
        latestScore: latest ? Number(latest.score) : null,
        latestDate: latest ? latest.round.date : null,
        previousScore: previous ? Number(previous.score) : null,
        previousDate: previous ? previous.round.date : null,
      };
    });
    const byLatestScore = (a, b) => {
      if (a.latestScore === null && b.latestScore === null) return 0;
      if (a.latestScore === null) return 1;
      if (b.latestScore === null) return -1;
      return a.latestScore - b.latestScore;
    };
    // 등수는 멤버끼리만: 게스트는 등수 없이 멤버 명단 아래에 표시
    const memberRows = teamRows.filter((r) => r.type !== "guest").sort(byLatestScore);
    const guestRows = teamRows.filter((r) => r.type === "guest").sort(byLatestScore);

    // 직전 대비 최근 라운딩 타수 증감이 있는 사람 중 최다 개선자 / 10타 이상 부진자 표시
    const diffed = teamRows.filter((r) => r.previousScore !== null && r.latestScore !== null);
    const minDiff = diffed.length ? Math.min(...diffed.map((r) => r.latestScore - r.previousScore)) : null;
    const bestImproverIds = new Set(
      minDiff !== null && minDiff < 0 ? diffed.filter((r) => r.latestScore - r.previousScore === minDiff).map((r) => r.id) : []
    );
    const bigWorsenIds = new Set(diffed.filter((r) => r.latestScore - r.previousScore >= 10).map((r) => r.id));

    function buildTeamRankRow(r, rankLabel) {
      const badges =
        (bestImproverIds.has(r.id) ? ` <span class="badge-best" title="직전 대비 타수를 가장 많이 줄인 회원">🔥최다 개선</span>` : "") +
        (bigWorsenIds.has(r.id) ? ` <span class="badge-warn" title="직전 라운딩보다 10타 이상 많이 침">⚠️10타↑ 부진</span>` : "");
      return `<tr>
        <td>${rankLabel}</td>
        <td>${escapeHtml(r.name)}</td>
        <td><span class="type-tag type-${r.type}">${MEMBER_TYPE_LABEL[r.type]}</span></td>
        <td>${r.latestScore !== null ? r.latestScore + "타 (" + formatDateDisplay(r.latestDate) + ") " + formatScoreDiff(r.previousScore, r.latestScore) + badges : "-"}</td>
        <td>${r.previousScore !== null ? r.previousScore + "타 (" + formatDateDisplay(r.previousDate) + ")" : "-"}</td>
      </tr>`;
    }

    root.innerHTML = `
      <div class="page-header">
        <h2>스코어 리스트</h2>
        <p>라운딩별 타수를 입력하세요. 이름 옆 배지를 클릭하면 멤버/게스트를 전환할 수 있습니다.</p>
      </div>
      <div class="panel score-toolbar">
        <form id="member-form" class="inline-form">
          <input type="text" name="name" placeholder="회원 이름 추가" required />
          <button type="submit" class="btn btn-secondary">회원 추가</button>
        </form>
        <form id="round-form" class="inline-form">
          <select name="scheduleId" required>
            <option value="">일정 선택 후 라운드 추가</option>
            ${scheduleOptions}
          </select>
          <button type="submit" class="btn btn-secondary">라운드 추가</button>
        </form>
        <div class="inline-form">
          <button type="button" class="btn btn-ghost" id="excel-download-btn">스코어 엑셀 다운로드</button>
        </div>
      </div>
      <div class="panel score-panel">
        <div class="table-scroll">
          <table class="qc-table score-table">
            <thead>
              <tr>
                <th rowspan="2" class="sticky-col">이름</th>
                ${rounds
                  .map((r) => {
                    const course = DATA.courses.find((c) => c.id === r.courseId);
                    return `<th>${course ? escapeHtml(course.name) : "(삭제된 골프장)"} <button class="btn-icon" data-delround="${r.id}" title="라운드 삭제">🗑️</button></th>`;
                  })
                  .join("")}
              </tr>
              <tr>
                ${rounds.map((r) => `<th>${formatDateDisplay(r.date)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${
                DATA.members.length
                  ? DATA.members
                      .map((m) => {
                        const type = m.type || "member";
                        return `<tr>
                        <td class="sticky-col member-cell">
                          <span class="member-name">${escapeHtml(m.name)}</span>
                          <button class="type-badge type-${type}" data-toggletype="${m.id}" title="클릭하여 멤버/게스트 전환">${MEMBER_TYPE_LABEL[type]}</button>
                          <span class="member-actions">
                            <button class="btn-icon" data-renamemember="${m.id}" title="이름 수정">✏️</button>
                            <button class="btn-icon" data-delmember="${m.id}" title="회원 삭제">✕</button>
                          </span>
                        </td>
                        ${rounds
                          .map((r) => {
                            const key = `${r.id}::${m.id}`;
                            const val = DATA.scores[key];
                            return `<td><input type="number" class="score-input" data-round="${r.id}" data-member="${m.id}" value="${val ?? ""}" placeholder="-" /></td>`;
                          })
                          .join("")}
                      </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="${1 + rounds.length}"><div class="empty-state"><div class="icon">👥</div><p>등록된 회원이 없습니다.</p></div></td></tr>`
              }
            </tbody>
          </table>
        </div>
        ${!rounds.length ? `<div class="empty-state"><div class="icon">⛳</div><p>등록된 라운드가 없습니다. 먼저 '골프 일정'에서 골프장을 지정한 일정을 등록하세요.</p></div>` : ""}
      </div>
      <div class="panel">
        <h3>팀 분배</h3>
        <p class="panel-desc">
          등수는 멤버끼리만 매기며, 게스트는 등수 없이 멤버 명단 아래에 표시됩니다.
          (증감: 직전 대비 최근 라운딩 타수 변화, 3타 더 쳤으면 3↑, 4타 덜 쳤으면 4↓)
          🔥최다 개선은 직전 대비 타수를 가장 많이 줄인 회원, ⚠️10타↑ 부진은 직전보다 10타 이상 많이 친 회원입니다.
        </p>
        <table class="qc-table">
          <thead><tr><th>등수</th><th>이름</th><th>구분</th><th>최근 라운딩 점수</th><th>직전 라운딩 점수</th></tr></thead>
          <tbody>
            ${
              memberRows.length || guestRows.length
                ? memberRows.map((r, idx) => buildTeamRankRow(r, r.latestScore !== null ? idx + 1 + "위" : "-")).join("") +
                  (guestRows.length ? `<tr class="section-divider-row"><td colspan="5"></td></tr>` : "") +
                  guestRows.map((r) => buildTeamRankRow(r, "-")).join("")
                : `<tr><td colspan="5"><div class="empty-state"><div class="icon">🏌️</div><p>회원과 타수를 먼저 등록하세요.</p></div></td></tr>`
            }
          </tbody>
        </table>
        <h4>자동 팀 나누기</h4>
        <p class="panel-desc">멤버만 대상으로, 최근 라운딩 점수 기준 1~4등 1팀, 5~8등 2팀, 9~12등 3팀… 순서로 배정합니다. 배정 후에는 팀별 명단을 직접 수정할 수 있습니다.</p>
        <button type="button" class="btn btn-primary" id="team-assign-btn">팀 배정</button>
        <div id="team-result">${renderTeamCardsHtml(DATA.teams)}</div>
      </div>
    `;
    wire(memberRows, rounds);
  }

  function wire(memberRows, rounds) {
    root.querySelector("#member-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = fd.get("name").trim();
      if (!name) return;
      DATA.members.push({ id: uid(), name, type: inferMemberType(name) });
      saveData();
      draw();
    });

    root.querySelector("#round-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const schedule = DATA.schedules.find((s) => s.id === fd.get("scheduleId"));
      if (!schedule) return;
      const exists = DATA.rounds.some((r) => r.courseId === schedule.courseId && r.date === schedule.date);
      if (exists) {
        alert("이미 추가된 라운드입니다.");
        return;
      }
      DATA.rounds.push({ id: uid(), courseId: schedule.courseId, date: schedule.date });
      saveData();
      draw();
    });

    root.querySelector("#excel-download-btn").addEventListener("click", () => {
      downloadScoreExcel(rounds, DATA.members);
    });

    root.querySelectorAll("[data-delround]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (!confirm("이 라운드와 관련 스코어를 삭제할까요?")) return;
        const rid = btn.dataset.delround;
        DATA.rounds = DATA.rounds.filter((r) => r.id !== rid);
        Object.keys(DATA.scores).forEach((k) => {
          if (k.startsWith(rid + "::")) delete DATA.scores[k];
        });
        saveData();
        draw();
      })
    );

    root.querySelectorAll("[data-toggletype]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const member = DATA.members.find((m) => m.id === btn.dataset.toggletype);
        if (!member) return;
        member.type = member.type === "guest" ? "member" : "guest";
        saveData();
        draw();
      })
    );

    root.querySelectorAll("[data-renamemember]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const member = DATA.members.find((m) => m.id === btn.dataset.renamemember);
        if (!member) return;
        const newName = prompt("회원 이름 수정", member.name);
        if (!newName || !newName.trim()) return;
        member.name = newName.trim();
        saveData();
        draw();
      })
    );

    root.querySelectorAll("[data-delmember]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (!confirm("이 회원을 삭제할까요?")) return;
        const mid = btn.dataset.delmember;
        DATA.members = DATA.members.filter((m) => m.id !== mid);
        Object.keys(DATA.scores).forEach((k) => {
          if (k.endsWith("::" + mid)) delete DATA.scores[k];
        });
        DATA.teams = DATA.teams.map((team) => team.filter((id) => id !== mid));
        saveData();
        draw();
      })
    );

    root.querySelectorAll(".score-input").forEach((input) => {
      input.addEventListener("change", () => {
        const key = `${input.dataset.round}::${input.dataset.member}`;
        if (input.value === "") delete DATA.scores[key];
        else DATA.scores[key] = Number(input.value);
        saveData();
        draw();
      });
    });

    root.querySelector("#team-assign-btn").addEventListener("click", () => {
      const TEAM_SIZE = 4;
      const eligible = memberRows;
      if (!eligible.length) {
        alert("멤버로 분류된 회원이 없습니다.");
        return;
      }
      if (DATA.teams.length && !confirm("기존 팀 배정을 새로 계산된 팀으로 덮어쓸까요?")) return;
      const teamCount = Math.max(1, Math.ceil(eligible.length / TEAM_SIZE));
      const teams = Array.from({ length: teamCount }, () => []);
      eligible.forEach((r, idx) => {
        teams[Math.floor(idx / TEAM_SIZE)].push(r.id);
      });
      DATA.teams = teams;
      saveData();
      draw();
    });

    root.querySelectorAll(".team-move-select").forEach((sel) =>
      sel.addEventListener("change", () => {
        const mid = sel.dataset.member;
        DATA.teams = DATA.teams.map((team) => team.filter((id) => id !== mid));
        if (sel.value !== "remove") {
          DATA.teams[Number(sel.value)].push(mid);
        }
        saveData();
        draw();
      })
    );

    root.querySelectorAll(".team-add-select").forEach((sel) =>
      sel.addEventListener("change", () => {
        const mid = sel.value;
        if (!mid) return;
        const ti = Number(sel.dataset.team);
        DATA.teams = DATA.teams.map((team) => team.filter((id) => id !== mid));
        DATA.teams[ti].push(mid);
        saveData();
        draw();
      })
    );
  }

  draw();
}

/* ==================== 골프룰 ==================== */

function renderRules(root) {
  function draw() {
    root.innerHTML = `
      <div class="page-header">
        <h2>골프룰</h2>
        <p>동호회 내규 및 라운딩 규칙을 관리합니다.</p>
      </div>
      <div class="panel">
        <form class="rule-form" id="rule-form">
          <button type="submit" class="btn btn-primary">규칙 추가</button>
          <input type="text" name="text" class="rule-input" placeholder="예: OB 발생 시 1벌타 후 규정 구역에서 플레이" required />
        </form>
      </div>
      <div class="panel">
        <ul class="rule-list">
          ${
            DATA.rules.length
              ? DATA.rules
                  .map(
                    (r, idx) => `<li>
                      <span class="rule-index">${idx + 1}</span>
                      <span class="rule-text">${escapeHtml(r.text)}</span>
                      <button class="btn-icon" data-del="${r.id}" title="삭제">🗑️</button>
                    </li>`
                  )
                  .join("")
              : `<div class="empty-state"><div class="icon">📖</div><p>등록된 규칙이 없습니다.</p></div>`
          }
        </ul>
      </div>
    `;
    wire();
  }

  function wire() {
    root.querySelector("#rule-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const text = fd.get("text").trim();
      if (!text) return;
      DATA.rules.push({ id: uid(), text });
      saveData();
      draw();
    });

    root.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", () => {
        DATA.rules = DATA.rules.filter((r) => r.id !== btn.dataset.del);
        saveData();
        draw();
      })
    );
  }

  draw();
}

/* ==================== 상품재고 ==================== */

// 초기 등록 수량에 입출고 기록(입고-출고)을 누적 적용해 현재 재고수량을 계산한다.
function computeInventoryStock(item) {
  const chronoLogs = [...(item.logs || [])].sort((a, b) => a.date.localeCompare(b.date));
  let running = item.qty;
  const withBalance = chronoLogs.map((l) => {
    running += (l.stockIn || 0) - (l.stockOut || 0);
    return { ...l, balance: running };
  });
  return {
    currentStock: withBalance.length ? withBalance[withBalance.length - 1].balance : item.qty,
    logsDesc: [...withBalance].reverse(), // 최근 날짜가 맨 위로
  };
}

function renderInventory(root) {
  const expandedIds = new Set();

  function draw() {
    root.innerHTML = `
      <div class="page-header">
        <h2>상품재고</h2>
        <p>경품 및 상품 재고를 관리합니다. 품목명 왼쪽 화살표를 누르면 입출고 기록을 펼치거나 접을 수 있습니다.</p>
      </div>
      <div class="panel">
        <form class="form-grid" id="inventory-form">
          <label>품목명 <input type="text" name="name" required /></label>
          <label>초기 수량 <input type="text" inputmode="numeric" name="qty" class="number-input" value="0" /></label>
          <label>단위 <input type="text" name="unit" placeholder="예: 개, 세트" /></label>
          <label>비고 <input type="text" name="note" /></label>
          <div class="form-actions" style="grid-column: 1 / -1">
            <button type="submit" class="btn btn-primary">품목 추가</button>
          </div>
        </form>
      </div>
      <div class="panel">
        <table class="qc-table inventory-table">
          <thead><tr><th>품목명</th><th>수량</th><th>비고</th><th></th></tr></thead>
          <tbody>
            ${
              DATA.inventory.length
                ? DATA.inventory.map((item) => renderInventoryItemRows(item, expandedIds.has(item.id))).join("")
                : `<tr><td colspan="4"><div class="empty-state"><div class="icon">🎁</div><p>등록된 상품이 없습니다.</p></div></td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
    wire();
    wireNumberInputs(root);
    wireDateSplitInputs(root);
  }

  function renderInventoryItemRows(item, expanded) {
    const { currentStock, logsDesc } = computeInventoryStock(item);
    const headerRow = `<tr>
      <td>
        <button class="btn-icon" data-toggle="${item.id}" title="입출고 기록 ${expanded ? "접기" : "펼치기"}">${expanded ? "▾" : "▸"}</button>
        ${escapeHtml(item.name)}
      </td>
      <td>${formatNumber(currentStock)} ${escapeHtml(item.unit || "")}</td>
      <td>${escapeHtml(item.note || "-")}</td>
      <td><button class="btn-icon" data-del="${item.id}" title="삭제">🗑️</button></td>
    </tr>`;

    if (!expanded) return headerRow;

    const detailRow = `<tr class="inventory-detail-row">
      <td colspan="4">
        <div class="inventory-detail">
          <h4>입출고 기록</h4>
          <form class="form-grid log-form" data-item="${item.id}">
            <label>일자 ${renderDateSplitInput("date", { required: true })}</label>
            <label>입고 <input type="text" inputmode="numeric" class="number-input" name="stockIn" placeholder="0" /></label>
            <label>출고 <input type="text" inputmode="numeric" class="number-input" name="stockOut" placeholder="0" /></label>
            <label>수상자 <input type="text" name="recipient" placeholder="예: 홍길동" /></label>
            <div class="form-actions" style="grid-column: 1 / -1">
              <button type="submit" class="btn btn-secondary">기록 추가</button>
            </div>
          </form>
          <table class="qc-table">
            <thead><tr><th>일자</th><th>입고</th><th>출고</th><th>재고수량</th><th>수상자</th><th></th></tr></thead>
            <tbody>
              ${
                logsDesc.length
                  ? logsDesc
                      .map(
                        (l) => `<tr>
                          <td>${formatDateDisplay(l.date)}</td>
                          <td>${l.stockIn ? formatNumber(l.stockIn) : "-"}</td>
                          <td>${l.stockOut ? formatNumber(l.stockOut) : "-"}</td>
                          <td>${formatNumber(l.balance)}</td>
                          <td>${escapeHtml(l.recipient || "-")}</td>
                          <td><button class="btn-icon" data-dellog="${item.id}::${l.id}" title="삭제">🗑️</button></td>
                        </tr>`
                      )
                      .join("")
                  : `<tr><td colspan="6"><div class="empty-state"><div class="icon">📋</div><p>입출고 기록이 없습니다.</p></div></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </td>
    </tr>`;

    return headerRow + detailRow;
  }

  function wire() {
    root.querySelector("#inventory-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = fd.get("name").trim();
      if (!name) return;
      DATA.inventory.push({
        id: uid(),
        name,
        qty: parseFormattedNumber(fd.get("qty")),
        unit: fd.get("unit").trim(),
        note: fd.get("note").trim(),
        logs: [],
      });
      saveData();
      draw();
    });

    root.querySelectorAll("[data-toggle]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = btn.dataset.toggle;
        if (expandedIds.has(id)) expandedIds.delete(id);
        else expandedIds.add(id);
        draw();
      })
    );

    root.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", () => {
        DATA.inventory = DATA.inventory.filter((i) => i.id !== btn.dataset.del);
        saveData();
        draw();
      })
    );

    root.querySelectorAll(".log-form").forEach((form) =>
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const item = DATA.inventory.find((i) => i.id === form.dataset.item);
        if (!item) return;
        const fd = new FormData(e.target);
        const date = fd.get("date");
        if (!date) return;
        const stockIn = parseFormattedNumber(fd.get("stockIn"));
        const stockOut = parseFormattedNumber(fd.get("stockOut"));
        const recipient = fd.get("recipient").trim();
        if (!item.logs) item.logs = [];
        item.logs.push({ id: uid(), date, stockIn, stockOut, recipient });
        saveData();
        draw();
      })
    );

    root.querySelectorAll("[data-dellog]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const [itemId, logId] = btn.dataset.dellog.split("::");
        const item = DATA.inventory.find((i) => i.id === itemId);
        if (!item) return;
        item.logs = (item.logs || []).filter((l) => l.id !== logId);
        saveData();
        draw();
      })
    );
  }

  draw();
}

/* ==================== 현금장부 ==================== */

function renderCashbook(root) {
  function draw() {
    const sorted = [...DATA.cashbook].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    const rowsChrono = sorted.map((entry) => {
      running += (entry.income || 0) - (entry.expense || 0);
      return { ...entry, balance: running };
    });
    const rowsHtml = [...rowsChrono].reverse(); // 표시용: 최근 날짜가 맨 위로
    const totalIncome = sorted.reduce((a, e) => a + (e.income || 0), 0);
    const totalExpense = sorted.reduce((a, e) => a + (e.expense || 0), 0);

    root.innerHTML = `
      <div class="page-header">
        <h2>현금장부</h2>
        <p>동호회 회비 및 지출 내역을 관리합니다.</p>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="label">총 수입</div><div class="value">${formatNumber(totalIncome)}원</div></div>
        <div class="stat-card"><div class="label">총 지출</div><div class="value">${formatNumber(totalExpense)}원</div></div>
        <div class="stat-card"><div class="label">잔액</div><div class="value">${formatNumber(totalIncome - totalExpense)}원</div></div>
      </div>
      <div class="panel">
        <form class="form-grid" id="cashbook-form">
          <label>날짜 ${renderDateSplitInput("date", { required: true })}</label>
          <label>내용 <input type="text" name="desc" required /></label>
          <label>구분
            <select name="type">
              <option value="income">수입</option>
              <option value="expense">지출</option>
            </select>
          </label>
          <label>금액 <input type="text" inputmode="numeric" name="amount" class="number-input" required /></label>
          <div class="form-actions" style="grid-column: 1 / -1">
            <button type="submit" class="btn btn-primary">내역 추가</button>
          </div>
        </form>
      </div>
      <div class="panel">
        <table class="qc-table">
          <thead><tr><th>날짜</th><th>내용</th><th>수입</th><th>지출</th><th>잔액</th><th></th></tr></thead>
          <tbody>
            ${
              rowsHtml.length
                ? rowsHtml
                    .map(
                      (e) => `<tr>
                        <td>${formatDateDisplay(e.date)}</td>
                        <td>${escapeHtml(e.desc)}</td>
                        <td>${e.income ? formatNumber(e.income) + "원" : "-"}</td>
                        <td>${e.expense ? formatNumber(e.expense) + "원" : "-"}</td>
                        <td>${formatNumber(e.balance)}원</td>
                        <td><button class="btn-icon" data-del="${e.id}" title="삭제">🗑️</button></td>
                      </tr>`
                    )
                    .join("")
                : `<tr><td colspan="6"><div class="empty-state"><div class="icon">💰</div><p>등록된 내역이 없습니다.</p></div></td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
    wire();
    wireNumberInputs(root);
    wireDateSplitInputs(root);
  }

  function wire() {
    root.querySelector("#cashbook-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const date = fd.get("date");
      const desc = fd.get("desc").trim();
      const amount = parseFormattedNumber(fd.get("amount"));
      const type = fd.get("type");
      if (!date || !desc || !amount) return;
      DATA.cashbook.push({
        id: uid(),
        date,
        desc,
        income: type === "income" ? amount : 0,
        expense: type === "expense" ? amount : 0,
      });
      saveData();
      draw();
    });

    root.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", () => {
        DATA.cashbook = DATA.cashbook.filter((e) => e.id !== btn.dataset.del);
        saveData();
        draw();
      })
    );
  }

  draw();
}

/* ==================== 소모품 종류 ==================== */

function renderConsumableTypes(root) {
  let editingId = null;

  function draw() {
    const editing = editingId ? DATA.consumableTypes.find((t) => t.id === editingId) : null;
    root.innerHTML = `
      <div class="page-header">
        <h2>소모품 종류</h2>
        <p>소모품 관리에서 사용할 소모품의 종류와 기본 정보(단위, 분류, 비고)를 등록합니다.</p>
      </div>
      <div class="panel">
        <h3>${editing ? "소모품 종류 수정" : "소모품 종류 추가"}</h3>
        <form class="form-grid" id="consumable-type-form">
          <label>이름
            <input type="text" name="name" required value="${escapeHtml(editing?.name ?? "")}" placeholder="예: A4용지" />
          </label>
          <label>단위
            <input type="text" name="unit" value="${escapeHtml(editing?.unit ?? "")}" placeholder="예: 박스, 개" />
          </label>
          <label>분류
            <input type="text" name="category" value="${escapeHtml(editing?.category ?? "")}" placeholder="예: 사무용품" />
          </label>
          <label>비고
            <input type="text" name="note" value="${escapeHtml(editing?.note ?? "")}" />
          </label>
          <div class="form-actions" style="grid-column: 1 / -1">
            <button type="submit" class="btn btn-primary">${editing ? "수정 완료" : "추가"}</button>
            ${editing ? `<button type="button" class="btn btn-ghost" id="cancel-edit">취소</button>` : ""}
          </div>
        </form>
      </div>
      <div class="panel">
        <table class="qc-table">
          <thead><tr><th>이름</th><th>단위</th><th>분류</th><th>비고</th><th></th></tr></thead>
          <tbody>
            ${
              DATA.consumableTypes.length
                ? DATA.consumableTypes
                    .map(
                      (t) => `<tr>
                        <td>${escapeHtml(t.name)}</td>
                        <td>${escapeHtml(t.unit || "-")}</td>
                        <td>${escapeHtml(t.category || "-")}</td>
                        <td>${escapeHtml(t.note || "-")}</td>
                        <td class="row-actions">
                          <button class="btn-icon" data-edit="${t.id}" title="수정">✏️</button>
                          <button class="btn-icon" data-del="${t.id}" title="삭제">🗑️</button>
                        </td>
                      </tr>`
                    )
                    .join("")
                : `<tr><td colspan="5"><div class="empty-state"><div class="icon">🧰</div><p>등록된 소모품 종류가 없습니다.</p></div></td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
    wire();
  }

  function wire() {
    root.querySelector("#consumable-type-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        name: fd.get("name").trim(),
        unit: fd.get("unit").trim(),
        category: fd.get("category").trim(),
        note: fd.get("note").trim(),
      };
      if (!payload.name) return;
      if (editingId) {
        const t = DATA.consumableTypes.find((x) => x.id === editingId);
        Object.assign(t, payload);
        editingId = null;
      } else {
        DATA.consumableTypes.push({ id: uid(), ...payload });
      }
      saveData();
      draw();
    });

    const cancelBtn = root.querySelector("#cancel-edit");
    if (cancelBtn) cancelBtn.addEventListener("click", () => { editingId = null; draw(); });

    root.querySelectorAll("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () => { editingId = btn.dataset.edit; draw(); })
    );

    root.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (!confirm("이 소모품 종류를 삭제할까요? 관련 등록 내역의 이름 정보는 남아있지만 종류 연결은 사라집니다.")) return;
        DATA.consumableTypes = DATA.consumableTypes.filter((t) => t.id !== btn.dataset.del);
        saveData();
        draw();
      })
    );
  }

  draw();
}

/* ==================== 소모품 관리(등록 / 불량 폐기) ==================== */

const CONSUMABLE_LOG_TYPE_LABEL = { in: "입고", out: "사용(출고)", discard: "불량 폐기" };
const CONSUMABLE_LOG_TYPE_CLASS = { in: "status-pass", out: "status-pending", discard: "status-fail" };

// 종류별 입고/사용/불량폐기 로그를 누적해 현재 재고수량을 계산한다.
function computeConsumableStock(itemId) {
  return DATA.consumableLogs
    .filter((l) => l.itemId === itemId)
    .reduce((sum, l) => sum + (l.type === "in" ? l.qty : -l.qty), 0);
}

function renderConsumables(root) {
  function draw() {
    const typeOptions = DATA.consumableTypes
      .map((t) => `<option value="${t.id}">${escapeHtml(t.name)}${t.unit ? " (" + escapeHtml(t.unit) + ")" : ""}</option>`)
      .join("");

    const sortedLogs = [...DATA.consumableLogs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    root.innerHTML = `
      <div class="page-header">
        <h2>소모품 관리</h2>
        <p>소모품 입고/사용/불량 폐기 내역을 날짜, 이름, 수량, 비고와 함께 등록합니다. 이름은 '소모품 종류'에 먼저 등록해야 선택할 수 있습니다.</p>
      </div>
      ${
        !DATA.consumableTypes.length
          ? `<div class="panel"><div class="empty-state"><div class="icon">🧰</div><p>등록된 소모품 종류가 없습니다. 먼저 '소모품 종류' 메뉴에서 등록하세요.</p></div></div>`
          : `<div class="panel">
              <h3>소모품 등록</h3>
              <form class="form-grid" id="consumable-log-form">
                <label>날짜 ${renderDateSplitInput("date", { id: "consumable-date", required: true, value: todayStr() })}</label>
                <label>이름
                  <select name="itemId" required>
                    <option value="">선택하세요</option>
                    ${typeOptions}
                  </select>
                </label>
                <label>수량 <input type="text" inputmode="numeric" name="qty" class="number-input" required placeholder="0" /></label>
                <label>구분
                  <select name="type">
                    <option value="in">입고</option>
                    <option value="out">사용(출고)</option>
                    <option value="discard">불량 폐기</option>
                  </select>
                </label>
                <label>비고 <input type="text" name="note" /></label>
                <div class="form-actions" style="grid-column: 1 / -1">
                  <button type="submit" class="btn btn-primary">등록</button>
                </div>
              </form>
            </div>`
      }
      <div class="panel">
        <h3>현재 재고</h3>
        <table class="qc-table">
          <thead><tr><th>이름</th><th>단위</th><th>분류</th><th>현재 재고</th></tr></thead>
          <tbody>
            ${
              DATA.consumableTypes.length
                ? DATA.consumableTypes
                    .map(
                      (t) => `<tr>
                        <td>${escapeHtml(t.name)}</td>
                        <td>${escapeHtml(t.unit || "-")}</td>
                        <td>${escapeHtml(t.category || "-")}</td>
                        <td>${formatNumber(computeConsumableStock(t.id))}</td>
                      </tr>`
                    )
                    .join("")
                : `<tr><td colspan="4"><div class="empty-state"><div class="icon">🧰</div><p>등록된 소모품 종류가 없습니다.</p></div></td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div class="panel">
        <h3>등록 내역</h3>
        <table class="qc-table">
          <thead><tr><th>날짜</th><th>이름</th><th>구분</th><th>수량</th><th>비고</th><th></th></tr></thead>
          <tbody>
            ${
              sortedLogs.length
                ? sortedLogs
                    .map((l) => {
                      const item = DATA.consumableTypes.find((t) => t.id === l.itemId);
                      return `<tr>
                        <td>${formatDateDisplay(l.date)}</td>
                        <td>${item ? escapeHtml(item.name) : "(삭제된 종류)"}</td>
                        <td><span class="status-pill ${CONSUMABLE_LOG_TYPE_CLASS[l.type]}">${CONSUMABLE_LOG_TYPE_LABEL[l.type]}</span></td>
                        <td>${formatNumber(l.qty)}${item?.unit ? " " + escapeHtml(item.unit) : ""}</td>
                        <td>${escapeHtml(l.note || "-")}</td>
                        <td><button class="btn-icon" data-del="${l.id}" title="삭제">🗑️</button></td>
                      </tr>`;
                    })
                    .join("")
                : `<tr><td colspan="6"><div class="empty-state"><div class="icon">📦</div><p>등록된 내역이 없습니다.</p></div></td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
    wire();
    wireNumberInputs(root);
    wireDateSplitInputs(root);
  }

  function wire() {
    const form = root.querySelector("#consumable-log-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const date = fd.get("date");
        const itemId = fd.get("itemId");
        const qty = parseFormattedNumber(fd.get("qty"));
        const type = fd.get("type");
        if (!date || !itemId || !qty) return;
        DATA.consumableLogs.push({ id: uid(), date, itemId, type, qty, note: fd.get("note").trim() });
        saveData();
        draw();
      });
    }

    root.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", () => {
        DATA.consumableLogs = DATA.consumableLogs.filter((l) => l.id !== btn.dataset.del);
        saveData();
        draw();
      })
    );
  }

  draw();
}

/* ==================== 커스텀 메뉴(플레이스홀더) ==================== */

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

/* ==================== 사이드바 토글 & 메뉴 추가 ==================== */

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

/* ==================== 초기 실행 ==================== */

const initialId = window.location.hash.replace("#", "") || MENU_ITEMS[0].id;
navigateTo(initialId);
