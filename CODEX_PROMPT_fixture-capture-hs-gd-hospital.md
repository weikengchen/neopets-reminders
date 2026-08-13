# Copy-paste prompt for Codex / ChatGPT (fixture capture only)

Copy everything inside the fence below.

---

```text
你在仓库 `/Users/cusgadmin/neopets-extension` 做 fixture 采集与入库，不要实现 parser/业务功能。

## 必读
- `10-fixture-capture-hospital-gd-hs.md`（主规范）
- `01-policy-safety.md`（observe, never act）
- `tests/fixtures/hospital-volunteer/README.md`
- `tests/fixtures/grave-danger/README.md`
- `tests/fixtures/healing-springs/README.md`
- `tests/fixtures/training/README.md`（脱敏与片段风格参考）

## 任务：为以下三个活动采集当前、人工打开、脱敏 HTML fixture

1) Hospital Volunteer
2) Grave Danger
3) Healing Springs（页面名 Healing Springs，URL faerieland/springs）

## 硬性安全
- 只读用户手动打开且已渲染的页面
- 禁止后台 fetch/XHR/轮询/自动刷新/自动导航
- 禁止代用户点击 Join/Collect/Heal/Buy/Send Petpet 等 gameplay
- 人类可以自己点；你只在点击后的已渲染结果上取片段
- 不要伪造 markup；不要抄旧 userscript 当生产 selector
- 不要改 src/ 业务逻辑、manifest 权限、TRAINING gate
- 不要 npm publish / git push / Chrome Web Store
- 不要实现 parser

## Hospital Volunteer — 特别注意（不可忽略）
URL 预期：https://www.neopets.com/hospital/volunteer.phtml

Owner 观察：页面失去焦点时，time remaining 的更新不可靠。

采集要求：
- 在前台 focused 标签页、尽量 fresh load/手动刷新后立刻抓 remaining 文本
- 把 remaining 当作一次性 snapshot，不要在后台挂很久再抓“当前跳动值”当权威
- 可选：另存一份 background 后的不可靠样本并在 README 标明 unreliable，不得当作 production 真值
- README 必须写清：示例 remaining 字符串、是否在 focused 下会 tick、reload 是否改变数值

目标文件：
- tests/fixtures/hospital-volunteer/available.html
- tests/fixtures/hospital-volunteer/active.html
- tests/fixtures/hospital-volunteer/ready.html（若可得）
- tests/fixtures/hospital-volunteer/malformed.html（可手写负例）
- 更新 tests/fixtures/hospital-volunteer/README.md

## Grave Danger
URL：https://www.neopets.com/halloween/gravedanger/index.phtml

目标文件：
- tests/fixtures/grave-danger/available.html
- tests/fixtures/grave-danger/active.html
- tests/fixtures/grave-danger/ready.html
- tests/fixtures/grave-danger/no-petpet.html（仅当真实出现）
- 更新 tests/fixtures/grave-danger/README.md

保留 return/remaining/status 结构；宠/petpet 名用 Fixture* 合成名。

## Healing Springs
URL：https://www.neopets.com/faerieland/springs.phtml

设计意图（只验证，不实现）：
- 成功 heal/买 → 本地 observedAt+30min
- 只有 cooldown、无近期 success → UI 估算 within ~30min（estimate）
- 预期 cooldown 是固定文案，不是精确剩余秒数——请在 README 明确是否存在 numeric remaining

目标文件：
- tests/fixtures/healing-springs/available.html
- tests/fixtures/healing-springs/success-heal.html（用户手动点 Heal 后）
- tests/fixtures/healing-springs/cooldown.html
- tests/fixtures/healing-springs/success-shop.html（可选）
- 更新 tests/fixtures/healing-springs/README.md

## 脱敏
删除：账号名、cookie/token、NP/NC、inventory、侧栏、追踪、大图 URL
保留：timer/status/按钮相关 DOM 与关键文案结构
片段要小、可 code review

## 缺失状态
不可得就不要造文件；在对应 README 写原因。

## 交付
- 更新三个 README 的 provenance 表
- 最终中文简短报告：已有文件、school/state、脱敏、Hospital focus 如何处理、HS 是否有剩余时间、缺口
- 可 git commit 仅 fixture+README（若环境允许且用户未禁止）；不要 push
```

---
