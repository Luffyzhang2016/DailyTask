# Design System

## Direction

移动端采用今日优先的纵向任务流；宽屏采用月历与任务的双栏工作区。视觉克制、清楚、可靠，以深莓红作为唯一品牌强调色，笑脸只用于完整完成一天后的反馈。

## Themes

- 晨光：纯白背景，适合明亮环境。
- 专注：中性浅灰背景，降低长时间使用的视觉刺激。
- 夜航：近黑背景与逐级提亮的表面，适合低光环境。

## Tokens

- Brand: `oklch(0.42 0.163 350)`
- Success: `oklch(0.55 0.16 145)`
- Spacing: 4, 8, 12, 16, 24, 32, 48 px
- Radius: 8, 12, 16 px; pills only for compact selectors
- Type: system sans / Noto Sans SC; 0.75, 0.875, 1, 1.25, 1.5, 2 rem
- Motion: 180–220 ms state transitions; reduced-motion safe

## Components

Task rows use dividers rather than cards. Controls have at least 44×44 px hit targets and visible focus rings. Dialogs use native `<dialog>`. Completion always combines color, icon, label or text treatment.

## Responsive Layout

Below 800 px, the Today and Calendar views switch through bottom navigation. At 800 px and above, both remain visible in a split layout with the month on the left and selected-day tasks on the right.

