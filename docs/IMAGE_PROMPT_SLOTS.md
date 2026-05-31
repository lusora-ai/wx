# Article Image Prompt Slot System

本模块只管理文章配图位置与提示词，不接入图片生成 API，不保存图片地址或本地文件。

## 数据模型

`ArticleImageSlot` 绑定到 `Article`：

- `slotKey`：如 `img_1`
- `paragraphIndex`：建议插入的段落序号
- `marker`：正文标记，如 `{{IMAGE_SLOT:img_1}}`
- `reason`：推荐原因
- `promptZh` / `promptEn`：中文/英文提示词
- `negativePrompt`：负面提示词
- `aspectRatio`：`16:9`、`4:3`、`1:1`
- `stylePreset`：默认 `公众号科技资讯插图`
- `altText`：替代文案
- `status`：`prompt_ready` 或 `skipped`

## 生成规则

Phase 11 后，文章正文生成不再同时判断图片位。DeepSeek v4 Pro 先生成并保存最终 Markdown，Kimi 2.6 再阅读文章生成 `visualPlan` / 段落配图方案。旧 `ArticleImageSlot` 仅用于兼容历史发布包和旧 marker。

提示词要求：

- 主体画面、场景、构图、风格、色彩、画面禁忌完整。
- 高级、干净、苹果系、克制，适合公众号科技资讯插图。
- 不要文字、水印、logo、真实人物肖像、政治人物、名人脸、侵权角色、复杂小字。

## 前端交互

AI 写作工坊支持预览和 Markdown 原文两种模式：

- 预览模式会把 `{{IMAGE_SLOT:img_1}}` 渲染为图片位占位卡片。
- Markdown 原文模式保留原始 marker，方便编辑。
- 右侧“配图提示词”面板支持复制中文/英文/负面提示词、编辑保存、重新生成提示词、跳过图片位。
- 复制成功或失败会在卡片内显示明确提示；文本区域仍可手动选中复制。

## HTML 导出

导出 HTML 时：

- `prompt_ready` 图片位输出“此处建议配图”提示块。
- `skipped` 图片位不输出提示块。
- 不输出 `img` 标签，不输出任何图片地址。
