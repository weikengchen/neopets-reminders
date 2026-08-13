# Hospital Volunteer / Grave Danger 诊断与最小修复交接

> 供负责修复的 AI agent 使用。本文档记录一次连接 Chrome 调试浏览器后的 live DOM 证据与修复建议。
> 本次诊断未修改 parser、业务逻辑、manifest、权限或 dist。

## 1. 诊断范围与安全边界

- 仅读取用户手动打开且已经渲染的页面。
- 没有刷新、自动导航、后台 fetch/XHR/WebSocket、轮询或 MutationObserver。
- 没有点击 Join、Collect、Cancel、Send Petpet 或其他 gameplay 控件。
- 没有读取 cookie、token、密码或保存账户信息。
- live DOM 片段中的宠物名、图片、`onclick`、`data-id` 和账户相关内容均已省略或替换。

诊断日期：2026-08-11（Asia/Singapore）。浏览器日志时间显示为 2026-08-10T17:55Z，对应本地次日凌晨。

## 2. 结论摘要

| 报告问题 | 已确认结论 |
| --- | --- |
| Hospital popup 出现大量 available | 页面上确实有 12 个 `Join Shift` 卡片。当前 parser 会把每个 available 卡片写入 storage，popup 再逐条显示。它不是 active selector 误判，而是 reminder 产品不应逐条保存 available 的策略问题。 |
| Hospital 两个 active 漏抓 | 两个 active 卡片的 status、pet selector 和 Cancel 按钮均匹配；但 live `.vc-fight-time` 内含 inline `<script>`，`textContent` 不是纯 `HH:MM:SS`，导致时钟解析失败。页面 console 同时记录了两次 `skip-unparseable-hospital-clock`。这是已确认根因。 |
| Grave Danger active remaining 漏抓 | 当前 live DOM 的 URL、selector 和 remaining 文案均符合 parser/fixture；但一次性 `document_idle` observer 记录了 `skip-unparseable-gd-remaining`。当前 DOM 后来是可解析的，因此证据指向页面渲染时序竞争；初次观察时的原始文本没有被记录，具体是空文本还是中间态仍需用诊断日志复现确认。 |

## 3. Hospital Volunteer live 证据

URL：`https://www.neopets.com/hospital/volunteer.phtml`

页面当时：

- `document.readyState = complete`
- `document.visibilityState = visible`
- `document.querySelectorAll('.vc-fight-details').length = 26`

卡片统计：

| 类型 | 数量 | live 证据 |
| --- | ---: | --- |
| Active | 2 | `.vc-status` 为 `Time Remaining:`；有 `.vc-pet-name`；按钮为 `Cancel` |
| Available | 12 | status 为 `Volunteer Time Needed:`；按钮为 `Join Shift` |
| 空占位卡 | 12 | title 为 `????`，没有 timer、pet 或按钮 |
| Ready | 0 | 没有观察到 `Collect Prize` |

两个 active 卡片的关键结构（已脱敏）：

```html
<div class="vc-fight-details">
  <div class="vc-title" title="Battle for Brightvale I">Battle for Brightvale I</div>
  <span class="vc-status">Time Remaining:</span>
  <span class="vc-fight-time">
    <span>0</span><span>0</span>:<span>3</span><span>4</span>:<span>5</span><span>3</span>
    <script>[omitted inline clock]</script>
  </span>
  <span class="vc-pet-name">FixturePetHospital01</span>
  <span> is volunteering!</span>
  <button class="vc-button">Cancel</button>
</div>
```

live `.vc-fight-time` 的关键事实：

- 有 6 个 digit `span`，另有 1 个 inline `script` 子元素。
- `textContent` 类似：`00:34:53 let clock3 = new vcClock(0, 39, 59); ...`。
- `parseHmsDurationMs()` 要求整个字符串匹配 `HH:MM:SS`，所以返回 `null`。
- 两个 active 卡片均有 `.vc-pet-name`，不是 pet selector 漏抓。

页面 console 中实际观察到：

```text
[neopets-reminders] hospital skip-unparseable-hospital-clock
[neopets-reminders] hospital skip-unparseable-hospital-clock
```

### 3.1 Hospital available 噪音根因

当前 [src/parsers/hospital.ts](src/parsers/hospital.ts) 在发现 `Join Shift` 或 `Volunteer Time Needed` 时，会创建：

- `activityStatus: 'available'`
- `timerQuality: 'none'`
- `status: 'ready'`
- `dueAt: observedAt`

随后 service worker 保留这些记录供 UI 使用，popup 的 `other` 分区逐条渲染。因此当前 live 的 12 个 available 卡片会变成 12 条 popup 噪音。

这不是页面把 idle shift 误认成 active；而是当前 reminder 模型把“可加入但没有进行中 timer”的每个 shift 都持久化了。

## 4. Grave Danger live 证据

URL：`https://www.neopets.com/halloween/gravedanger/`

当前 live DOM 存在全部 active markers：

```html
<div id="gdAdventure">
  <div id="gdActive">
    <div class="pet">
      <span class="petpetName">FixturePetpetGDLive</span>
    </div>
    <div class="info">
      <p class="statusTitle">Status:</p>
      <p>Chewing a slime-covered shoe left by some unfortunate adventurer.</p>
    </div>
  </div>
  <div id="gdTime">
    <p class="statusTitle">Remaining adventuring time:</p>
    <p id="gdRemaining">4 hours, 33 minutes, 10 seconds</p>
  </div>
</div>
```

已确认存在：

- `#gdAdventure`
- `#gdActive`
- `#gdTime`
- `#gdRemaining`
- `.petpetName`

当前 `#gdRemaining.textContent` 是 `4 hours, 33 minutes, 10 seconds`，与现有 `parseDurationMs()` 和 `tests/fixtures/grave-danger/active.html` 的格式一致，理论上应返回约 4 小时 33 分的 snapshot。

但是 content script 页面日志记录了：

```text
[neopets-reminders] grave-danger skip-unparseable-gd-remaining
```

`src/content/observe.ts` 只在 `document_idle` 执行一次；没有延迟重试。由于当前 DOM 后来已经可解析，最小合理假设是 Grave Danger 的 active 内容在首次观察时尚未稳定，或者首次读取拿到了空/中间文本。现有证据不足以断言具体延迟毫秒数。

不要先放宽 `parseDurationMs()`：当前 live 文案本身已经是合法格式，selector/格式 parser 不是主要问题。

## 5. URL、注入与消息链路

### 5.1 URL 与 content script 注入

本次没有发现 URL 或 manifest 注入问题：

- Hospital live URL 被 `classifyPageUrl()` 识别为 `hospital`。
- Grave Danger 尾部 slash URL 被 `classifyPageUrl()` 识别为 `grave-danger`。
- manifest 的 `https://www.neopets.com/halloween/gravedanger/*` 覆盖了本次 live URL。
- 页面 console 日志的来源是扩展的 `observe-content.js`，证明 content script 已实际执行。

相关代码：

- `src/shared/url-allowlist.ts`
- `manifest.json`

### 5.2 为什么不是 service worker validation 主因

`sendActivities()` 在 observations 为空时直接返回，不发送 `ACTIVITY_OBSERVED`。本次两个失败 parser 都因 timer 解析失败返回空 observations，所以消息链路通常在 content script 侧就停止了。

service worker 中的 `rejected ACTIVITY_OBSERVED` 仍可在扩展后台控制台复核，但不是本次两个 bug 的首要修复点。不要先改 validation、权限或 sender URL。

## 6. 最小修复建议（按优先级）

### P0 — 修复 Hospital active 时钟读取

在 `src/parsers/hospital.ts` 中增加一个局部 clock extractor：

1. 先读取 `.vc-fight-time` 的直接 digit `span` 子节点。
2. 排除 `script` 和其他非显示/非 digit 子节点。
3. 拼接成纯 `HH:MM:SS` 后再调用 `parseHmsDurationMs()`。
4. 不要对整个 `.vc-fight-time.textContent` 做宽松 substring 匹配，以免把 inline JS 中的数字误当 timer。

预期验收：当前 live 的两个 active 卡片均生成 `activityStatus: 'active'`，不再出现两次 `skip-unparseable-hospital-clock`。

### P0 — 停止逐条保存 Hospital available

推荐 reminder 产品只存储：

- active
- ready

对 `Join Shift` / `Volunteer Time Needed` 卡片直接跳过，不创建 12 条记录。若未来需要提示 available，最多创建一条 summary，不要按 shift 逐条生成 reminder。

注意：已有 storage 中的 available 记录不会因为 parser 改动自动消失。修复时需要选择一种最小清理策略：

- 一次性迁移/删除已有 `activityStatus: 'available'` Hospital 记录；或
- 暂时在 popup 过滤它们，再安排存储清理。

### P1 — Hospital 判断顺序加固

ready/active 判断应优先于 available 判断。这样即使未来 live 卡片同时存在隐藏的 Join/Collect 控件，也不会因为先匹配 `Join Shift` 而错误分类。

这项是预防性加固；本次 live 页面没有观察到 `Collect Prize` 与 `Join Shift` 同卡共存。

### P1 — Grave Danger 只增加一次延迟重试

当以下条件同时满足时，可以在 content script 中安排一次短延迟重试：

- 页面已分类为 `grave-danger`；
- `#gdAdventure` 或 `#gdActive` 存在；
- 初次 parse 没有 observation，且 `#gdRemaining` 缺失、为空或不可解析。

建议只使用一次 `setTimeout`（例如数百毫秒到约 1 秒范围），不要使用 interval、轮询或 MutationObserver。重试成功后只发送一次最终 observation；失败则安全记录诊断并停止。

重试逻辑应继续使用当前 `observedAt + parsed remaining` snapshot 语义，不要尝试获取服务器发送时间，也不要后台刷新页面。

## 7. 测试与 fixture 建议

当前已有测试：

```text
npm test -- --run tests/unit/multi-activity-parsers.test.ts
10 tests passed
```

这些测试通过是因为 Hospital fixture 中的 script 已被脱敏删除，未覆盖 live 的 inline-script 差异。

建议新增一个最小回归输入（不需要保存真实账户内容）：

- `tests/fixtures/hospital-volunteer/active-inline-clock.html`，或
- 在 parser 单测中构造一个带 `<script>[redacted]</script>` 的 `.vc-fight-time`。

该回归输入必须验证：6 个 digit span + inline script 仍能解析为纯 `HH:MM:SS`。

Grave Danger 的 `tests/fixtures/grave-danger/active.html` 当前结构已经与 live selector 匹配，不需要因为 selector 重新采集。若后续确认是延迟渲染，应在 README 记录“一次 document_idle 读取可能早于 active remaining 填充”，但不要伪造新的 ready/available fixture。

## 8. 修复后验收清单

- [ ] Hospital live active 两行都进入 popup，且每行有 snapshot timer。
- [ ] Hospital live active 不再出现 `skip-unparseable-hospital-clock`。
- [ ] Hospital available 不再逐条制造 popup 噪音。
- [ ] Hospital ready 仍能识别 `Collect Prize`。
- [ ] Grave Danger live active 在首次观察或一次短延迟重试后产生一个 active snapshot。
- [ ] Grave Danger 的 remaining 仍使用 `parseDurationMs()`，没有无证据放宽成任意数字匹配。
- [ ] 没有新增 tabs/scripting 权限。
- [ ] 没有 fetch/XHR/轮询/自动导航/gameplay click。
- [ ] 运行 `npm run check`。
- [ ] 运行 `npm run build` 后，在 `chrome://extensions` 手动 Reload unpacked `/Users/cusgadmin/neopets-extension/dist`，再由用户手动打开页面验证。
- [ ] 报告仍明确这是 best-effort 观察支持，不宣称完整生产覆盖。
