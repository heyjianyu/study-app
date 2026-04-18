import fs from "fs";
import path from "path";

const root = "/home/jianyucui/专升本/app";
const rawDir = path.join(root, "data", "raw");
const outFile = path.join(root, "data", "study-data.json");

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(rawDir, name), "utf8"));

const chapterSummaries = {
  politics: readJson("politics_chapter.json"),
  english: readJson("english_chapter.json"),
};

const mockLists = {
  politics: readJson("politics_mock_list.json"),
  english: readJson("english_mock_list.json"),
};

const subjectMeta = {
  politics: {
    key: "politics",
    label: "政治",
    courseId: "H011901",
    courseName: "成考专升本政治",
    validUntil: "2026-11-11",
    reminders: [
      "政治章节题已经完整抓取，可直接按章节刷题。",
      "重点优先：哲学原理、毛中特、习近平新时代中国特色社会主义思想概论。",
      "模拟考试列表已接入，适合阶段性整卷冲刺。",
    ],
  },
  english: {
    key: "english",
    label: "英语",
    courseId: "H012001",
    courseName: "成考专升本英语",
    validUntil: "2026-11-11",
    reminders: [
      "英语章节题已经完整抓取，可按语法、语音、词汇、综合知识刷题。",
      "语法与词汇是基础分大头，建议先刷再看视频。",
      "模拟考试列表已接入，适合后期限时训练。",
    ],
  },
};

function normalizeQuestion(question, subject, chapter) {
  const optionKeys = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const options = optionKeys
    .map((key, index) => ({
      key: String.fromCharCode(65 + index),
      text: question[key],
    }))
    .filter((item) => item.text);

  return {
    id: `${subject.key}-${question.exerID}`,
    exerId: question.exerID,
    subject: subject.key,
    subjectLabel: subject.label,
    chapterId: String(chapter.catId),
    chapterName: chapter.name,
    linkName: chapter.linkName,
    prompt: question.title,
    options,
    answer: question.rightKeyList || (question.rightKey ? question.rightKey.split("") : []),
    answerText: question.rightKey || "",
    answerType: question.answerType || question.keyType || "",
    explanation: question.analyze || "",
    accuracy: question.accuracyAmount || 0,
    practiceCount: question.pracTimesAmount || 0,
    source: question.source || question.exerType || "",
  };
}

function buildSubject(subjectKey) {
  const subject = subjectMeta[subjectKey];
  const summary = chapterSummaries[subjectKey].data;
  const parts = summary.practiceChapter || [];
  const chapterIndex = readJson(`${subjectKey}_chapter_index.json`);
  const chapterCountMap = new Map(chapterIndex.map((item) => [String(item.catId), item.count]));
  const questions = [];

  const modules = parts.map((part) => ({
    id: String(part.catId || part.id),
    name: part.name,
    exerNum: part.exerNum,
    children: (part.children || []).map((chapter) => {
      const chapterFile = `${subjectKey}_chapter_${chapter.catId}.json`;
      const chapterData = readJson(chapterFile).data;
      const chapterQuestions = (chapterData.exerList || []).map((question) =>
        normalizeQuestion(question, subject, chapter)
      );
      questions.push(...chapterQuestions);

      return {
        id: String(chapter.catId),
        name: chapter.name,
        linkName: chapter.linkName,
        exerNum: chapter.exerNum,
        count: chapterCountMap.get(String(chapter.catId)) || chapterQuestions.length,
      };
    }),
  }));

  const mockData = mockLists[subjectKey].data;
  const mocks = (mockData.simExams || []).map((exam) => ({
    simId: exam.simID,
    title: exam.examName,
    type: exam.simType,
    totalScore: exam.totalScore,
    exerNum: exam.exerNum,
    specialProjectId: exam.specialProjectId,
    lastPosition: exam.lastPosition,
    simRecordType: exam.simRecordType,
  }));

  return {
    ...subject,
    totalQuestions: summary.exerNum,
    moduleCount: modules.length,
    modules,
    mocks,
    questions,
  };
}

const politics = buildSubject("politics");
const english = buildSubject("english");

const payload = {
  generatedAt: new Date().toISOString(),
  totals: {
    questions: politics.questions.length + english.questions.length,
    politicsQuestions: politics.questions.length,
    englishQuestions: english.questions.length,
    politicsMocks: politics.mocks.length,
    englishMocks: english.mocks.length,
  },
  subjects: {
    politics,
    english,
  },
};

fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
console.log(`Wrote ${outFile}`);
