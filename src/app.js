const storageKey = "study-master-state-v2";
const defaultState = {
  xp: 0,
  asked: 0,
  correct: 0,
  streak: 0,
  lastStudyDate: "",
  wrongBook: [],
  mastered: [],
  autoNext: false,
};

const rankRules = [
  { maxXp: 99, name: "小白起步", text: "先把章节打通，再开始稳定刷题。" },
  { maxXp: 239, name: "稳步上分", text: "你已经进入持续得分区间。" },
  { maxXp: 479, name: "进阶选手", text: "现在该用整章和整卷把正确率抬上去。" },
  { maxXp: Infinity, name: "冲刺学霸", text: "题感和节奏都到位了，重点只剩稳定发挥。" },
];

const state = loadState();
let studyData = null;
let allQuestions = [];
let currentQuestion = null;
let answerLocked = false;
let pinnedQuestionId = "";
let sessionState = {
  mode: "mixed",
  total: 0,
  done: 0,
  correct: 0,
  onlyWrong: false,
};

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
const subjectFilter = document.querySelector("#subjectFilter");
const levelFilter = document.querySelector("#levelFilter");
const chapterFilter = document.querySelector("#chapterFilter");
const questionBadge = document.querySelector("#questionBadge");
const queueCount = document.querySelector("#queueCount");
const sessionModeText = document.querySelector("#sessionModeText");
const sessionProgressText = document.querySelector("#sessionProgressText");
const sessionAccuracyText = document.querySelector("#sessionAccuracyText");
const sessionProgressBar = document.querySelector("#sessionProgressBar");
const questionStage = document.querySelector("#questionStage");
const questionText = document.querySelector("#questionText");
const chapterHint = document.querySelector("#chapterHint");
const options = document.querySelector("#options");
const feedback = document.querySelector("#feedback");
const wrongBookList = document.querySelector("#wrongBookList");
const masteredList = document.querySelector("#masteredList");
const startQuizBtn = document.querySelector("#startQuizBtn");
const wrongBookBtn = document.querySelector("#wrongBookBtn");
const sprintModeBtn = document.querySelector("#sprintModeBtn");
const nextQuestionBtn = document.querySelector("#nextQuestionBtn");
const showAnswerBtn = document.querySelector("#showAnswerBtn");
const autoNextToggle = document.querySelector("#autoNextToggle");
const installAppBtn = document.querySelector("#installAppBtn");
const jumpAllBtn = document.querySelector("#jumpAllBtn");
const jumpPoliticsBtn = document.querySelector("#jumpPoliticsBtn");
const jumpEnglishBtn = document.querySelector("#jumpEnglishBtn");
let deferredPrompt = null;

init();

async function init() {
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

  renderChapterFilterOptions();
  renderDashboard();
  loadNextQuestion();
}

function bindEvents() {
  startQuizBtn.addEventListener("click", () => {
    startSession("mixed");
  });

  wrongBookBtn.addEventListener("click", () => {
    startSession("wrong");
  });

  sprintModeBtn?.addEventListener("click", () => {
    startSession("sprint");
  });

  nextQuestionBtn.addEventListener("click", () => loadNextQuestion(sessionState.onlyWrong));
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
  sessionState.mode = subject === "all" ? "mixed" : subject;
  syncSessionQueue();
  loadNextQuestion();
  scrollToPractice();
}

function startSession(mode) {
  if (mode === "wrong") {
    sessionState.mode = "wrong";
    sessionState.onlyWrong = true;
    sessionState.done = 0;
    sessionState.correct = 0;
    syncSessionQueue();
    loadNextQuestion(true);
    scrollToPractice();
    return;
  }

  sessionState.onlyWrong = false;
  sessionState.done = 0;
  sessionState.correct = 0;

  if (mode === "sprint") {
    sessionState.mode = "sprint";
    subjectFilter.value = "all";
    levelFilter.value = "master";
    syncQuickSwitch("all");
    renderChapterFilterOptions();
    chapterFilter.value = "all";
    syncSessionQueue();
    loadNextQuestion();
    scrollToPractice();
    return;
  }

  applyPreset("all");
}

function startChapterRun(subject, chapterId) {
  subjectFilter.value = subject;
  levelFilter.value = "all";
  syncQuickSwitch(subject);
  renderChapterFilterOptions();
  chapterFilter.value = chapterId;
  sessionState.mode = "chapter";
  sessionState.onlyWrong = false;
  sessionState.done = 0;
  sessionState.correct = 0;
  syncSessionQueue();
  loadNextQuestion();
  scrollToPractice();
}

function startMockRun(subject) {
  subjectFilter.value = subject;
  levelFilter.value = "master";
  syncQuickSwitch(subject);
  renderChapterFilterOptions();
  chapterFilter.value = "all";
  pinnedQuestionId = "";
  sessionState.mode = "sprint";
  sessionState.onlyWrong = false;
  sessionState.done = 0;
  sessionState.correct = 0;
  syncSessionQueue();
  loadNextQuestion();
  scrollToPractice();
}

function openQuestionById(id) {
  const question = allQuestions.find((item) => item.id === id);
  if (!question) return;

  subjectFilter.value = question.subject;
  levelFilter.value = "all";
  syncQuickSwitch(question.subject);
  renderChapterFilterOptions();
  chapterFilter.value = question.chapterId;
  sessionState.mode = "review";
  sessionState.onlyWrong = false;
  syncSessionQueue();
  queueCount.textContent = `当前题库 ${getQuestionQueue(false).length} 题`;
  renderQuestion(question);
  scrollToPractice();
}

function syncSessionQueue() {
  const queue = getQuestionQueue(sessionState.onlyWrong);
  sessionState.total = queue.length;
  updateSessionPanel();
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
  sessionState.total = queue.length;
  sessionState.onlyWrong = onlyWrong;
  updateSessionPanel();
  feedback.classList.add("hidden");
  feedback.innerHTML = "";
  answerLocked = false;

  if (!queue.length) {
    currentQuestion = null;
    questionBadge.textContent = onlyWrong ? "错题本为空" : "当前筛选无题";
    questionText.textContent = onlyWrong
      ? "你的错题本现在是空的，继续刷新题更划算。"
      : "当前筛选条件下没有题，换个科目或难度继续。";
    chapterHint.textContent = onlyWrong ? "错题暂时清空，可以回到混刷模式。" : "切换筛选后再开一轮。";
    options.innerHTML = "";
    return;
  }

  if (pinnedQuestionId) {
    const pinnedQuestion = queue.find((item) => item.id === pinnedQuestionId);
    pinnedQuestionId = "";
    if (pinnedQuestion) {
      renderQuestion(pinnedQuestion);
      return;
    }
  }

  renderQuestion(queue[Math.floor(Math.random() * queue.length)]);
}

function renderQuestion(question) {
  currentQuestion = question;
  questionBadge.textContent = `${getLabel(currentQuestion)} · ${currentQuestion.chapterName}`;
  questionText.innerHTML = currentQuestion.prompt;
  chapterHint.textContent = `${currentQuestion.linkName} · ${currentQuestion.answerType} · ${currentQuestion.source || "章节题"}`;
  animateQuestionStage();

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
    sessionState.done += 1;
    if (correct) {
      state.correct += 1;
      sessionState.correct += 1;
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
  updateSessionPanel();

  if (!forcedReveal && state.autoNext) {
    window.setTimeout(() => loadNextQuestion(sessionState.onlyWrong), 900);
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
    ? renderReviewButtons(state.wrongBook, "wrong-chip")
    : "还没有错题，继续保持。";

  masteredList.innerHTML = state.mastered.length
    ? renderReviewButtons(state.mastered, "master-chip")
    : "还没有掌握题，先开始第一轮。";

  bindReviewActions();
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

function stripHtml(text) {
  return String(text).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function updateSessionPanel() {
  if (!sessionModeText) return;
  const modeMap = {
    mixed: "双科混刷",
    wrong: "错题肃清",
    sprint: "冲刺模式",
    chapter: "章节定点",
    review: "回看复盘",
    politics: "主攻政治",
    english: "主攻英语",
  };
  const progress = sessionState.total ? Math.min(100, Math.round((sessionState.done / sessionState.total) * 100)) : 0;
  const accuracy = sessionState.done ? Math.round((sessionState.correct / sessionState.done) * 100) : 0;
  sessionModeText.textContent = modeMap[sessionState.mode] || "双科混刷";
  sessionProgressText.textContent = `${sessionState.done} / ${sessionState.total}`;
  sessionAccuracyText.textContent = `${accuracy}%`;
  if (sessionProgressBar) sessionProgressBar.style.width = `${progress}%`;
}

function animateQuestionStage() {
  if (!questionStage) return;
  questionStage.classList.remove("is-entering");
  window.requestAnimationFrame(() => {
    questionStage.classList.add("is-entering");
  });
}

function renderReviewButtons(ids, className) {
  return ids
    .map((id) => allQuestions.find((item) => item.id === id))
    .filter(Boolean)
    .slice(0, 20)
    .map(
      (item) => `
        <button class="${className} review-action" type="button" data-question-id="${item.id}">
          ${item.subjectLabel} · ${item.chapterName} · ${stripHtml(item.prompt)}
        </button>
      `
    )
    .join("");
}

function bindReviewActions() {
  document.querySelectorAll(".review-action").forEach((button) => {
    button.addEventListener("click", () => {
      openQuestionById(button.dataset.questionId);
    });
  });
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
