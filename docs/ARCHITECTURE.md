# 架构说明

## 分层

```text
View / Component
      ↓
Pinia Store（会话、题库、记录、偏好）
      ↓
Service（导入、校验、资源解析、导出）
      ↓
Repository（Dexie / IndexedDB）
```

### View / Component

- 只负责展示与用户事件。
- `QuestionCard` 不直接访问数据库，通过事件调用会话 Store。
- `ContentRenderer` 统一渲染题干、选项和解析，避免三个位置重复图片逻辑。

### Store

- `libraryStore`：管理题库集合和配套题库选择。
- `sessionStore`：管理当前题库、题号、模式、草稿选项和答题状态。
- `recordStore`：管理专项记录题目，提供 O(1) 的记录状态判断。
- `preferencesStore`：管理记录模式、默认学习模式和自动下一题。

### Service

- `schema.ts`：Zod 配置校验。
- `libraryLoader.ts`：文件夹、ZIP、JSON、内置题库和 IndexedDB 题库的统一加载。
- `assetRegistry.ts`：图片路径解析和 Object URL 缓存。
- `exporter.ts`：按状态筛选、状态注入、图片收集与 ZIP 打包。

## 数据结构选择

| 场景 | 数据结构 | 复杂度 / 理由 |
|---|---|---|
| 题目顺序 | `Question[]` | 顺序访问 O(1)，适合上一题/下一题 |
| 答题状态 | `Record<key, Progress>` | 单题状态读取平均 O(1) |
| 是否已记录 | `Set<string>` | 记录按钮判断平均 O(1) |
| 题库文件定位 | `Map<path, Blob>` | 文件夹/ZIP 内文件定位平均 O(1) |
| 图片 URL 缓存 | `Map<assetKey, objectUrl>` | 避免重复创建 Blob URL |
| 导出筛选 | 单次数组遍历 | O(n)，只在用户导出时执行 |
| 批量存储 | Dexie `bulkPut/bulkDelete` | 减少 IndexedDB 事务数量 |

## 状态模型

- `unanswered`：未提交。多选题可保存部分已选选项，便于恢复现场。
- `correct`：提交后答案集合与正确答案集合完全一致。
- `incorrect`：提交后存在缺选、多选或错选。

多选答案比较先去重、排序，再逐项比较，因此配置中的答案顺序不会影响结果。

## 图片生命周期

1. 题库 JSON 保存相对路径，不保存 Object URL。
2. 文件夹或 ZIP 导入时，图片 Blob 持久化到 IndexedDB。
3. 渲染时按 `libraryId + configPath + assetsBase + src` 解析。
4. 首次使用创建 Object URL，后续从 Map 复用。
5. 删除题包时释放该题包所有 Object URL。
6. 导出 ZIP 时只收集当前导出题目实际引用的图片，避免把无关资源全部打包。

## 扩展点

- 新增题型：扩展 `QuestionType`、Zod Schema 和 `QuestionCard` 交互策略。
- 新增内容块：扩展 `ContentBlock` 与 `ContentRenderer`，例如公式、音频、视频。
- 云同步：新增 Repository 实现，不需要改动题目组件。
- 随机练习：在 Store 中生成题目 ID 顺序，不复制完整题目对象。
- 错题频率排序：为 progress 增加错误次数索引即可。
