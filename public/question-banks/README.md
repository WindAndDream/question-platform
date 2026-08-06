# 题库配置说明

## 1. manifest.json

```json
{
  "schemaVersion": 1,
  "libraryId": "electrician-2026",
  "name": "2026 低压电工题库",
  "description": "可选说明",
  "banks": [
    {
      "id": "low-voltage-basic",
      "name": "基础知识",
      "file": "banks/basic.json",
      "description": "判断、单选和多选混合"
    }
  ]
}
```

约束：

- `libraryId` 用于区分不同题包，建议长期保持稳定。
- `banks[].id` 必须与对应题库 JSON 内的 `id` 一致。
- `file` 使用相对于 `manifest.json` 的路径。

## 2. 题库 JSON

```json
{
  "schemaVersion": 1,
  "id": "low-voltage-basic",
  "name": "基础知识",
  "description": "题库说明",
  "version": "2026.08",
  "category": "低压电工作业",
  "assetsBase": "../assets",
  "questions": []
}
```

## 3. 内容块

题干 `stem`、选项 `content`、解析 `explanation` 可以直接写字符串，也可以使用内容块数组。

### 文字

```json
{ "type": "text", "text": "题目文字" }
```

### 图片

```json
{
  "type": "image",
  "src": "questions/q001.png",
  "alt": "必须提供的替代文本",
  "caption": "可选图注",
  "maxWidth": "520px"
}
```

### 提示块

```json
{
  "type": "note",
  "title": "记忆提示",
  "text": "FU 表示熔断器。"
}
```

## 4. 判断题

```json
{
  "id": "judge-001",
  "type": "judgement",
  "stem": "电压表内阻越大越好。",
  "answer": ["true"],
  "explanation": "电压表并联测量，内阻越大对原电路影响越小。"
}
```

判断题可以不写 `options`，平台自动生成：

- `true`：对
- `false`：错

## 5. 单选题

```json
{
  "id": "single-001",
  "type": "single",
  "stem": "熔断器的文字符号是？",
  "options": [
    { "id": "A", "content": "QS" },
    { "id": "B", "content": "FU" },
    { "id": "C", "content": "KM" }
  ],
  "answer": ["B"],
  "explanation": "FU 表示熔断器。"
}
```

## 6. 多选题与图片选项

```json
{
  "id": "multiple-001",
  "type": "multiple",
  "stem": "选择正确的元件图形。",
  "options": [
    {
      "id": "A",
      "content": [
        { "type": "image", "src": "options/a.png", "alt": "选项 A" }
      ]
    },
    {
      "id": "B",
      "content": [
        { "type": "text", "text": "文字与图片组合" },
        { "type": "image", "src": "options/b.png", "alt": "选项 B" }
      ]
    }
  ],
  "answer": ["A", "B"],
  "explanation": "多选答案数组不要求排序，平台会按集合比较。"
}
```

## 7. 可选导出状态

有状态题库会在题目中增加：

```json
{
  "state": {
    "selectedOptionIds": ["A", "C"],
    "status": "incorrect",
    "answeredAt": "2026-08-06T08:00:00.000Z"
  }
}
```

`state` 不影响正确答案，只用于迁移或备份答题现场。
