# 健康日常

个人睡眠、运动和两周计划看板。用户选择公开每日聚合摘要。GitHub Pages 从 main /docs 发布。

- 原始 Google Health 数据、令牌、代理配置不上传。
- 本地运行：`node scripts/sync.mjs --publish`。先通过既有连接器刷新近 30 天，再合并本地历史摘要、提交并发布。
- 首次离线构建：`node scripts/sync.mjs --cached`。
- 依赖：本机 Python 3、Node.js、已授权的 health.py 和 gh/git 登录。
- 自动任务不使用 AI agent：macOS LaunchAgent `com.personal-health.google-health-sync` 每小时执行 `scripts/scheduled_publish.py --refresh`，先刷新 Google Health，再合并摘要并发布 GitHub Pages。登录后也运行一次。依赖用户登录、Mac 可运行、联网与有效授权；睡眠/关机期间不持续执行。失败保留上次发布数据，运行状态位于连接器 `.private/dashboard-publish-status.json`。
- 睡眠按醒来日期统计，午睡单列。缺失值不等于零。重叠运动优先主动记录，再优先长记录，只保留不重叠区间。
- 力量训练只能识别明确的力量类运动，无法识别未被设备记录的训练；休息日不推断完成，未来日期不计完成率。
- 三个月的后续周期沿用保守基础安排，进阶需按恢复复盘，不自动递增。

验证：`python3 -m unittest discover -s tests`，`node --check docs/app.js`。

## 日历与自动完成

点击月历日期查看当日计划及实际记录。计划从 2026-10-26 开始，之前的记录不会追溯标成完成。睡眠按醒来日期归属，午夜前入睡且主睡眠至少 7 小时自动完成；运动按当日跑步和力量的最低时长判断，组合训练必须两项都满足。恢复日不推断完成，缺失记录显示待同步 / 无记录。页面每 5 分钟重新读取数据，无需手动打卡。

## 运动后心率恢复

通过现有只读权限查询跑步、骑行、力量训练结束附近的 heart-rate 数据。HRR1 / HRR2 是同一来源设备结束前 10 秒内最近心率减去结束后 1 / 2 分钟前后 10 秒内最近心率。原始采样仅保存在 `.private/recovery.json`，公开网页仅包含恢复差值和对应采样心率摘要。缺失采样不插值，不使用平均心率或静息心率替代；这些是日常手环估算，不是标准化恢复测试。新增或更新运动在每小时同步时自动补取。

验证：`python3 -m unittest discover -s tests` 与 `node --test tests/plan.test.mjs`。
