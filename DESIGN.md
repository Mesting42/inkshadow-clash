---
name: 墨影激斗
description: 都市剪影动作片中的拳脚、红披风与可读的战斗界面
colors:
  paper: "#eee5d2"
  muted: "#bdc1bf"
  red: "#e3745d"
  panel-token: "#1b2934"
  page: "#111b26"
  stage-border: "#14222e"
  panel-surface: "#1c2c37"
  overlay: "#0e1b29b8"
  button: "#33444e"
  button-hover: "#455864"
  button-text: "#e8deca"
  primary: "#e7a47d"
  primary-hover: "#f4b791"
  primary-ink: "#182735"
  focus: "#f0ca92"
  reward-surface: "#2a3c46"
  reward-hover: "#374c57"
  training-surface: "#142837e8"
  training-button: "#314957"
  training-selected: "#bd9672"
  health: "#e6ab89"
  energy: "#a1c7c2"
  face: "#eee9d8"
  body: "#1d2527"
  cape: "#b63f37"
  cape-light: "#e96450"
  palm: "#addac6"
  shadow: "#b1c4ef"
  quake: "#ecc08b"
typography:
  display:
    fontFamily: 'InkDisplay, "STZhongsong", "SimSun", serif'
    fontSize: "clamp(70px, 10.5vh, 118px)"
    fontWeight: 900
    lineHeight: 1.03
    letterSpacing: "0.03em"
  headline:
    fontFamily: 'InkDisplay, "SimSun", serif'
    fontSize: "34px"
    lineHeight: 1.3
    letterSpacing: "0.03em"
  body:
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: "12px"
    lineHeight: 1.75
  label:
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: "10px"
  button:
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: "14px"
  combo:
    fontFamily: "Georgia, serif"
    fontSize: "64px"
    fontWeight: 400
    lineHeight: 1
rounded:
  button: "3px"
  notice: "4px"
  hud: "5px"
  chapter: "8px"
  panel: "12px"
  circle: "50%"
spacing:
  compact: "4px"
  small: "8px"
  control: "12px"
  medium: "20px"
  section: "25px"
  panel-y: "30px"
  panel-x: "36px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.button}"
    textColor: "{colors.button-text}"
    rounded: "{rounded.button}"
    padding: "12px 20px"
  button-secondary-hover:
    backgroundColor: "{colors.button-hover}"
  panel:
    backgroundColor: "{colors.panel-surface}"
    rounded: "{rounded.panel}"
    padding: "30px 36px"
    width: "min(580px, 100%)"
  reward-card:
    backgroundColor: "{colors.reward-surface}"
    rounded: "{rounded.panel}"
    padding: "0 23px 20px"
  training-selector:
    backgroundColor: "{colors.training-button}"
    rounded: "{rounded.button}"
    padding: "7px 10px"
  training-selector-selected:
    backgroundColor: "{colors.training-selected}"
  joystick:
    rounded: "{rounded.circle}"
    width: "132px"
    height: "132px"
  touch-skill:
    backgroundColor: "#244444db"
    rounded: "{rounded.panel}"
    width: "62px"
    height: "64px"
---

# Design System: 墨影激斗

## Overview

**Creative North Star: "都市剪影动作片"**

这是对已实现界面的交接记录。角色与城市占据画面，菜单及 HUD 为动作提供入口、读数与状态提示。深蓝灰底、骨白文字、铜橙主操作和朱红披风形成当前视觉关系；旧街、工厂和高塔由建筑形态、分层色调与环境运动区分。

玩家采用用户最终确认的浅色椭圆大头、眉眼表情、圆润黑色肢体与红色披风，不使用头带。长杆与重锤由双手包握，指节覆盖握柄。手机和平板使用模拟摇杆；技能按钮的掌印、疾影与震波轮廓，与战斗中的 Canvas 特效来自同一份形状数据。

**Key Characteristics:**

- 非像素的程序绘制角色、实心图标与城市剪影。
- 等比舞台、圆润肢体、清晰的武器握持与出招方向。
- 深色低干扰界面，铜橙主操作，颜色与形状共同提示技能和战斗状态。
- 触控集中于下方两侧，横屏保持完整动作视野。

本记录以 `src/style.css`、`src/renderer.ts`、`src/icons.ts` 为主要视觉事实来源，并核对 `src/ui.ts`、`src/data.ts` 与 `src/skill-vfx.ts`。`PRODUCT.md` 与 `index.html` 方向注释均已同步为最新确认的红色披风、无头带造型。

## Colors

前置 token 保留源码原值；本节描述用途，不另建立调色板。源码没有统一递进色阶，sidecar 色条仅为面板预览生成，不构成新增游戏配色。

### Primary

- **夕照铜橙**（`primary`、`primary-hover`）：开始或继续战役、继续战斗等主操作。深色字由 `primary-ink` 承担。
- **暖陶朱红**（`red`）：保留源码根变量；玩家披风实际由更深的 `cape`、较亮的 `cape-light` 及局部高光绘制，不能用根变量替换整个披风。

### Secondary

- **浅玉掌印**（`palm`）、**雾蓝疾影**（`shadow`）、**砂金震波**（`quake`）：分别标识冲击掌、影步突袭、震地爆发；同色传入 UI 图标与对应技能特效。
- **暖铜生命**（`health`）与**浅青能量**（`energy`）：HUD 两条资源读数；Boss 生命条、敌人预警另使用各自源码颜色。

### Neutral

- **骨白纸色**（`paper`）与**灰绿次字**（`muted`）：根文字色与次级文字变量。各模块的具体文字仍遵循现有 CSS。
- **夜蓝底**（`page`、`stage-border`）、**蓝灰面板**（`panel-surface`）和半透明 `overlay`：页面、等比舞台留边与弹层层次。根变量 `panel-token` 与实际面板背景不是同一个值，二者均据实保留。
- **石蓝按钮**（`button`、`button-hover`）、**奖赏蓝灰**（`reward-surface`、`reward-hover`）：常规按钮与可选奖励的交互底色。
- **浅色脸**（`face`）与**墨黑身体**（`body`）：角色可识别性的主要明暗关系。

场景没有套用 UI 主色。`renderer.ts` 的三套调色板如下；每行依次为天空、地平线、远景、中景、前景、地面、灯光、线色：

| 场景 | 源码调色板 |
| --- | --- |
| 夕阳旧街 | `#c17b62` / `#f0bd83` / `#826d70` / `#56535e` / `#29343f` / `#202b33` / `#edc08d` / `#8b8177` |
| 雨夜工厂 | `#1e3549` / `#607b88` / `#344c5e` / `#2a414e` / `#172a35` / `#15262e` / `#f1c482` / `#68848a` |
| 高塔冷光 | `#424760` / `#a1adb9` / `#596375` / `#3b4b60` / `#243543` / `#1d2c3b` / `#e1c6ac` / `#8b9aa6` |

**The Shared Glyph Rule.** 技能名称、颜色和轮廓取自已有技能数据与 `SKILL_GLYPHS`，UI 和战斗特效保持同源。

## Typography

**Display Font:** 本地 `InkDisplay`，依次尝试 STKaiti、KaiTi、Kaiti SC；标题回退至宋体与 serif。没有下载字体。

**Body Font:** Microsoft YaHei、PingFang SC、sans-serif。连击数字和章节序号使用 Georgia；时间、资源和冷却数字使用等宽数字特性。

### Hierarchy

- **Display**：主菜单双行书写感标题，字号、字重、行高见前置 `display`；整体倾斜（−7deg），第二行内缩（46px），末尾暖红句点。
- **Headline**：弹层标题使用 `headline`；字重由标题元素继承浏览器粗体默认值，源码未建立独立字重 token。
- **Title**：奖励名称（20px），训练/目标标题与界面局部标题（12–19px），按现有组件区分。
- **Body**：说明常用（12px），段落通常行高（1.75），奖励说明为（1.8）。面板副标题最大宽度（65ch）。这里的 `body` 是观察到的说明文字角色，不是声称根节点指定了 12px。
- **Label**：HUD、快捷键、装备次字常用（9–12px）；极小横屏会出现（8–10px）。菜单标语采用较疏字距（0.3em），主菜单字标为（0.17em）。
- **Combo**：连击数使用 `combo`，低高度触屏时缩至（44px）。

## Layout

画布内部采用固定虚拟舞台（1280×720）。每帧按宽高较小比例统一缩放并居中，剩余区域填充舞台留边色；设备像素比上限（2）。Canvas 裁剪在虚拟舞台内，角色和骨骼不得因视口长宽比被拉伸。DOM 的菜单、HUD 与触控层覆盖整个实际视口，不能把这些 DOM 坐标误认为舞台坐标。

主菜单正文位于左侧（left 9%、top 15%、宽 390px），主操作宽上限（300px）；装饰角色与城市场景保留在右侧。菜单外边距为（36px 5vw）。弹层居中，常规宽上限（580px）、宽面板（1020px），默认内边距（30px 36px），超高内容在面板内部滚动。

功能布局按既有内容组织：奖励为三列（18px 间隙），商店为三列（12px），章节为两列（12px），设置和操作说明是双栏。没有全局 8px 栅格；前置 spacing 只摘录反复出现的间距。

| 条件 | 已实现的变化 |
| --- | --- |
| `pointer:fine` | 默认隐藏触控层；显式启用触控可由后续 `.touch-enabled` 规则覆盖。 |
| `pointer:coarse` | 装备摘要上移，训练工具移至顶端，触控操作出现于游玩状态。 |
| `max-height:650px` | 缩小标题、按钮、面板内边距及 HUD，主标题改用 `clamp(55px,13vh,88px)`。 |
| `pointer:coarse` 与低高度同时成立 | 更紧凑的 HUD 与触控布局，训练工具顶部（87px）。 |
| `max-width:760px` | 菜单左移、文字变小、商店改两列，奖励仍三列；设置和操作说明仍双栏。 |
| `.touch-enabled` | 训练工具顶部（100px），显式触屏布局覆盖部分默认值。 |
| `max-height:500px` | 显式触控训练工具顶部（78px），战斗按钮组和摇杆按（0.88×用户触控尺寸）缩放。 |
| 触屏竖屏，或已启用触控的竖屏 | 显示全屏“转动屏幕，准备出招”提示；战斗暂停由游戏逻辑实现。 |
| `prefers-reduced-motion:reduce` | 关闭 CSS transition；Canvas 运动仍由游戏设置和绘制逻辑控制。 |

HUD 顶部左右边距、摇杆和右侧操作区包含 `safe-area-inset-*`。摇杆默认底边距（25px），低高度为（16px），外容器（152×152px）、底盘（132×132px）、摇杆帽（52×52px）。这些是 CSS 尺寸，触控缩放设置继续作用于容器。

**The Proportion Rule.** 等比缩放虚拟舞台并保留留边，不用非等比缩放补满屏幕。

## Elevation & Depth

城市以三层建筑的色差、遮挡和视差表现纵深，滚动速度为镜头的（0.1 / 0.25 / 0.46）。旧街加入电缆、天线和飞鸟，工厂加入斜雨与灯光，高塔加入梁柱和薄雾。菜单左侧渐暗与上下边缘暗角保护文字；战斗中心保留视野。

DOM 层次依次为画布、HUD（z-index 2）、触控（3）、覆盖面板（4）、通知（6）与竖屏提示（20）。阴影只在已有面板、标题、目标与摇杆帽等位置使用，不是所有卡片的默认材质。

### Shadow Vocabulary

- **面板浮层**：`0 18px 70px #07121e88`。
- **摇杆帽**：`0 4px 12px #0d1d2b55`。
- **主标题文字**：`0 5px 20px #0e192b30`。
- **关卡目标文字**：`0 2px 8px #112333`。
- **连击文字**：`0 2px 15px #1b2839`。

## Shapes

界面是微圆角操作条与较圆的面板/奖励卡片：按钮（3px）、通知（4px）、HUD 摘要（5px）、章节与训练工具容器（8px）、弹层和奖励（12px）。格挡、拾取和投掷辅助键保留小矩形形态，主动技能键使用较大的圆角矩形；轻重击、跳跃和闪避为圆形。

生命和能量条倾斜（−12deg）；字标是裁切的折角形。人物用圆端描边、圆连接和椭圆头/脚建立形体；玩家头部椭圆半径（16.5×20.5），深色描边（3.5px）。长杆和锤柄连续穿过拳头，两只手包握，握持细节在武器之后覆盖绘制。

## Components

### Buttons

主操作为暖铜色实底、深字、较粗字重；普通操作为蓝灰底、骨白字。标准按钮最小高度（47px）、内边距（12px 20px）、图文间距（40px）。菜单主按钮增至最小高度（56px）、字（17px）、内边距（14px 22px）。Hover 改底色并右移（2px），过渡（0.15s）。全局键盘焦点为暖色描边（2px），外偏移（5px）；disabled 不透明度（0.43）。源码未建立通用 active 样式。

### Navigation

主菜单导航由主操作、竞技场/训练双入口、章节/设置/操作说明文字入口组成。文字入口使用透明背景，hover 暖色高亮；不是侧栏或顶部标签页导航。暂停菜单使用纵向按钮（8px 间隙），低高度缩至（5px）。

### Cards / Containers

居中弹层承担暂停、设置、说明、章节、奖励与结算。奖励卡是可按按钮：顶部徽记、层数、技能名称、说明、选取入口；hover 底色变亮并上移（4px），过渡（0.15s）。奖励徽记背后按该强化颜色生成局部径向渐变，不统一改为铜橙。商店卡含图标、说明与独立购买键，禁用购买沿用全局 disabled 状态。

### Inputs / Fields

设置只实现 range 滑杆与按键绑定按钮，没有文本输入框。Range 使用原生控件、暖色 `accent-color`（`#e5ae84`）、宽度（100%）、高度（5px）；焦点沿用全局描边。绑定按钮包含动作名与 `kbd`，重置键使用透明底文字入口。

### Training Selector

训练工具包含真实伤害/命中/连击读数、武器、三个主动技能、陪练开关、重置与退出。按钮小巧紧凑，已选项目用 `training-selected`；技能项显示（18px）专属图标。触屏时工具移到上方；训练模式隐藏普通装备摘要，以免遮挡操作。

### Virtual Joystick & Touch Actions

左侧是单个模拟摇杆，四向箭头围绕圆盘；engaged 时边框变暖、摇杆帽变铜色并取消回弹过渡，松手回中采用（0.12s ease-out）。右下是轻击、重击、跳跃、闪避四个圆键；右上辅助行包含格挡、主动技能、拾取与投掷。所有操作默认透明度来自用户设置；held 时转暖色且不透明度为（1）。辅助操作 CSS 目标至少（44×44px），实际屏幕大小还受用户缩放和低高度（0.88）缩放影响，不能据此声明始终具有 44px 的物理点击区域。

### Active Skill

触屏技能键显示专属图标、名称和能量消耗；冷却期间用向上取整的秒数盖在图标区域，边框变灰，图标改灰青。能量不足降低饱和度（0.3），按住使用暖色高亮。冲击掌、影步突袭、震地爆发分别用掌形、斜向疾影与震波裂纹轮廓。图标是内联 SVG（viewBox 0 0 72 72），Canvas 通过同一 SVG path 创建 Path2D。

### Combat Feedback

普通命中用有限弧线、火花、数字和短暂闪白；闪避有三层低透明残影。敌人起手用环形读条，并以叹号或三角形区分预警，红色不可格挡。技能特效持续时间分别为冲击掌（0.44s）、影步（0.48s）、震波（0.72s），从已有轮廓展开；特效设置为零仍保留淡色技能轮廓。短促震动、闪白和特效强度由现有设置控制，不把战斗判定交给视觉动画。

### Notice & Orientation State

通知位于顶部（22%）居中，最大宽（85%）、内边距（11px 20px），通过透明度和位移（0.18s）出现，显示约（3.3s），使用 `role=status` 与 `aria-live=polite`。竖屏提示全屏覆盖，书写感标题（28px）与正文（13px）。

## Do's and Don'ts

### Do:

- **Do** 保留浅色大头表情、黑色圆润肢体与红披风的用户确认造型。
- **Do** 保留虚拟舞台比例、场景留边与角色骨骼比例。
- **Do** 让技能按钮、装备徽记和战斗特效继续读取同源轮廓与技能颜色。
- **Do** 保留长杆、重锤双手包握及手指遮挡武器的绘制顺序。
- **Do** 按既有断点和触控设置核对实际布局，并同时检查冷却、能量不足、按住与选中状态。

### Don't:

- **Don't** 给玩家重新添加头带，或把红披风恢复为围巾。
- **Don't** 把程序绘制的圆润人物改成像素角色，或非等比拉长舞台。
- **Don't** 用通用技能文字或无关图标替换现有掌印、疾影、震波。
- **Don't** 把 sidecar 自动生成的预览色阶作为新增游戏规范。
- **Don't** 将本记录当作新的改版方案；后续修改以用户确认和实际源码为准。
