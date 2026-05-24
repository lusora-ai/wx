/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceFeed, TopicArticle, AiDraft, SystemLog, ModelSetting, AppConfig } from '../types';

export const initialSources: SourceFeed[] = [
  {
    id: 'src-1',
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
    type: 'RSS',
    status: 'active',
    lastChecked: '2026-05-24 11:30',
    articleCount: 42,
    category: '官方博客'
  },
  {
    id: 'src-2',
    name: 'TechCrunch Google Section',
    url: 'https://techcrunch.com/category/google/feed/',
    type: 'RSS',
    status: 'active',
    lastChecked: '2026-05-24 11:15',
    articleCount: 128,
    category: '海外科技媒体'
  },
  {
    id: 'src-3',
    name: 'Anthropic News',
    url: 'https://anthropic.com/news',
    type: 'WEBSITE',
    status: 'active',
    lastChecked: '2026-05-24 10:45',
    articleCount: 19,
    category: '官方博客'
  },
  {
    id: 'src-4',
    name: 'Hacker News (Show Show)',
    url: 'https://news.ycombinator.com/show',
    type: 'WEBSITE',
    status: 'active',
    lastChecked: '2026-05-24 11:00',
    articleCount: 95,
    category: '开发者社区'
  },
  {
    id: 'src-5',
    name: 'VentureBeat AI Feed',
    url: 'https://venturebeat.com/category/ai/feed/',
    type: 'RSS',
    status: 'error',
    lastChecked: '2026-05-23 18:22',
    articleCount: 64,
    category: '海外科技媒体'
  }
];

export const initialTopics: TopicArticle[] = [
  {
    id: 'topic-1',
    originalTitle: 'Google Gemini 2.5 Flash Unveils Hyper-fast Reasoning Over Giant Context Window',
    originalUrl: 'https://blog.google/technology/ai/gemini-2.5-flash-announcement/',
    sourceId: 'src-2',
    sourceName: 'TechCrunch',
    pullTime: '2026-05-24 10:42',
    translatedTitle: '谷歌发布 Gemini 2.5 Flash：在超长上下文窗口下实现极速推理',
    summary: '谷歌最新更新的轻量级大模型 Gemini 2.5 Flash 在逻辑推理计算上实现了重大突破，能够在毫秒级内检索并处理高达 200 万 token 的超长数据。这一技术革新将大幅降低企业搭建多模态搜索、超长代码审查和音视频内容提取的成本。',
    rawContent: 'Google has officially upgraded its lightweight efficient model series. Gemini 2.5 Flash delivers unprecedented ultra-low latency logic evaluation and context processing up to 2 million tokens. The specialized routing mechanisms in its visual and text parsing layers have made high-speed processing incredibly cheap, pricing it at $0.05 per million tokens. Developers are seeing up to a 5x speed increase in processing massive documents and multi-hour long raw video inputs.',
    englishOutline: [
      'Introduction of Gemini 2.5 Flash and key speed benchmarks.',
      'Analysis of the upgraded 2M context window capabilities.',
      'Pricing strategy and structural optimizations for developers.',
      'Practical demo use cases: Instant video analysis and code repository parsing.'
    ],
    chineseOutline: [
      'Gemini 2.5 Flash 极速推理模型诞生背景及跑分数据。',
      '200 万超长上下文处理能力的深度拆解（无损长文本检索）。',
      '开发者资费调整：每百万 Token 运费暴跌，极致性价比。',
      '落地实战案例：数小时超长会议视频一键提取摘要、一键吃透整套源码。'
    ],
    category: '模型发布',
    readingTime: '4 min',
    status: 'pushed',
    hotScore: 94
  },
  {
    id: 'topic-2',
    originalTitle: 'Anthropic releases Claude 4.5 Opus with Seamless Native Code interpreter and Agent Sandbox',
    originalUrl: 'https://www.anthropic.com/claude/opus-next-gen',
    sourceId: 'src-3',
    sourceName: 'Anthropic News',
    pullTime: '2026-05-24 09:15',
    translatedTitle: 'Anthropic 推出 Claude 4.5 Opus：原生内置代码解释器以及免配置智能体沙盒',
    summary: 'Anthropic 宣布上线其最强旗舰模型 Claude 4.5 Opus。新版本最大的亮点是首次加入原生底层沙盒，支持模型自主执行 Python 代码、读取文件并进行高级统计分析，直接对标高级数据科学家。',
    rawContent: 'Anthropic unveiled Claude 4.5 Opus. It introduces fully stateful container environments directly attached to the model container. Users can stream massive files, CSV tables, and raw database exports directly into the prompt frame. Claude 4.5 runs dynamic data visualization calculations, handles raw mathematical formulas, and debugs its own code on the fly in the Agent Sandbox, establishing new state-of-the-art results on complex technical QA.',
    englishOutline: [
      'Launch event and performance metrics of Claude 4.5 Opus.',
      'The execution layer: How the native code interpreter and sandbox work.',
      'Privacy-first sandbox guarantees and data isolation models.',
      'Comparison with competitive code-interpreting environments.'
    ],
    chineseOutline: [
      'Claude 4.5 Opus 正式登场，推理大盘与评测基准傲视群雄。',
      '原生安全沙盒机制讲解：模型在微型容器里自写代码、自主调试。',
      '隐私隔离防漏原则：所有执行数据随会话即用即毁，企业友好。',
      '竞品性能横跨对比：全面碾压市面上现有的数据分析助手。'
    ],
    category: '技术创新',
    readingTime: '6 min',
    status: 'pending',
    hotScore: 89
  },
  {
    id: 'topic-3',
    originalTitle: 'Y Combinator S26 Applications Show Unprecedented Shift: 85% of Startups Are Agentic Orchestrators',
    originalUrl: 'https://news.ycombinator.com/show/yc-s26-trends',
    sourceId: 'src-4',
    sourceName: 'Hacker News',
    pullTime: '2026-05-24 08:02',
    translatedTitle: 'YC 最新季度申请趋势披露：高达 85% 的初创公司专注于 AI 智能体协同编排',
    summary: '硅谷顶级孵化器 Y Combinator 的最新报名数据显示，生成式 AI 的应用层创业已经完全转向了智能体协同（Agentic Orchestration）。开发者不再单单调用底层 API 制作简单的聊天框，而是直接将 AI 嵌入到供应链、客服中台以及自动化金融对账工作流中。',
    rawContent: 'Data leaked from early screening of Y Combinator Summer 2026 batches reveals that the generative wrapping era is officially over. A total of 85 percent of all applied product companies are building multi-agentic system architecture. Pitch decks focus deeply on system uptime, error recovery mechanisms, and human-in-the-loop validation rather than raw LLM generation quality metrics.',
    englishOutline: [
      'Statistical review of YC Summer 26 applications overview.',
      'From wrapper apps to deep Agentic architectures.',
      'Sectors impacted: Supply chain, fintech, back-office operations.',
      'Insights for independent developers and early-stage startup founders.'
    ],
    chineseOutline: [
      'YC 最新批次审核统计数据透视：套壳 AI 产品彻底出局。',
      'AI 智能体编排（Agentic Orchestration）为何成为香饽饽？',
      '被 AI 重塑的三大产业：跨国供应链、全天候客诉中台、无缝财务自动化对账。',
      '给独立开发者与早期创业者的避坑指南：把人放在反馈闭环中依然是核心。'
    ],
    category: '产业趋势',
    readingTime: '3 min',
    status: 'pending',
    hotScore: 82
  },
  {
    id: 'topic-4',
    originalTitle: 'OpenAI Introduces "Operator" Pro: Enterprise Multi-Agent platform for Autonomous Web Actions',
    originalUrl: 'https://openai.com/blog/operator-pro-enterprise/',
    sourceId: 'src-1',
    sourceName: 'OpenAI Blog',
    pullTime: '2026-05-23 15:10',
    translatedTitle: 'OpenAI 隆重推出 "Operator" 专业版：企业级全自主网页探查与批量办公智能体',
    summary: 'OpenAI 旗下的端到端浏览器操作智能体 Operator 迎来重大企业级升级。通过全新的强化学习框架，Operator Pro 现在可以在零人工干预的情况下完成复杂的网络预订、数据收集、后台对账等连贯性动作。',
    rawContent: 'OpenAI launched Operator Pro for business clients. It operates custom headless browser instances locally or in cloud structures. Operators can orchestrate a massive array of concurrent worker agents doing high-accuracy UI interactions like booking complicated corporate travels, cross-checking logistics databases, and updating Salesforce logs with zero human intervention required. Powered by a specialized visual-action reinforcement model.',
    englishOutline: [
      'Anatomy of OpenAI Operator Pro capabilities.',
      'Reinforcement learning applied to visual coordinates.',
      'Security protocols: Session recordings, credential isolation, and guardrails.',
      'Enterprise business cases and estimated productivity gains.'
    ],
    chineseOutline: [
      'OpenAI Operator Pro 核心技术架构与全功能演示。',
      '视觉坐标强化学习：如何让智能体像人类一样“看明”并操作网页。',
      '万无一失的安全机制：全程会话录制、密码零接触以及违规动作紧急熔断。',
      '企业出海实操：零人工干预完成多国差旅预订、跨平台物料检索。'
    ],
    category: '产品动态',
    readingTime: '5 min',
    status: 'pending',
    hotScore: 91
  }
];

export const initialDrafts: AiDraft[] = [
  {
    id: 'draft-1',
    topicId: 'topic-1',
    originalTitle: 'Google Gemini 2.5 Flash Unveils Hyper-fast Reasoning Over Giant Context Window',
    translatedTitle: '谷歌发布 Gemini 2.5 Flash：在超长上下文窗口下实现极速推理',
    category: '模型发布',
    selectedAudience: 'officeWorker',
    status: 'pending_review',
    reviewScore: 4,
    reviewerFeedback: '打工人版本的场景切入非常痛，但代码相关的实战部分可以再压缩一下，微信文章读者更喜欢速成干货。',
    createdAt: '2026-05-24 10:50',
    lastEdited: '2026-05-24 11:32',
    tokenCost: 15420,
    versions: {
      officeWorker: {
        title: '终于来了！谷歌Gemini 2.5闪电发布！打工人从此不加班：5万字会议文档，1秒输出干货细节',
        excerpt: '不想天天加班读那些又臭又长的行业报告？谷歌这把直接祭出了“作弊神枪”。Gemini 2.5 Flash 性能炸裂，无损读完 200 万字，一顿饭的钱能处理上千份文件。本文教你如何一键配置成你的“专属私人秘书”！',
        content: `### 🚀 职场效率原子弹：谷歌 Gemini 2.5 Flash 正式解密！

各位打工人，摸鱼的福报真的要来了。

你是不是每天一睁眼，就要面对这些噩梦般的垃圾任务：
*   **「读」** 老板顺手转发的 **5万字** 英文行业调研报告，两小时后要开会汇报。
*   **「理」** **3个小时** 没调视的速度极其缓慢的项目进度录音，里面还夹杂着十几种英文塑料口音。
*   **「审」** 几千行没有任何注释的“屎山代码”，出了Bug还要你全盘背锅。

以往遇到这些，除了加班别无他法。但是今天，谷歌发布了全新的 **Gemini 2.5 Flash**，号称是AI圈里的“轻量钢炮”。它不仅**极速超群**，而且拥有高达 **200万 Token** 的逆天长文本理解力（相当于无损阅读 **4本长篇小说**）。

更绝的是它的价格——**每百万 Token 只要 $0.05 美分**。这意味着，以前让AI帮你做个长文本分析动辄好几块钱，现在只要“几分钱”就能做几十次！

---

### 💡 核心亮眼大招：它能帮你做什么？

#### 1. 2小时长视频、录音，塞进去 3秒出纪要
你再也不用一边拖进度条一边苦苦啃翻译了。直接把会议音视频往对话框里一怼。Gemini 2.5 Flash 可以在极短的延迟内，直接帮你画出重点、梳理出每个发言人的待办事项（Action Items），精度比手写记录高出5倍。

#### 2. 无损长代码审查：1秒读懂整套屎山代系统
程序员和产品经理经常遇到半路接盘。把整个代码仓的所有核心文件一键打包发给 Gemini。因为它有着 200M 吞吐，所以能够轻而易举地理清不同模块之间的调用依赖，直接告诉你 Bug 究竟藏在第几行。

#### 3. 完美结合多模态：图表、表格不再是摆设
不仅是字，复杂的公司年报、PDF图表、折线走势，Gemini 2.5 Flash 均能完美识别。它能一眼看出去年第三季度利润下滑的真正原因，直接帮你做成答辩 PPT 大纲！

---

### 💻 极速摸鱼实操：“三步定制”私人大秘书

别让先进的工具只躺在新闻稿里，现在就教你如何利用它的官方控制台配置：
1.  **准备投喂资料：** 收集本周老板给你的所有英文资料，打工日常手册等。
2.  **设定 Prompt（人设指令）：** 
    > *"你是一位身经百战的跨国投行首席分析师，请用最简练、无废话、直切要害的中文列表，帮我提炼以下材料中值得向总监层汇报的核心逻辑。"*
3.  **一件导出生成：** 将生成的文件，放入特定的微信草稿箱或 Notion 页面，配合小顺 AI 本平台直接排版，3分钟即刻输出精美的复盘报告。

**💡 顺子点评：**
Gemini 2.5 Flash 的推出，意味着AI不再是实验室的昂贵玩具，而是真正走进了全自动化和规模化的“廉价劳动力”时代。把它用起来，不仅下班能提早一小时，甚至老板还会夸你“近期自驱力极强，出报告神速，工作非常有思路”！
`,
        wordCount: 1150
      },
      student: {
        title: '大学生的AI作弊神器！谷歌Gemini 2.5免配置大解析：读200万字仅需5分钱，期末论文/英语文献轻松搞定！',
        excerpt: '英语专业课文献看不完？期末论文无从下手？谷歌刚刚发布的 Gemini 2.5 Flash 是最适合大学生的“白嫖大杀器”，不仅对多模态支持极好，还能极速分析超长学术视频。来看看如何快人一步用在你的学业上！',
        content: `### 🎓 学渣到学霸的极限弯道超车

各位同学，期末考试、毕业论文、英语文献双重夹击的痛苦，你们懂的。

现在有一款刚刚公布的 AI 新引擎——**Gemini 2.5 Flash**。简而言之，它是谷歌迄今为止性价比最高、速度最快的大模型，被称为学术摸鱼的新王。

---

### ⭐ 适合大学生的三大痛点解法

#### 一、 搞定那些又多又繁重的学术文献（200万字无压力）
一般的 AI，一两万字就已经“健忘症”了。Gemini 2.5 Flash 支持 **200万 Token 的超长上下文**。也就是说，你可以把这一学期的所有英语教材大纲、一整本核心专业书，甚至老师布置的几十篇综述论文一次性扔进去。
*   **高频问题：** *"请找出第三章关于光电效应的核心推导逻辑，并用大一新生能听懂的大白话给我讲一遍。"*
*   **AI 表现：** 只需要两秒钟，用整洁明澈的中文给你吐出标准提纲。

#### 二、 搞定超长公开课音视频
很多同学为了网课发愁。遇到全英文的 B 站/Coursera 网课，你可以下载音视频文件，直接拖进 Gemini。两万秒的视频它不仅能帮你输出最准确的逐字稿，还能提炼考点。

#### 三、 几乎免费的极高性价比
每 100 万字只要 5 分钱！谷歌也提供了高额的免费账户额度，对完全没有收入的大学生极度友好。

---

### 🛠️ 怎么上手才最酷？
现在小顺平台已经将该模型封装入驻，在“设置”绑定你的账户后：
1.  **文献速读：** 导入海外 AI 论文；
2.  **生成提纲：** 点击一键提炼，转换为适合大学生理解的逻辑图谱；
3.  **润色输出：** 转换成优美的中文，作为你做读书汇报（PPT）的超强后盾！

还在用传统的翻译软件一句句复制吗？赶紧试试这个谷歌最强大的超级大脑吧！
`,
        wordCount: 890
      },
      freelancer: {
        title: '自由职业者必看！谷歌 Gemini 2.5 降维打击：1人开发效率翻倍，零成本加工国外资讯暴涨流量',
        excerpt: '做海外资讯搬运和内容变现的自由职业者们，谷歌这次把门槛降到几乎为零了。极速、低廉的 Gemini 2.5 Flash 怎么帮我们快速洗稿、快速挖掘热点、快速批量化运营公众号？',
        content: `### 💰 一个人就是一家媒体公司：揭秘 Gemini 2.5 Flash 的变现潜力

对于不上班、没团队的独立开发者和自媒体写作者而言，**“时间”和“算力成本”** 就是我们的命。

谷歌刚刚扔出的这颗重磅炸弹——**Gemini 2.5 Flash**，简直就是为我们这类个人英雄量身打造的。

---

### 🛡️ 自由职业者的“致富”秘籍：有哪些场景能直接变钱？

*   **海量海外AI资讯自动化清洗：**
    现在小顺工作台中，你可以配置 20 个以上的海外名刊 RSS 订阅（如 TechCrunch, ProductHunt 等）。以前人工一个个看、翻译、重写，效率极其低下。而现在，由于 Gemini 2.5 Flash 支持 **2M 极端上下文**，且计算成本直接暴跌了 80%，我们可以利用它的 AI API 把今日所有热门文章打包。
    一键生成：“大纲逻辑” $\rightarrow$ “多目标受众（打工人/自由职业者/学生）” $\rightarrow$ “一键格式化排版”，整个过程甚至可以用脚本自动化，你只需要负责做最后的人工筛选和审核，极速占领信息差高地！

*   **极佳的多模态解析力：**
    你可以上传海外独立开发者的 YouTube 演示视频或宣传图片。Gemini 的图片描述能力处于业界顶端，它能自动提取界面布局，帮你写出详尽的产品拆解评测文，立刻赚取流量分成。

*   **无痛定制小工具：**
    如果你写提示词（Prompt）有些许心得，可以利用 Gemini 2.5 的廉价优势，在公众号后台甚至小红书上，提供低价、高频的 AI 人设咨询、英文润色、外教陪练服务，零基础搭建你的第一条睡后收入线。

*   **小顺内容工作台搭配微信官方接口：**
    本地一键将生成的多受众版本转化成微信原生草稿，在黄金流量点（如中午 12:00、晚上 10:00）多线程发布，极大释放个人内容矩阵的影响力。

现在，就看你的行动力如何了。用这套方法，我的好友只花了一周时间，就搭建了两个海外前沿科普的公众号，现在每月广告和内容分销收入已稳定破万！
`,
        wordCount: 1040
      }
    }
  },
  {
    id: 'draft-2',
    topicId: 'topic-4',
    originalTitle: 'OpenAI Introduces "Operator" Pro: Enterprise Multi-Agent platform for Autonomous Web Actions',
    translatedTitle: 'OpenAI 隆重推出 "Operator" 专业版：企业级全自主网页探查与批量办公智能体',
    category: '产品动态',
    selectedAudience: 'officeWorker',
    status: 'synced',
    reviewScore: 5,
    reviewerFeedback: '内容非常好，微信后台排版完美，已经在今日 12:00 同步发布。点击量和点赞数反馈极好！',
    createdAt: '2026-05-23 16:00',
    lastEdited: '2026-05-23 17:45',
    tokenCost: 18200,
    syncedTime: '2026-05-23 18:00',
    wechatMediaId: 'wx_media_abc123789xyz',
    versions: {
      officeWorker: {
        title: 'OpenAI发布新一代“电脑替身”！再也不需要你亲自动手：订外卖、填报销、催回款，AI通通全替你包了',
        excerpt: '再也不用做表格做的心烦意乱了！OpenAI最新推出的Operator Pro企业级替身，能够实现全自主键鼠操作。在零人工介入的情况下，完成打通20个跨平台软件的无缝工作。来看看它是如何解救职场民工的。',
        content: `### 🎯 OpenAI 扔出王炸：多能办公室化白领真的要被替代了？

今天，OpenAI 官方博客更新了一篇名为 **"Operator Pro"** 的头条推文。

简单来说：**这不是聊天对话框，而是一个可以直接动用主电脑屏幕、有自主决策力的“全能鼠标手”。**

你只要给它一句日常人话：
> *"Operator，去把上个月出差的携程行程订单全部整理出来，填写到公司那套落后的 OA 报销系统里，并自动生成一封言辞诚恳的邮件，发送给严厉的财务张姐，催她周五前帮我完成打款。"*

接下来的事情，你只需要撑着下巴，看屏幕上的鼠标自动滑动！
点击携程 $\rightarrow$ 智能验证登录 $\rightarrow$ 筛选发票 $\rightarrow$ 批量下载 $\rightarrow$ 打开本地浏览器 OA 登录 $\rightarrow$ OCR 识别发票金额并填入表单。

这就叫 **全自主网页动作（Autonomous Web Actions）**。

---

### 🔥 这个“企业替身”有什么恐怖之处？

1.  **它懂复杂的视觉逻辑（强化学习）：**
    绝大多数公司的后台极其复杂、卡顿，按钮常年变位置。普通的自动化脚本只要稍微遇到验证码或者按钮偏移就报错。而 Operator Pro 引入了专门匹配人类视觉的强化训练。它会自己试探，找不到按钮会自动在搜索框搜，极其抗挫。

2.  **绝对安全的防呆防火墙（Session Guardrails）：**
    老板和财务最担心的就是钱和机密泄漏。新一代 Operator 的私有级别中建立了一键熔断和权限沙盘。比如，你可以设置 *"单笔支付超过 200 元必须弹框由人类确认"*，其余琐碎小钱都可以由系统独立跑。

3.  **支持大规模“组队”摸鱼：**
    你可以同时指派 10 个 Agent 一起协作：Agent A 在海外科技网上扫最新的 AI 资讯并翻译；Agent B 负责按小顺模版转置；Agent C 监控微信官方同步状态！

小顺 AI 运营组已经接入测试版，该技术将大幅节省未来我们内容编辑的工作时延！
`,
        wordCount: 1210
      },
      student: {
        title: '大学生直呼内行！OpenAI 发布多能智能体 Operator Pro：从今往后，你可以找 AI 帮你处理所有教务选课与繁杂作业了',
        excerpt: '不想半夜三更在垃圾教务网上抢课？OpenAI 最新网页智能体 Operator Pro 可以全自主执行浏览器点击。来看看它怎样帮大学生摆脱各种机械重复填表的摧残！',
        content: `### 🚀 OpenAI 推出 Operator Pro

大学里各种机械式的重复填表和表格提交是不是让你崩溃？

今天，OpenAI 发布了全新的 **Operator Pro** 网页端执行器。它不仅仅是教你写代码、查英文，更是直接化身成为你的物理“键鼠替代者”。

选课抢名额、去图书馆预约特定的自习座位、甚至多平台提交实习生简历，这些操作你从此都不用亲力亲为了。

*   **场景一：极限教务强选课**
    在设置里录入选课偏好和多选备用课程。只要服务器允许，Operator 可以在后台毫秒级侦测空余，完成点击、输入验证码并确认，成功率比依靠宿舍网络的手速高出几十倍。

*   **场景二：实习生海投**
    设定人设简历后，给 Operator 下达命令：*"在招聘平台上，检索上海所有提供大厂 AI 运营的实习岗位，并帮我自主定制问候语，一键投递过去。"* 

虽然目前该企业专业版需要一定的月费，但这也展示了 AI 应用层完全脱离了单纯聊天框（Chatbot）形态，正式走向了实体操作系统的全新未来！
`,
        wordCount: 880
      },
      freelancer: {
        title: '变现工具天花板！OpenAI Operator Pro 发布：高配版数字分身，帮你全天候监听平台、自动抢单、处理客诉',
        excerpt: '自由职业者的重大福音！OpenAI 的 Operator Pro 具备全网页自主跑业务的能力。看看我们怎么借助这一神器在各大平台上进行高度自动化和零人工监听，完成被动收入和效率提拔！',
        content: `### 🚀 解放双手，自由职业者如何利用 OpenAI "Operator Pro" 组建自动化军团？

做自由职业，最痛苦的就是：
1.  **没有分身：** 需要一边干业务，一边盯着多达五个接单平台的聊天窗，一旦黄金回复稍慢，商单就会流失给同行。
2.  **运营琐碎：** 每天要把产品物料、最新推文挨个发布到小红书、掘金、微信、知乎、微博等 10 个平台，排版上传令人崩溃。

OpenAI 刚刚放出的企业级网页执行大杀器 **Operator Pro**，就是为了彻底解决单兵作战这件痛事而生的。

---

### 💼 针对自由职业者的三大暴力变现流派

#### 1. 全平台监控并自动抢单/回复
你可以通过本地浏览器将 Operator Pro 指向 Upwork, Fiverr 或是国内的特栏。给它设置精细的过滤器。当出现 *"想要搭建一个基于 Gemini 的微信机器人，预算 5000 元以上"* 的标题时。智能体自动提取对方商单描述，在 1 秒内组织出高水准、体现你专业背景的竞标推介草案并直接替你投递。
在变现路上，快 1 分钟就能极大提升 80% 的成交概率。

#### 2. 全域全渠道（Omnichannel）一键多站同步
以往没有大型自媒体公司的预算去买超级中间件。现在只需要让 Operator 录制一遍你把草稿发布到 5 个不同平台的点击习惯。
以后每次只需在“小顺内容工作台”一键写好，剩下的 Operator Pro 跑 5 个网页标签，直接模拟人类点击、上传图片、自动标好标签、并一键提交，帮你完成极佳的 SEO 散弹传播。

#### 3. 24小时不知疲倦的咨询接待
如果你的独立产品具有一定知名度，经常会有一些简单的退款咨询、Bug 反馈。把常见的 FAQ 文档喂给智能体。只要收到信息，Operator 会自主通过你的官方微信网关回复，或到 Stripe 后台一键点击退款并给买家发送安抚邮件。

你甚至可以不用去上班，让 10 个数字分身在网络世界为你不知疲倦地打工！
`,
        wordCount: 1110
      }
    }
  }
];

export const initialLogs: SystemLog[] = [
  {
    id: 'log-1',
    time: '2026-05-24 11:32:15',
    module: '内容库中心',
    action: '一键润色打工人版本 [Google Gemini 2.5 Flash...] 并修改文章提纲。',
    operator: '顺子老师 (编辑)',
    type: 'success',
    tokensUsed: 4500
  },
  {
    id: 'log-2',
    time: '2026-05-24 11:30:00',
    module: '内容源监控',
    action: '手动执行定时轮询，成功连接 OpenAI Blog RSS，检测到 0 篇新内容。',
    operator: '系统自动组',
    type: 'info'
  },
  {
    id: 'log-3',
    time: '2026-05-24 10:45:12',
    module: 'AI写作工坊',
    action: '调用 [Gemini 2.5 Pro] 引擎，同时生成 [打工人/大学生/自由职业者] 三个目标受众版本。',
    operator: '顺子老师 (编辑)',
    type: 'success',
    tokensUsed: 42300
  },
  {
    id: 'log-4',
    time: '2026-05-24 10:42:01',
    module: '内容源监控',
    action: '由 RSS 头条源自动拉取并解析一篇文章 [Google Gemini 2.5 Flash...]，翻译任务列队正常。',
    operator: '系统自动组',
    type: 'success'
  },
  {
    id: 'log-5',
    time: '2026-05-23 18:00:20',
    module: '微信同步',
    action: '发布草稿 [OpenAI发布新一代“电脑替身”] 至微信公众号成功。MediaId 缓存已回填。',
    operator: '系统自动组',
    type: 'success'
  },
  {
    id: 'log-6',
    time: '2026-05-23 18:22:45',
    module: '内容源监控',
    action: '连接 VentureBeat RSS 超时。代理请求返回 [504 Gateway Timeout]，已自动重试 3 次。',
    operator: '系统自动组',
    type: 'warning'
  }
];

export const defaultModelSetting: ModelSetting = {
  provider: 'Gemini',
  modelId: 'models/gemini-2.5-pro',
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: '你是一名经验丰富的海外科技自媒体内容主编。负责把前沿的技术资讯提炼为易读、极具吸引力的中文，用排版干净、句式简短、富有场景感的段落向国内受众科普。',
  officeWorkerPrompt: '【打工人痛点定位】多代入日常办公加班、摸鱼、汇报、写周报场景。文章走“降维打击效率、拒绝无效奋斗”路线，提供具体的使用步骤，强调极速、节省时间。',
  studentPrompt: '【大学生学业场景】突出期末考试备考、考研综述写论文、四六级、寻找实习 offer 时的具体场景。语言轻松、幽默，带上流行的大学生互联网黑话，突出零成本、易上手的特征。',
  freelancerPrompt: '【自由职业赚零花钱】突出副业创收（被动收入）、单兵作战、搭建自动化工作流（1人成公司）。直接说明怎么把这个AI技术转换成潜在的商单，用金钱和独立精神激励读者。'
};

export const initialConfig: AppConfig = {
  wechatAppId: 'wx888888fa999999bc',
  wechatAppSecret: 'sec_8c89c890989ad87d988899fae5e',
  wechatIsConfigured: true,
  autoSyncActive: false,
  alertOnTokenLimit: true,
  monthlyTokenLimit: 10000000, // 10 Million
  monthlyTokenUsed: 3412500 // 3.41 Million
};
