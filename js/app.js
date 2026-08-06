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
  members: [], // {id, name}
  rounds: [], // {id, courseId, date}  -- 스코어 리스트에 등록된 라운드
  scores: {}, // `${roundId}::${memberId}` -> strokes(number)
  rules: [], // {id, text}
  inventory: [], // {id, name, qty, unit, note}
  cashbook: [], // {id, date, desc, income, expense}
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DATA));
    const parsed = JSON.parse(raw);
    return { ...JSON.parse(JSON.stringify(DEFAULT_DATA)), ...parsed };
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
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

/* ==================== 스코어 엑셀 일괄등록 ==================== */

function normalizeDateValue(val) {
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, "0")}-${String(val.getDate()).padStart(2, "0")}`;
  }
  const s = String(val ?? "").trim();
  const m = s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return s;
}

function importScoreRows(rows) {
  let success = 0;
  const failed = [];
  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1행은 헤더
    const name = String(row["이름"] ?? "").trim();
    const courseName = String(row["골프장"] ?? "").trim();
    const dateRaw = row["날짜"];
    const scoreRaw = row["타수"];
    if (!name || !courseName || !dateRaw || scoreRaw === "" || scoreRaw === undefined) {
      failed.push(`${rowNum}행: 필수 값 누락`);
      return;
    }
    const date = normalizeDateValue(dateRaw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      failed.push(`${rowNum}행: 날짜 형식 오류 (${dateRaw})`);
      return;
    }
    const score = Number(scoreRaw);
    if (Number.isNaN(score)) {
      failed.push(`${rowNum}행: 타수가 숫자가 아님 (${scoreRaw})`);
      return;
    }
    const course = findCourseByName(courseName);
    if (!course) {
      failed.push(`${rowNum}행: 등록되지 않은 골프장 (${courseName})`);
      return;
    }
    let member = DATA.members.find((m) => m.name.trim() === name);
    if (!member) {
      member = { id: uid(), name };
      DATA.members.push(member);
    }
    let round = DATA.rounds.find((r) => r.courseId === course.id && r.date === date);
    if (!round) {
      round = { id: uid(), courseId: course.id, date };
      DATA.rounds.push(round);
    }
    DATA.scores[`${round.id}::${member.id}`] = score;
    success++;
  });
  saveData();
  return { success, failed };
}

function downloadExcelTemplate() {
  if (typeof XLSX === "undefined") {
    alert("엑셀 기능을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.");
    return;
  }
  const wsData = [
    ["이름", "골프장", "날짜", "타수"],
    ["홍길동", "남서울CC", "2026-08-15", 88],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "스코어");
  XLSX.writeFile(wb, "스코어_업로드_양식.xlsx");
}

function handleExcelUpload(file, onDone) {
  if (typeof XLSX === "undefined") {
    alert("엑셀 기능을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const result = importScoreRows(rows);
      alert(
        `일괄등록 완료: 성공 ${result.success}건, 실패 ${result.failed.length}건` +
          (result.failed.length ? "\n\n실패 사유:\n" + result.failed.join("\n") : "")
      );
      onDone();
    } catch (err) {
      alert("파일을 읽는 중 오류가 발생했습니다: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
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
            <input type="date" name="date" id="schedule-date" required />
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
            <input type="number" name="greenFee" min="0" step="1000" value="${editing?.greenFee ?? ""}" />
          </label>
          <label>캐디피 (원)
            <input type="number" name="caddieFee" min="0" step="1000" value="${editing?.caddieFee ?? ""}" />
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
  }

  function wire() {
    root.querySelector("#course-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        name: fd.get("name").trim(),
        greenFee: Number(fd.get("greenFee")) || 0,
        caddieFee: Number(fd.get("caddieFee")) || 0,
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

function renderScores(root) {
  function draw() {
    const rounds = [...DATA.rounds].sort((a, b) => a.date.localeCompare(b.date));
    const scheduleOptions = [...DATA.schedules]
      .filter((s) => s.courseId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => {
        const course = DATA.courses.find((c) => c.id === s.courseId);
        return `<option value="${s.id}">${formatDateDisplay(s.date)} - ${course ? escapeHtml(course.name) : "미정"}</option>`;
      })
      .join("");

    const rankSource = DATA.members.map((m) => {
      const nums = rounds
        .map((r) => DATA.scores[`${r.id}::${m.id}`])
        .filter((v) => v !== undefined && v !== null && v !== "")
        .map(Number)
        .filter((n) => !Number.isNaN(n));
      const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
      return { id: m.id, avg };
    });
    const ranked = rankSource.filter((r) => r.avg !== null).sort((a, b) => a.avg - b.avg);
    const rankMap = {};
    ranked.forEach((r, idx) => (rankMap[r.id] = idx + 1));

    // 팀 분배: 회원별 직전/최근 라운딩 점수
    const teamRows = DATA.members.map((m) => {
      const played = rounds
        .map((r) => ({ round: r, score: DATA.scores[`${r.id}::${m.id}`] }))
        .filter((x) => x.score !== undefined && x.score !== null && x.score !== "");
      const latest = played[played.length - 1];
      const previous = played[played.length - 2];
      return {
        id: m.id,
        name: m.name,
        latestScore: latest ? Number(latest.score) : null,
        latestDate: latest ? latest.round.date : null,
        previousScore: previous ? Number(previous.score) : null,
        previousDate: previous ? previous.round.date : null,
      };
    });
    const teamSorted = [...teamRows].sort((a, b) => {
      if (a.latestScore === null && b.latestScore === null) return 0;
      if (a.latestScore === null) return 1;
      if (b.latestScore === null) return -1;
      return a.latestScore - b.latestScore;
    });

    root.innerHTML = `
      <div class="page-header">
        <h2>스코어 리스트</h2>
        <p>라운딩별 타수를 입력하면 평균 타수를 기준으로 랭킹이 자동 계산됩니다. 엑셀 파일로 여러 명의 타수를 한 번에 등록할 수도 있습니다.</p>
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
          <button type="button" class="btn btn-ghost" id="excel-template-btn">엑셀 양식 다운로드</button>
          <label class="btn btn-secondary file-btn">
            엑셀 일괄등록
            <input type="file" id="excel-upload" accept=".xlsx,.xls,.csv" hidden />
          </label>
        </div>
      </div>
      <div class="panel score-panel">
        <div class="table-scroll">
          <table class="qc-table score-table">
            <thead>
              <tr>
                <th rowspan="2" class="sticky-col">이름</th>
                <th rowspan="2">랭킹</th>
                ${rounds
                  .map((r) => {
                    const course = DATA.courses.find((c) => c.id === r.courseId);
                    return `<th>${course ? escapeHtml(course.name) : "(삭제된 골프장)"} <button class="btn-icon" data-delround="${r.id}" title="라운드 삭제">✕</button></th>`;
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
                      .map(
                        (m) => `<tr>
                        <td class="sticky-col">${escapeHtml(m.name)} <button class="btn-icon" data-delmember="${m.id}" title="회원 삭제">✕</button></td>
                        <td>${rankMap[m.id] ? rankMap[m.id] + "위" : "-"}</td>
                        ${rounds
                          .map((r) => {
                            const key = `${r.id}::${m.id}`;
                            const val = DATA.scores[key];
                            return `<td><input type="number" class="score-input" data-round="${r.id}" data-member="${m.id}" value="${val ?? ""}" placeholder="-" /></td>`;
                          })
                          .join("")}
                      </tr>`
                      )
                      .join("")
                  : `<tr><td colspan="${2 + rounds.length}"><div class="empty-state"><div class="icon">👥</div><p>등록된 회원이 없습니다.</p></div></td></tr>`
              }
            </tbody>
          </table>
        </div>
        ${!rounds.length ? `<div class="empty-state"><div class="icon">⛳</div><p>등록된 라운드가 없습니다. 먼저 '골프 일정'에서 골프장을 지정한 일정을 등록하세요.</p></div>` : ""}
      </div>
      <div class="panel">
        <h3>팀 분배</h3>
        <p class="panel-desc">각 회원의 직전 라운딩 점수와 최근 라운딩 점수를 비교하고, 최근 성적이 좋은 순서대로 등수를 매깁니다.</p>
        <table class="qc-table">
          <thead><tr><th>등수</th><th>이름</th><th>직전 라운딩 점수</th><th>최근 라운딩 점수</th></tr></thead>
          <tbody>
            ${
              teamSorted.length
                ? teamSorted
                    .map(
                      (r, idx) => `<tr>
                        <td>${r.latestScore !== null ? idx + 1 + "위" : "-"}</td>
                        <td>${escapeHtml(r.name)}</td>
                        <td>${r.previousScore !== null ? r.previousScore + "타 (" + formatDateDisplay(r.previousDate) + ")" : "-"}</td>
                        <td>${r.latestScore !== null ? r.latestScore + "타 (" + formatDateDisplay(r.latestDate) + ")" : "-"}</td>
                      </tr>`
                    )
                    .join("")
                : `<tr><td colspan="4"><div class="empty-state"><div class="icon">🏌️</div><p>회원과 타수를 먼저 등록하세요.</p></div></td></tr>`
            }
          </tbody>
        </table>
        <h4>자동 팀 나누기</h4>
        <form class="inline-form" id="team-form">
          <label>팀 수 <input type="number" name="teamCount" min="2" max="${Math.max(2, DATA.members.length)}" value="2" /></label>
          <button type="submit" class="btn btn-primary">팀 배정</button>
        </form>
        <div id="team-result"></div>
      </div>
    `;
    wire(teamSorted);
  }

  function wire(teamSorted) {
    root.querySelector("#member-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = fd.get("name").trim();
      if (!name) return;
      DATA.members.push({ id: uid(), name });
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

    root.querySelector("#excel-template-btn").addEventListener("click", () => {
      downloadExcelTemplate();
    });

    root.querySelector("#excel-upload").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      handleExcelUpload(file, () => draw());
      e.target.value = "";
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

    root.querySelectorAll("[data-delmember]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (!confirm("이 회원을 삭제할까요?")) return;
        const mid = btn.dataset.delmember;
        DATA.members = DATA.members.filter((m) => m.id !== mid);
        Object.keys(DATA.scores).forEach((k) => {
          if (k.endsWith("::" + mid)) delete DATA.scores[k];
        });
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

    root.querySelector("#team-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const teamCount = Math.max(2, Math.min(DATA.members.length || 2, Number(fd.get("teamCount")) || 2));
      const teams = Array.from({ length: teamCount }, () => []);
      teamSorted.forEach((r, idx) => {
        const round = Math.floor(idx / teamCount);
        const pos = round % 2 === 0 ? idx % teamCount : teamCount - 1 - (idx % teamCount);
        teams[pos].push(r.name);
      });
      const resultEl = root.querySelector("#team-result");
      resultEl.innerHTML = `<div class="team-grid">${teams
        .map(
          (t, i) => `<div class="team-card">
            <h4>Team ${i + 1}</h4>
            <ul>${t.map((name) => `<li>${escapeHtml(name)}</li>`).join("") || "<li>-</li>"}</ul>
          </div>`
        )
        .join("")}</div>`;
    });
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
        <form class="inline-form" id="rule-form">
          <input type="text" name="text" placeholder="예: OB 발생 시 1벌타 후 규정 구역에서 플레이" required />
          <button type="submit" class="btn btn-primary">규칙 추가</button>
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

function renderInventory(root) {
  function draw() {
    root.innerHTML = `
      <div class="page-header">
        <h2>상품재고</h2>
        <p>경품 및 상품 재고를 관리합니다.</p>
      </div>
      <div class="panel">
        <form class="form-grid" id="inventory-form">
          <label>품목명 <input type="text" name="name" required /></label>
          <label>수량 <input type="number" name="qty" min="0" value="0" /></label>
          <label>단위 <input type="text" name="unit" placeholder="예: 개, 세트" /></label>
          <label>비고 <input type="text" name="note" /></label>
          <div class="form-actions" style="grid-column: 1 / -1">
            <button type="submit" class="btn btn-primary">품목 추가</button>
          </div>
        </form>
      </div>
      <div class="panel">
        <table class="qc-table">
          <thead><tr><th>품목명</th><th>수량</th><th>비고</th><th></th></tr></thead>
          <tbody>
            ${
              DATA.inventory.length
                ? DATA.inventory
                    .map(
                      (i) => `<tr>
                        <td>${escapeHtml(i.name)}</td>
                        <td>
                          <div class="qty-control">
                            <button class="btn-icon" data-dec="${i.id}">−</button>
                            <span>${i.qty} ${escapeHtml(i.unit || "")}</span>
                            <button class="btn-icon" data-inc="${i.id}">＋</button>
                          </div>
                        </td>
                        <td>${escapeHtml(i.note || "-")}</td>
                        <td><button class="btn-icon" data-del="${i.id}" title="삭제">🗑️</button></td>
                      </tr>`
                    )
                    .join("")
                : `<tr><td colspan="4"><div class="empty-state"><div class="icon">🎁</div><p>등록된 상품이 없습니다.</p></div></td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
    wire();
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
        qty: Number(fd.get("qty")) || 0,
        unit: fd.get("unit").trim(),
        note: fd.get("note").trim(),
      });
      saveData();
      draw();
    });

    root.querySelectorAll("[data-inc]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const item = DATA.inventory.find((i) => i.id === btn.dataset.inc);
        item.qty += 1;
        saveData();
        draw();
      })
    );

    root.querySelectorAll("[data-dec]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const item = DATA.inventory.find((i) => i.id === btn.dataset.dec);
        item.qty = Math.max(0, item.qty - 1);
        saveData();
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
  }

  draw();
}

/* ==================== 현금장부 ==================== */

function renderCashbook(root) {
  function draw() {
    const sorted = [...DATA.cashbook].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    const rowsHtml = sorted.map((entry) => {
      running += (entry.income || 0) - (entry.expense || 0);
      return { ...entry, balance: running };
    });
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
          <label>날짜 <input type="date" name="date" required /></label>
          <label>내용 <input type="text" name="desc" required /></label>
          <label>구분
            <select name="type">
              <option value="income">수입</option>
              <option value="expense">지출</option>
            </select>
          </label>
          <label>금액 <input type="number" name="amount" min="0" required /></label>
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
  }

  function wire() {
    root.querySelector("#cashbook-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const date = fd.get("date");
      const desc = fd.get("desc").trim();
      const amount = Number(fd.get("amount")) || 0;
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
