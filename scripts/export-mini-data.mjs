import fs from "fs";
import path from "path";

const appRoot = "/home/jianyucui/专升本/app";
const miniRoot = "/home/jianyucui/专升本/mini-app";
const source = path.join(appRoot, "data", "study-data.json");
const target = path.join(miniRoot, "static", "study-data.json");
const rawDir = path.join(appRoot, "data", "raw");

const data = JSON.parse(fs.readFileSync(source, "utf8"));

function readMockInfo(subjectKey, specialProjectId) {
  const full = path.join(rawDir, `${subjectKey}_mock_${specialProjectId}.json`);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

const slim = {
  generatedAt: data.generatedAt,
  totals: data.totals,
  subjects: Object.fromEntries(
    Object.entries(data.subjects).map(([key, subject]) => [
      key,
      {
        key: subject.key,
        label: subject.label,
        courseName: subject.courseName,
        validUntil: subject.validUntil,
        totalQuestions: subject.totalQuestions,
        moduleCount: subject.moduleCount,
        modules: subject.modules,
        mocks: subject.mocks.map((mock) => {
          const mockInfo = readMockInfo(key, mock.specialProjectId)?.data;
          return {
            ...mock,
            examTime: mockInfo?.simExamStore?.examTime || null,
            simCounts: mockInfo?.simCounts || []
          };
        }),
        questions: subject.questions
      }
    ])
  )
};

fs.writeFileSync(target, JSON.stringify(slim, null, 2));
console.log(`Exported ${target}`);
