# 电工题库训练平台

一个基于 **Vue 3 + TypeScript + Pinia + Vue Router + IndexedDB（Dexie）** 的配置驱动题库平台。支持判断题、单选题、多选题，以及题干图片、选项图片和解析图片。

## 已实现功能

- **题库导入**
  - 内置题库清单
  - 本地文件夹导入（Chrome / Edge 的 File System Access API）
  - ZIP 题包导入
  - 单个 JSON 题库导入
  - 导入后持久化到 IndexedDB，刷新页面仍可使用
- **答题模式**
  - 背题模式：直接选中并显示正确答案、答案解析
  - 练习模式：单选/判断即时判定；多选提交后判定
  - 答错后标出用户错误选项、正确答案和解析
  - 题号导航、正确/错误/未答统计、重新作答
- **记录模式**
  - 可在设置或答题页开启
  - 记录当前题目到 IndexedDB
  - 记录页支持全选、批量移除、批量导出
- **导出中心**
  - 当前全部题目
  - 错误题目
  - 正确题目
  - 未选择题目
  - 每类均支持“有状态 / 无状态”
  - JSON 导出或包含图片资源的 ZIP 题包导出

## 启动

```bash
npm install
npm run dev
```

构建与检查：

```bash
npm run check
npm run build
```

## 题包目录结构

```text
my-question-library/
├─ manifest.json
├─ banks/
│  ├─ electrician-basic.json
│  └─ electrician-image.json
└─ assets/
   ├─ questions/
   │  └─ q001.png
   └─ options/
      ├─ q002-a.png
      └─ q002-b.png
```

`manifest.json` 决定当前文件夹有哪些配套题库，使用者导入文件夹后可自行选择其中任意题库。

## 图片路径规则

题库 JSON 位于 `banks/electrician-basic.json`，并设置：

```json
{
  "assetsBase": "../assets"
}
```

图片内容块中写：

```json
{
  "type": "image",
  "src": "questions/q001.png",
  "alt": "接线图"
}
```

最终解析路径为：`banks/../assets/questions/q001.png`。

## 为什么采用内容块

旧网页把题干 HTML、选项分隔符和图片标记全部塞进字符串，维护和校验困难。本项目把文字、图片、提示分别建模：

```json
[
  { "type": "text", "text": "观察下图：" },
  { "type": "image", "src": "questions/q001.png", "alt": "题目图" },
  { "type": "note", "title": "提示", "text": "注意元件符号。" }
]
```

这样可以避免 `v-html`，降低 XSS 风险，也便于后续扩展音频、公式、视频等内容类型。

## 数据结构与性能

- 题目顺序使用数组：适合顺序答题和题号导航。
- 答题进度按复合键 `libraryId::bankId::questionId` 存储：定位单题状态为 O(1)。
- 页面状态用对象索引，记录集合使用 `Set` 判断是否已收藏：避免每次线性查找。
- 正确/错误/未答筛选只在导出时执行一次 O(n) 遍历。
- IndexedDB 写入使用 `bulkPut` / `bulkDelete`：适合批量题包和批量移除。
- 图片 Object URL 使用缓存，并按题库释放，避免重复创建与内存泄漏。

## 示例题库说明

- `low-voltage-judgement.json`：从用户提供的旧网页数据迁移的 100 道判断题。
- `media-demo.json`：手工提供的单选、多选、判断与图片选项示例。
- 原 HTML 中有一张图片只留下服务器路径，未包含图片文件，因此示例题包使用本地 SVG 示意图代替。

更完整的配置说明见：`public/question-banks/README.md`。

## 旧网页数据迁移工具

项目附带 `tools/migrate_legacy_html.py`，可以把旧页面中的 `var data = {...}` 转成新版题库 JSON：

```bash
python tools/migrate_legacy_html.py old-page.html banks/output.json \
  --bank-id electrician-old \
  --bank-name "旧网页迁移题库" \
  --assets-base "../assets"
```

脚本会把旧 HTML 图片和 `img:...;img` 选项标记转换为结构化图片块，但不会自动下载服务器图片。
