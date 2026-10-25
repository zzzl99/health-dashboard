# 健康日常

公开的个人睡眠、运动、心率恢复与计划看板： https://zzzl99.github.io/health-dashboard/

## 云端自动同步

GitHub Actions 工作流 `.github/workflows/health-sync.yml` 使用标准 Ubuntu runner，每小时第 17 分钟触发，也支持 Actions 页面手动运行。GitHub 调度可能延迟或跳过，非实时服务。无需 Mac 开机、Codex 或 AI agent；手环仍须先同步到 Fitbit 云端。

1. `cloud_sync.py` 从 GitHub Secrets 初始化临时 Google Health 只读凭据。
2. `health_client.py` 自动刷新访问令牌、读取最近 30 天健康数据。
3. `recovery.py` 补取运动结束附近心率采样。
4. `build.py` 与仓库已发布摘要合并，保留最多 180 天。
5. 只提交 `docs/data.json`，上传 `docs/` 静态站点并部署 Pages。
6. 无论成功或失败都清理临时 `.private`。失败不覆盖线上站点。

必需仓库 Secrets：`GOOGLE_HEALTH_CLIENT_ID`、`GOOGLE_HEALTH_REFRESH_TOKEN`；本 OAuth 客户端同时使用 `GOOGLE_HEALTH_CLIENT_SECRET`。凭据不提交至源码、不写日志、不存 Actions 缓存或发布 artifact。原始健康记录仅在临时 runner 中处理，发布 artifact 仅包含 docs。授权撤销或到期时需要本人重新授权并更新 Secrets。

工作流只在主分支推送、定时或本人手动触发时运行，不接受 PR 触发。代码推送仅测试和部署现有摘要，定时/手动运行才读取 Secrets 并更新健康数据。运行互斥以避免重叠发布。

## 日历与自动完成

点击月历日期查看当日计划及实际记录。计划从 2026-10-26 开始，之前的记录不追溯标成完成。睡眠按醒来日期归属，午夜前入睡且主睡眠至少 7 小时自动完成；运动按当日跑步和力量的最低时长判断，组合训练必须两项都满足。恢复日不推断完成，缺失记录显示待同步 / 无记录。网页每 5 分钟重新读取数据。

午睡单列。重叠运动优先主动记录，再优先长记录，只保留不重叠区间。力量训练只识别明确的力量类运动。后续周期沿用基础安排，进阶需要复盘，不自动加量。

## 运动后心率恢复

通过现有只读权限查询跑步、骑行、力量训练结束附近的 heart-rate 数据。HRR1 / HRR2 为同一来源设备结束前 10 秒内最近心率减去结束后 1 / 2 分钟前后 10 秒内最近心率。公开网页仅包含恢复差值和对应采样心率摘要。缺失采样不插值，不用平均心率或静息心率替代；这些是日常手环估算，不是标准化恢复测试。

## 本地维护与验证

`python3 -m unittest discover -s tests` 与 `node --test tests/plan.test.mjs`。

保留旧本地 `sync.mjs` 和 `scheduled_publish.py` 作为手动维护入口，云端切换完成后不再定时运行。开发时可执行 `node scripts/sync.mjs --cached` 生成本地预览；不要与云端同时推送。`scripts/github.py` 是本机 CLI 网络辅助工具，不在云端使用，也不上传本机网络配置。
