const storageKey = "study-master-state-v2";
const defaultState = {
  xp: 0,
  asked: 0,
  correct: 0,
  streak: 0,
  lastStudyDate: "",
  wrongBook: [],
  mastered: [],
  favorites: [],
  autoNext: false,
};

const rankRules = [
  { maxXp: 99, name: "小白起步", text: "先把章节打通，再开始稳定刷题。" },
  { maxXp: 239, name: "稳步上分", text: "你已经进入持续得分区间。" },
  { maxXp: 479, name: "进阶选手", text: "现在该用整章和整卷把正确率抬上去。" },
  { maxXp: Infinity, name: "冲刺学霸", text: "题感和节奏都到位了，重点只剩稳定发挥。" },
];

const roadmap = [
  {
    stage: "01",
    name: "章节打底",
    text: "先按课程树把政治和英语过一遍，用章节题把陌生知识点打成认识。",
  },
  {
    stage: "02",
    name: "高频刷透",
    text: "从错题率和低正确率题切入，优先补薄弱章，形成稳定正确率。",
  },
  {
    stage: "03",
    name: "整卷提速",
    text: "穿插模拟考试与历年真题，把时间感、顺序感和答题节奏练出来。",
  },
  {
    stage: "04",
    name: "冲刺闭环",
    text: "回炉错题、重复高频题、整卷冲刺，最后只保留提分动作。",
  },
];

const state = loadState();
let studyData = null;
let allQuestions = [];
let currentQuestion = null;
let answerLocked = false;

const rankName = document.querySelector("#rankName");
const rankText = document.querySelector("#rankText");
const xpBar = document.querySelector("#xpBar");
const xpText = document.querySelector("#xpText");
const accuracyText = document.querySelector("#accuracyText");
const streakText = document.querySelector("#streakText");
const masteredText = document.querySelector("#masteredText");
const wrongText = document.querySelector("#wrongText");
const planText = document.querySelector("#planText");
const totalQuestionsText = document.querySelector("#totalQuestionsText");
const totalMocksText = document.querySelector("#totalMocksText");
const focusModeText = document.querySelector("#focusModeText");
const paceText = document.querySelector("#paceText");
const courseBoard = document.querySelector("#courseBoard");
const chapterHub = document.querySelector("#chapterHub");
const mockHub = document.querySelector("#mockHub");
const roadmapContainer = document.querySelector("#roadmap");
const subjectFilter = document.querySelector("#subjectFilter");
const levelFilter = document.querySelector("#levelFilter");
const chapterFilter = document.querySelector("#chapterFilter");
const tipList = document.querySelector("#tipList");
const questionBadge = document.querySelector("#questionBadge");
const queueCount = document.querySelector("#queueCount");
const questionText = document.querySelector("#questionText");
const options = document.querySelector("#options");
const feedback = document.querySelector("#feedback");
const wrongBookList = document.querySelector("#wrongBookList");
const masteredList = document.querySelector("#masteredList");
const favoriteList = document.querySelector("#favoriteList");
const startQuizBtn = document.querySelector("#startQuizBtn");
const wrongBookBtn = document.querySelector("#wrongBookBtn");
const nextQuestionBtn = document.querySelector("#nextQuestionBtn");
const showAnswerBtn = document.querySelector("#showAnswerBtn");
const favoriteBtn = document.querySelector("#favoriteBtn");
const autoNextToggle = document.querySelector("#autoNextToggle");
const installAppBtn = document.querySelector("#installAppBtn");
const jumpAllBtn = document.querySelector("#jumpAllBtn");
const jumpPoliticsBtn = document.querySelector("#jumpPoliticsBtn");
const jumpEnglishBtn = document.querySelector("#jumpEnglishBtn");
let deferredPrompt = null;

init();

async function init() {
  renderRoadmap();
  renderDashboard();
  bindEvents();
  bindInstallPrompt();

  questionText.textContent = "正在加载真实章节题库。";
  questionBadge.textContent = "同步中";

  const response = await fetch("./data/study-data.json");
  studyData = await response.json();
  allQuestions = [
    ...studyData.subjects.politics.questions,
    ...studyData.subjects.english.questions,
  ];

  renderCourseBoard();
  renderHubCards();
  renderTips();
  renderChapterFilterOptions();
  renderDashboard();
  loadNextQuestion();
}

function bindEvents() {
  startQuizBtn.addEventListener("click", () => {
    applyPreset("all");
  });

  wrongBookBtn.addEventListener("click", () => {
    loadNextQuestion(true);
    scrollToPractice();
  });

  nextQuestionBtn.addEventListener("click", () => loadNextQuestion());
  subjectFilter.addEventListener("change", () => {
    syncQuickSwitch(subjectFilter.value);
    renderChapterFilterOptions();
    loadNextQuestion();
  });
  levelFilter.addEventListener("change", () => loadNextQuestion());
  chapterFilter.addEventListener("change", () => loadNextQuestion());

  jumpAllBtn?.addEventListener("click", () => applyPreset("all"));
  jumpPoliticsBtn?.addEventListener("click", () => applyPreset("politics"));
  jumpEnglishBtn?.addEventListener("click", () => applyPreset("english"));

  showAnswerBtn.addEventListener("click", () => {
    if (!currentQuestion || answerLocked) return;
    revealAnswer(currentQuestion.answer, true);
    addWrong(currentQuestion.id);
    persistState();
    renderDashboard();
  });

  favoriteBtn?.addEventListener("click", () => {
    if (!currentQuestion) return;
    toggleFavorite(currentQuestion.id);
    persistState();
    updateFavoriteButton();
    renderDashboard();
  });

  autoNextToggle?.addEventListener("change", () => {
    state.autoNext = autoNextToggle.checked;
    persistState();
  });
}

function bindInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installAppBtn.classList.remove("hidden");
  });

  installAppBtn?.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installAppBtn.classList.add("hidden");
  });
}

function applyPreset(subject) {
  subjectFilter.value = subject;
  levelFilter.value = "all";
  syncQuickSwitch(subject);
  renderChapterFilterOptions();
  chapterFilter.value = "all";
  loadNextQuestion();
  scrollToPractice();
}

function startChapterRun(subject, chapterId) {
  subjectFilter.value = subject;
  levelFilter.value = "all";
  syncQuickSwitch(subject);
  renderChapterFilterOptions();
  chapterFilter.value = chapterId;
  loadNextQuestion();
  scrollToPractice();
}

function startMockRun(subject) {
  subjectFilter.value = subject;
  levelFilter.value = "master";
  syncQuickSwitch(subject);
  renderChapterFilterOptions();
  chapterFilter.value = "all";
  loadNextQuestion();
  scrollToPractice();
}

function syncQuickSwitch(subject) {
  const map = {
    all: jumpAllBtn,
    politics: jumpPoliticsBtn,
    english: jumpEnglishBtn,
  };

  [jumpAllBtn, jumpPoliticsBtn, jumpEnglishBtn].forEach((button) => button?.classList.remove("is-active"));
  map[subject]?.classList.add("is-active");
}

function scrollToPractice() {
  document.querySelector(".practice-zone")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderRoadmap() {
  roadmapContainer.innerHTML = roadmap
    .map(
      (item) => `
        <article class="timeline-step">
          <span>${item.stage}</span>
          <h3>${item.name}</h3>
          <p>${item.text}</p>
        </article>
      `
    )
    .join("");
}

function renderCourseBoard() {
  const cards = Object.values(studyData.subjects).map((subject) => {
    const moduleList = subject.modules
      .map(
        (module) => `
          <article>
            <strong>${module.name}</strong>
            <div class="course-meta">${module.exerNum} 题 · ${module.children.length} 章</div>
          </article>
        `
      )
      .join("");

    const mockList = subject.mocks
      .slice(0, 6)
      .map((exam) => `<span class="live-chip">${exam.title} · ${exam.exerNum} 题</span>`)
      .join("");

    return `
      <article class="course-card">
        <header>
          <div>
            <h3>${subject.courseName}</h3>
            <p class="course-meta">有效期至 ${subject.validUntil} · 章节题 ${subject.totalQuestions} 道 · 模拟卷 ${subject.mocks.length} 套</p>
          </div>
          <span class="course-tag">${subject.label}</span>
        </header>
        <div class="course-summary">
          <article>
            <div class="module-count">模块总览</div>
            <strong>${subject.moduleCount} 组模块</strong>
            <div>章节总数 ${subject.modules.reduce((sum, item) => sum + item.children.length, 0)} 章</div>
          </article>
          <article>
            <div class="module-count">模拟考试</div>
            <strong>${subject.mocks.length} 套</strong>
            <div>${mockList}</div>
          </article>
          <article>
            <div class="module-count">学习提醒</div>
            <div>${subject.reminders.map((item) => `<div>• ${item}</div>`).join("")}</div>
          </article>
          ${moduleList}
        </div>
      </article>
    `;
  });

  courseBoard.innerHTML = cards.join("");
}

function renderHubCards() {
  const chapterCards = Object.entries(studyData.subjects).map(([key, subject]) => {
    const firstChapter = getAvailableChapters(key)[0];
    return `
      <article class="hub-card">
        <p class="mini-label">${subject.label}章节入口</p>
        <h3>${subject.courseName}</h3>
        <p>${getAvailableChapters(key).length} 个可刷章节 · ${subject.totalQuestions} 道题</p>
        <div class="hub-meta">
          <span>${firstChapter?.name || "等待补齐章节"}</span>
          <span>${firstChapter?.exerNum || 0} 题</span>
        </div>
        <button class="primary-btn hub-btn" data-action="chapter" data-subject="${key}" data-chapter="${firstChapter?.id || ""}">开始本章</button>
      </article>
    `;
  });

  const mockCards = Object.entries(studyData.subjects).map(([key, subject]) => `
    <article class="hub-card soft-card">
      <p class="mini-label">${subject.label}模拟卷</p>
      <h3>${subject.mocks[0]?.title || `${subject.label}模拟卷`}</h3>
      <p>${subject.mocks.length} 套卷单已同步，可以先从卷单切入冲刺模式。</p>
      <div class="hub-list">
        ${subject.mocks.slice(0, 3).map((mock) => `<span class="live-chip">${mock.title}</span>`).join("")}
      </div>
      <div class="hub-actions">
        <button class="primary-btn hub-btn" data-action="mock" data-subject="${key}">冲刺模式</button>
      </div>
    </article>
  `);

  chapterHub.innerHTML = chapterCards.join("");
  mockHub.innerHTML = mockCards.join("");

  document.querySelectorAll(".hub-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const { action, subject, chapter } = button.dataset;
      if (action === "chapter" && chapter) startChapterRun(subject, chapter);
      if (action === "mock") startMockRun(subject);
    });
  });
}

function renderTips() {
  const tips = [
    `当前真题总量 ${studyData.totals.questions} 道，先用章节题建立框架。`,
    `政治章节题 ${studyData.totals.politicsQuestions} 道，政治模拟卷 ${studyData.totals.politicsMocks} 套。`,
    `英语章节题 ${studyData.totals.englishQuestions} 道，英语模拟卷 ${studyData.totals.englishMocks} 套。`,
    "先刷章节题，再冲模拟卷，最后回炉错题，这是效率最高的闭环。",
  ];
  tipList.innerHTML = tips.map((tip) => `<li>${tip}</li>`).join("");
}

function renderChapterFilterOptions() {
  if (!studyData) return;
  const subject = subjectFilter.value;
  const chapters =
    subject === "all"
      ? ["politics", "english"].flatMap((key) =>
          getAvailableChapters(key).map((chapter) => ({
            id: chapter.id,
            name: `${studyData.subjects[key].label} · ${chapter.name}`,
          }))
        )
      : getAvailableChapters(subject).map((chapter) => ({ id: chapter.id, name: chapter.name }));

  const previous = chapterFilter.value;
  chapterFilter.innerHTML = [
    `<option value="all">全部章节</option>`,
    ...chapters.map((chapter) => `<option value="${chapter.id}">${chapter.name}</option>`),
  ].join("");
  chapterFilter.value = chapters.some((chapter) => chapter.id === previous) ? previous : "all";
}

function getAvailableChapters(subject) {
  return studyData.subjects[subject].modules.flatMap((module) =>
    module.children.filter((chapter) => chapter.exerNum > 0)
  );
}

function getLevel(question) {
  if (!question) return "beginner";
  if (question.practiceCount > 40000 || question.accuracy < 55) return "master";
  if (question.practiceCount > 15000 || question.accuracy < 70) return "advanced";
  return "beginner";
}

function getLabel(question) {
  const levelMap = {
    beginner: "新手热身",
    advanced: "进阶提速",
    master: "学霸冲刺",
  };
  return `${question.subjectLabel} · ${levelMap[getLevel(question)]}`;
}

function getQuestionQueue(onlyWrong = false) {
  const subject = subjectFilter.value;
  const level = levelFilter.value;
  const chapter = chapterFilter.value;

  return allQuestions.filter((question) => {
    if (onlyWrong && !state.wrongBook.includes(question.id)) return false;
    if (subject !== "all" && question.subject !== subject) return false;
    if (level !== "all" && getLevel(question) !== level) return false;
    if (chapter !== "all" && question.chapterId !== chapter) return false;
    return true;
  });
}

function loadNextQuestion(onlyWrong = false) {
  if (!studyData) return;

  const queue = getQuestionQueue(onlyWrong);
  queueCount.textContent = `当前题库 ${queue.length} 题`;
  feedback.classList.add("hidden");
  feedback.innerHTML = "";
  answerLocked = false;

  if (!queue.length) {
    currentQuestion = null;
    questionBadge.textContent = onlyWrong ? "错题本为空" : "当前筛选无题";
    questionText.textContent = onlyWrong
      ? "你的错题本现在是空的，继续刷新题更划算。"
      : "当前筛选条件下没有题，换个科目或难度继续。";
    options.innerHTML = "";
    updateFavoriteButton();
    return;
  }

  currentQuestion = queue[Math.floor(Math.random() * queue.length)];
  questionBadge.textContent = `${getLabel(currentQuestion)} · ${currentQuestion.chapterName}`;
  questionText.innerHTML = currentQuestion.prompt;
  updateFavoriteButton();

  options.innerHTML = currentQuestion.options
    .map(
      (option) => `
        <button class="option-btn" data-key="${option.key}">
          ${option.key}. ${option.text}
        </button>
      `
    )
    .join("");

  document.querySelectorAll(".option-btn").forEach((button) => {
    button.addEventListener("click", () => {
      if (answerLocked) return;
      revealAnswer([button.dataset.key], false);
    });
  });
}

function revealAnswer(selectedKeys, forcedReveal) {
  if (!currentQuestion) return;
  answerLocked = true;
  updateStreak();

  const selectedSet = new Set(selectedKeys);
  const answerSet = new Set(currentQuestion.answer);
  const correct =
    selectedSet.size === answerSet.size &&
    [...selectedSet].every((key) => answerSet.has(key));

  document.querySelectorAll(".option-btn").forEach((button) => {
    const key = button.dataset.key;
    if (answerSet.has(key)) button.classList.add("correct");
    if (selectedSet.has(key) && !answerSet.has(key)) button.classList.add("wrong");
  });

  if (!forcedReveal) {
    state.asked += 1;
    if (correct) {
      state.correct += 1;
      state.xp += getLevel(currentQuestion) === "master" ? 24 : getLevel(currentQuestion) === "advanced" ? 16 : 10;
      addMastered(currentQuestion.id);
      removeWrong(currentQuestion.id);
    } else {
      state.xp += 2;
      addWrong(currentQuestion.id);
    }
  }

  feedback.classList.remove("hidden");
  feedback.innerHTML = `
    <strong>${forcedReveal ? "标准答案已显示" : correct ? "答对了" : "这题错了"}</strong>
    <div>正确答案：${currentQuestion.answer.join("、")}</div>
    <div>${currentQuestion.explanation || "本题暂无解析。"}</div>
    <div class="course-meta">章节：${currentQuestion.linkName} · 历史作答 ${currentQuestion.practiceCount} 次 · 平均正确率 ${currentQuestion.accuracy}%</div>
  `;

  persistState();
  renderDashboard();

  if (!forcedReveal && state.autoNext) {
    window.setTimeout(() => loadNextQuestion(), 900);
  }
}

function renderDashboard() {
  const accuracy = state.asked ? Math.round((state.correct / state.asked) * 100) : 0;
  const rank = rankRules.find((item) => state.xp <= item.maxXp);
  const barMax = rank.maxXp === Infinity ? 600 : rank.maxXp;
  const progress = Math.min(100, Math.round((state.xp / barMax) * 100));

  rankName.textContent = rank.name;
  rankText.textContent = rank.text;
  xpBar.style.width = `${progress}%`;
  xpText.textContent = `${state.xp} XP`;
  accuracyText.textContent = `正确率 ${accuracy}%`;
  streakText.textContent = `${state.streak} 天`;
  masteredText.textContent = `${state.mastered.length} 题`;
  wrongText.textContent = `${state.wrongBook.length} 题`;
  autoNextToggle.checked = Boolean(state.autoNext);

  if (studyData) {
    planText.textContent =
      state.xp < 120
        ? `先刷政治 ${studyData.totals.politicsQuestions} 题 + 英语 ${studyData.totals.englishQuestions} 题`
        : "切整卷 + 错题回炉";

    totalQuestionsText.textContent = `${studyData.totals.questions} 题`;
    totalMocksText.textContent = `${studyData.totals.politicsMocks + studyData.totals.englishMocks} 套`;
    focusModeText.textContent =
      state.wrongBook.length > 0
        ? `先回 ${Math.min(state.wrongBook.length, 20)} 道错题`
        : state.xp < 120
          ? "双科章节热身"
          : "开始整卷冲刺";
    paceText.textContent =
      accuracy < 60 ? "先稳正确率" : accuracy < 80 ? "开始提速刷题" : "切整卷稳节奏";
  } else {
    planText.textContent = "正在同步数据";
    totalQuestionsText.textContent = "同步中";
    totalMocksText.textContent = "同步中";
    focusModeText.textContent = "准备同步";
    paceText.textContent = "先章节，再错题，再整卷";
  }

  wrongBookList.innerHTML = state.wrongBook.length
    ? state.wrongBook
        .map((id) => allQuestions.find((item) => item.id === id))
        .filter(Boolean)
        .slice(0, 20)
        .map((item) => `<span class="wrong-chip">${item.subjectLabel} · ${item.chapterName} · ${stripHtml(item.prompt)}</span>`)
        .join("")
    : "还没有错题，继续保持。";

  masteredList.innerHTML = state.mastered.length
    ? state.mastered
        .map((id) => allQuestions.find((item) => item.id === id))
        .filter(Boolean)
        .slice(0, 20)
        .map((item) => `<span class="master-chip">${item.subjectLabel} · ${item.chapterName} · ${stripHtml(item.prompt)}</span>`)
        .join("")
    : "还没有掌握题，先开始第一轮。";

  favoriteList.innerHTML = state.favorites.length
    ? state.favorites
        .map((id) => allQuestions.find((item) => item.id === id))
        .filter(Boolean)
        .slice(0, 20)
        .map((item) => `<span class="live-chip">${item.subjectLabel} · ${item.chapterName} · ${stripHtml(item.prompt)}</span>`)
        .join("")
    : "收藏几道高频题，后面回看更快。";
}

function addWrong(id) {
  if (!state.wrongBook.includes(id)) state.wrongBook.unshift(id);
}

function removeWrong(id) {
  state.wrongBook = state.wrongBook.filter((item) => item !== id);
}

function addMastered(id) {
  if (!state.mastered.includes(id)) state.mastered.unshift(id);
}

function toggleFavorite(id) {
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter((item) => item !== id);
    return;
  }
  state.favorites.unshift(id);
}

function updateFavoriteButton() {
  if (!favoriteBtn) return;
  if (!currentQuestion) {
    favoriteBtn.textContent = "收藏本题";
    return;
  }
  favoriteBtn.textContent = state.favorites.includes(currentQuestion.id) ? "取消收藏" : "收藏本题";
}

function stripHtml(text) {
  return String(text).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(storageKey) || "{}") };
  } catch {
    return { ...defaultState };
  }
}

function persistState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function updateStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastStudyDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.streak = state.lastStudyDate === yesterday ? state.streak + 1 : 1;
  state.lastStudyDate = today;
}
