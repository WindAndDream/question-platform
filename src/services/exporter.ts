import JSZip from "jszip";
import { appDb } from "@/db/appDb";
import { assetRegistry } from "@/services/assetRegistry";
import type {
  LoadedBank,
  Question,
  QuestionBank,
  QuestionLibraryManifest,
  QuestionProgress,
  RecordedQuestion,
} from "@/types/question";
import { collectQuestionImageSources } from "@/utils/content";
import { normalizePath } from "@/utils/path";
import { toRaw } from "vue";

export interface ExportOptions {
  includeState: boolean;
  fileBaseName: string;
}

const safeName = (value: string): string =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "question-bank";

const triggerDownload = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
const cloneQuestion = (question: Question): Question => {
  return structuredClone(toRaw(question));
};
const attachState = (
  question: Question,
  progress: QuestionProgress | undefined,
  includeState: boolean,
): Question => {
  const clone = cloneQuestion(question);
  delete clone.state;
  if (includeState) {
    clone.state = {
      selectedOptionIds: [...(progress?.selectedOptionIds ?? [])],
      status: progress?.status ?? "unanswered",
      ...(progress?.answeredAt ? { answeredAt: progress.answeredAt } : {}),
    };
  }
  return clone;
};

const rewriteContentImages = (
  question: Question,
  mapping: Map<string, string>,
): Question => {
  const clone = cloneQuestion(question);
  const rewrite = (
    content: Question["stem"] | Question["explanation"],
  ): typeof content => {
    if (!content || typeof content === "string") return content;
    return content.map((block) =>
      block.type === "image" && mapping.has(block.src)
        ? { ...block, src: mapping.get(block.src)! }
        : block,
    );
  };
  clone.stem = rewrite(clone.stem)!;
  if (clone.explanation) clone.explanation = rewrite(clone.explanation);
  clone.options = clone.options?.map((option) => ({
    ...option,
    content:
      typeof option.content === "string"
        ? option.content
        : option.content.map((block) =>
            block.type === "image" && mapping.has(block.src)
              ? { ...block, src: mapping.get(block.src)! }
              : block,
          ),
  }));
  return clone;
};

const extensionFromBlob = (blob: Blob): string => {
  const subtype = blob.type.split("/")[1]?.split("+")[0];
  if (!subtype) return "bin";
  if (subtype === "svg+xml") return "svg";
  if (subtype === "jpeg") return "jpg";
  return subtype;
};

const fetchQuestionAsset = async (
  bank: LoadedBank,
  src: string,
): Promise<Blob | undefined> => {
  const resolved = await assetRegistry.resolve(
    bank.libraryId,
    bank.configPath,
    bank.bank.assetsBase,
    src,
  );
  if (!resolved) return undefined;
  const response = await fetch(resolved);
  if (!response.ok) return undefined;
  return response.blob();
};

export const buildQuestionBank = (
  bank: LoadedBank,
  questions: Question[],
  progressByQuestion: Record<string, QuestionProgress>,
  includeState: boolean,
): QuestionBank => ({
  schemaVersion: 1,
  id: `${bank.bank.id}-export`,
  name: `${bank.bank.name}（导出）`,
  description: `由“${bank.bank.name}”筛选导出，共 ${questions.length} 题`,
  version: new Date().toISOString().slice(0, 10),
  category: bank.bank.category,
  assetsBase: "../assets",
  questions: questions.map((question) => {
    const key = `${bank.libraryId}::${bank.bank.id}::${question.id}`;
    return attachState(question, progressByQuestion[key], includeState);
  }),
});

export const downloadBankJson = (
  bank: LoadedBank,
  questions: Question[],
  progressByQuestion: Record<string, QuestionProgress>,
  options: ExportOptions,
): void => {
  const output = buildQuestionBank(
    bank,
    questions,
    progressByQuestion,
    options.includeState,
  );
  const blob = new Blob([JSON.stringify(output, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  triggerDownload(blob, `${safeName(options.fileBaseName)}.json`);
};

export const downloadBankZip = async (
  bank: LoadedBank,
  questions: Question[],
  progressByQuestion: Record<string, QuestionProgress>,
  options: ExportOptions,
): Promise<void> => {
  const zip = new JSZip();
  const bankFileName = `${safeName(bank.bank.id)}.json`;
  const imageSources = [
    ...new Set(questions.flatMap(collectQuestionImageSources)),
  ];
  const mapping = new Map<string, string>();

  for (let index = 0; index < imageSources.length; index += 1) {
    const source = imageSources[index]!;
    const blob = await fetchQuestionAsset(bank, source);
    if (!blob) continue;
    const sourceBase =
      normalizePath(source)
        .split("/")
        .at(-1)
        ?.replace(/[^\w.-]+/g, "-") || `asset-${index}`;
    const hasExtension = sourceBase.includes(".");
    const fileName = hasExtension
      ? sourceBase
      : `${sourceBase}.${extensionFromBlob(blob)}`;
    const target = `assets/${String(index + 1).padStart(3, "0")}-${fileName}`;
    mapping.set(source, target.replace(/^assets\//, ""));
    zip.file(target, blob);
  }

  const output = buildQuestionBank(
    bank,
    questions,
    progressByQuestion,
    options.includeState,
  );
  output.questions = output.questions.map((question) =>
    rewriteContentImages(question, mapping),
  );

  const manifest: QuestionLibraryManifest = {
    schemaVersion: 1,
    libraryId: `${bank.libraryId}-export-${Date.now()}`,
    name: output.name,
    description: output.description,
    banks: [
      { id: output.id, name: output.name, file: `banks/${bankFileName}` },
    ],
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file(`banks/${bankFileName}`, JSON.stringify(output, null, 2));
  zip.file(
    "README.txt",
    "这是可直接导入“电工题库训练平台”的题包。manifest.json 为题库清单，banks/ 为题目配置，assets/ 为图片资源。",
  );
  triggerDownload(
    await zip.generateAsync({ type: "blob" }),
    `${safeName(options.fileBaseName)}.zip`,
  );
};

export const downloadRecordedZip = async (
  records: RecordedQuestion[],
  includeState: boolean,
  fileBaseName = "已记录题目",
): Promise<void> => {
  if (records.length === 0) throw new Error("没有可导出的记录题目");

  const zip = new JSZip();
  const outputQuestions: Question[] = [];
  let assetIndex = 0;

  for (const record of records) {
    const question = attachState(
      record.question,
      record.progress,
      includeState,
    );
    question.id = `${record.bankId}--${record.questionId}`;
    question.source = question.source
      ? `${question.source}；原题库：${record.bankName}`
      : `原题库：${record.bankName}`;

    const localMapping = new Map<string, string>();
    for (const source of collectQuestionImageSources(question)) {
      const resolved = await assetRegistry.resolve(
        record.libraryId,
        record.configPath,
        record.assetsBase,
        source,
      );
      if (!resolved) continue;
      const response = await fetch(resolved);
      if (!response.ok) continue;
      const blob = await response.blob();
      const sourceBase =
        normalizePath(source)
          .split("/")
          .at(-1)
          ?.replace(/[^\w.-]+/g, "-") || `asset-${assetIndex}`;
      const hasExtension = sourceBase.includes(".");
      const fileName = hasExtension
        ? sourceBase
        : `${sourceBase}.${extensionFromBlob(blob)}`;
      const targetName = `${String(++assetIndex).padStart(3, "0")}-${fileName}`;
      zip.file(`assets/${targetName}`, blob);
      localMapping.set(source, targetName);
    }
    outputQuestions.push(rewriteContentImages(question, localMapping));
  }

  const output: QuestionBank = {
    schemaVersion: 1,
    id: `recorded-questions-${Date.now()}`,
    name: "已记录题目",
    description: `从记录库导出，共 ${records.length} 题`,
    version: new Date().toISOString().slice(0, 10),
    category: "专项复习",
    assetsBase: "../assets",
    questions: outputQuestions,
  };
  const bankFileName = "recorded-questions.json";
  const manifest: QuestionLibraryManifest = {
    schemaVersion: 1,
    libraryId: `recorded-library-${Date.now()}`,
    name: "已记录题目",
    description: "由题目记录库生成的专项复习题包",
    banks: [
      { id: output.id, name: output.name, file: `banks/${bankFileName}` },
    ],
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file(`banks/${bankFileName}`, JSON.stringify(output, null, 2));
  zip.file("README.txt", "该 ZIP 可直接重新导入电工题库训练平台。");
  triggerDownload(
    await zip.generateAsync({ type: "blob" }),
    `${safeName(fileBaseName)}.zip`,
  );
};

export const getQuestionsByStatus = (
  bank: LoadedBank,
  progressByQuestion: Record<string, QuestionProgress>,
  status: "correct" | "incorrect" | "unanswered" | "all",
): Question[] => {
  if (status === "all") return bank.bank.questions;
  return bank.bank.questions.filter((question) => {
    const key = `${bank.libraryId}::${bank.bank.id}::${question.id}`;
    const progress = progressByQuestion[key];
    if (status === "unanswered")
      return !progress || progress.selectedOptionIds.length === 0;
    return progress?.status === status;
  });
};

export const removeLibraryProgress = async (
  libraryId: string,
  bankId: string,
): Promise<void> => {
  await appDb.progress
    .where("[libraryId+bankId]")
    .equals([libraryId, bankId])
    .delete();
};
