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
