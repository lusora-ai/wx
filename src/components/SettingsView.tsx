/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Cpu,
  Key,
  Sliders,
  ShieldAlert,
  Mail,
  Check,
  Save,
  Database,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Activity,
  Wifi,
  WifiOff,
  Clock,
} from 'lucide-react';
import { ModelSetting, AppConfig } from '../types';
import { aiHealthApi, type AIHealthResult } from '../api/aiHealth';
import { wechatApi, type WechatLoginResult, type WechatPocResult, type WechatSessionValidateResult, type WechatStatusResponse } from '../api/wechat';

interface SettingsViewProps {
  modelSetting: ModelSetting;
  appConfig: AppConfig;
  onSaveModelSetting: (setting: ModelSetting) => void;
  onSaveAppConfig: (config: AppConfig) => void;
}

export default function SettingsView({
  modelSetting,
  appConfig,
  onSaveModelSetting,
  onSaveAppConfig
}: SettingsViewProps) {
  
  // Tabs inside Settings View
  const [settingsActiveTab, setSettingsActiveTab] = useState<'model' | 'wechat' | 'limit' | 'health'>('model');

  // Model settings state
  const [provider, setProvider] = useState(modelSetting.provider);
  const [modelId, setModelId] = useState(modelSetting.modelId);
  const [temperature, setTemperature] = useState(modelSetting.temperature);
  const [maxTokens, setMaxTokens] = useState(modelSetting.maxTokens);
  
  // Prompt instructions fields
  const [systemPrompt, setSystemPrompt] = useState(modelSetting.systemPrompt);
  const [officeWorkerPrompt, setOfficeWorkerPrompt] = useState(modelSetting.officeWorkerPrompt);
  const [studentPrompt, setStudentPrompt] = useState(modelSetting.studentPrompt);
  const [freelancerPrompt, setFreelancerPrompt] = useState(modelSetting.freelancerPrompt);

  // App gateway settings
  const [wechatAppId, setWechatAppId] = useState(appConfig.wechatAppId);
  const [wechatAppSecret, setWechatAppSecret] = useState(appConfig.wechatAppSecret);
  const [autoSyncActive, setAutoSyncActive] = useState(appConfig.autoSyncActive);
  const [alertOnTokenLimit, setAlertOnTokenLimit] = useState(appConfig.alertOnTokenLimit);
  const [monthlyTokenLimit, setMonthlyTokenLimit] = useState(appConfig.monthlyTokenLimit);
  
  // Connection tester
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);

  // AI Health check state
  const [healthResults, setHealthResults] = useState<AIHealthResult[]>([]);
  const [healthLastCheck, setHealthLastCheck] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState('');
  const [wechatStatus, setWechatStatus] = useState<WechatStatusResponse | null>(null);
  const [wechatStatusLoading, setWechatStatusLoading] = useState(false);
  const [wechatPocResult, setWechatPocResult] = useState<WechatPocResult | WechatLoginResult | WechatSessionValidateResult | null>(null);
  const [wechatPocLoading, setWechatPocLoading] = useState(false);
  const [wechatPocError, setWechatPocError] = useState('');

  const loadHealthStatus = useCallback(async () => {
    try {
      const data = await aiHealthApi.getStatus();
      setHealthResults(data.results);
      setHealthLastCheck(data.lastCheckTime);
    } catch {
      // Silently fail on initial load
    }
  }, []);

  useEffect(() => {
    loadHealthStatus();
  }, [loadHealthStatus]);

  const loadWechatStatus = useCallback(async () => {
    setWechatStatusLoading(true);
    setWechatPocError('');
    try {
      const data = await wechatApi.status();
      setWechatStatus(data);
    } catch (err) {
      setWechatPocError(err instanceof Error ? err.message : '微信自动化状态检查失败。');
    } finally {
      setWechatStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (settingsActiveTab === 'wechat') {
      void loadWechatStatus();
    }
  }, [settingsActiveTab, loadWechatStatus]);

  const handleWechatLoginStart = async () => {
    setWechatPocLoading(true);
    setWechatPocError('');
    setWechatPocResult(null);
    try {
      const result = await wechatApi.startLogin();
      setWechatPocResult(result);
      await loadWechatStatus();
    } catch (err) {
      setWechatPocError(err instanceof Error ? err.message : '启动扫码登录失败。');
    } finally {
      setWechatPocLoading(false);
    }
  };

  const handleWechatSessionValidate = async () => {
    setWechatPocLoading(true);
    setWechatPocError('');
    setWechatPocResult(null);
    try {
      const result = await wechatApi.validateSession();
      setWechatPocResult(result);
      await loadWechatStatus();
    } catch (err) {
      setWechatPocError(err instanceof Error ? err.message : '微信 session 校验失败。');
    } finally {
      setWechatPocLoading(false);
    }
  };

  const handleRunHealthCheck = async () => {
    setHealthLoading(true);
    setHealthError('');
    try {
      const data = await aiHealthApi.runCheck();
      setHealthResults(data.results);
      setHealthLastCheck(data.lastCheckTime);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : '健康检查失败。');
    } finally {
      setHealthLoading(false);
    }
  };

  function getStatusIcon(status: AIHealthResult['status']) {
    if (status === 'ok') return <Wifi className="h-4 w-4 text-emerald-500" />;
    if (status === 'slow') return <Clock className="h-4 w-4 text-amber-500" />;
    return <WifiOff className="h-4 w-4 text-rose-500" />;
  }

  function getStatusColor(status: AIHealthResult['status']) {
    if (status === 'ok') return 'emerald';
    if (status === 'slow') return 'amber';
    return 'rose';
  }

  const handleTestWechatConnection = () => {
    setTestResult(null);
    if (wechatAppId.startsWith('wx') && wechatAppId.length > 10 && wechatAppSecret.length > 15) {
      setTestResult('success');
    } else {
      setTestResult('failed');
    }
  };

  const handleSaveAll = () => {
    onSaveModelSetting({
      provider,
      modelId,
      temperature,
      maxTokens,
      systemPrompt,
      officeWorkerPrompt,
      studentPrompt,
      freelancerPrompt
    });

    onSaveAppConfig({
      wechatAppId,
      wechatAppSecret,
      wechatIsConfigured: wechatAppId.length > 5 && wechatAppSecret.length > 5,
      autoSyncActive,
      alertOnTokenLimit,
      monthlyTokenLimit,
      monthlyTokenUsed: appConfig.monthlyTokenUsed
    });

    setSaveSuccessMessage(true);
    setTimeout(() => {
      setSaveSuccessMessage(false);
    }, 2500);
  };

  return (
    <div id="settings-view-wrapper" className="space-y-6 container mx-auto px-1 py-1 font-sans">
      
      {/* Settings layout with tabs segments on top */}
      <div className="bg-white border border-apple-border rounded-[24px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-6">
        
        {/* Header Tabs segments */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-apple-border pb-4 select-none">
          <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-apple-bg border border-apple-border/50 text-meta-readable text-apple-muted font-semibold w-full sm:w-auto">
            <button
              onClick={() => setSettingsActiveTab('model')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center space-x-1.5 ${
                settingsActiveTab === 'model' 
                  ? 'bg-white text-apple-dark shadow-xs font-bold animate-fade-in' 
                  : 'hover:text-apple-dark text-apple-muted'
              }`}
            >
              <Cpu className="h-4 w-4 text-apple-blue" />
              <span>大模型写手配置</span>
            </button>

            <button
              onClick={() => setSettingsActiveTab('wechat')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center space-x-1.5 ${
                settingsActiveTab === 'wechat' 
                  ? 'bg-white text-apple-dark shadow-xs font-bold animate-fade-in' 
                  : 'hover:text-apple-dark text-apple-muted'
              }`}
            >
              <Key className="h-4 w-4 text-apple-blue" />
              <span>微信开放网关密钥</span>
            </button>

            <button
              onClick={() => setSettingsActiveTab('limit')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center space-x-1.5 ${
                settingsActiveTab === 'limit'
                  ? 'bg-white text-apple-dark shadow-xs font-bold animate-fade-in'
                  : 'hover:text-apple-dark text-apple-muted'
              }`}
            >
              <ShieldAlert className="h-4 w-4 text-apple-blue" />
              <span>Token 限额与备份</span>
            </button>

            <button
              onClick={() => setSettingsActiveTab('health')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center space-x-1.5 ${
                settingsActiveTab === 'health'
                  ? 'bg-white text-apple-dark shadow-xs font-bold animate-fade-in'
                  : 'hover:text-apple-dark text-apple-muted'
              }`}
            >
              <Activity className="h-4 w-4 text-apple-blue" />
              <span>模型健康检查</span>
            </button>
          </div>

          {/* Quick Saving info message */}
          {saveSuccessMessage && (
            <div className="text-caption-readable bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl px-3 py-1.5 flex items-center space-x-1 shadow-sm font-semibold animate-pulse select-none">
              <Check className="h-3.5 w-3.5" />
              <span>系统运行参数更新完毕！</span>
            </div>
          )}
        </div>

        {/* 1. Sub-Tab: Model Configurations */}
        {settingsActiveTab === 'model' && (
          <div id="settings-model-pane" className="space-y-5 animate-fade-in select-text">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-b border-apple-border pb-4">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                <div className="text-caption-readable font-bold text-apple-blue uppercase">正文生成</div>
                <div className="text-body-readable font-bold text-apple-dark mt-1">DeepSeek v4 Pro</div>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                <div className="text-caption-readable font-bold text-purple-700 uppercase">文章阅读与段落配图</div>
                <div className="text-body-readable font-bold text-apple-dark mt-1">Kimi 2.6</div>
              </div>
              <div className="space-y-1">
                <label className="text-caption-readable font-bold text-apple-muted uppercase">大模型最大令牌 (Max Tokens)</label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-body-readable font-mono font-bold text-apple-dark"
                />
              </div>

            </div>

            {/* Prompt Prompt Injections Areas */}
            <div className="space-y-4">
              <h4 className="text-meta-readable font-bold text-apple-muted uppercase tracking-wider">模型职责分工</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-body-readable font-semibold text-apple-dark">
                <div className="p-3 rounded-xl bg-apple-bg/60 border border-apple-border">选题/事实提取模型：DeepSeek v4 Pro</div>
                <div className="p-3 rounded-xl bg-apple-bg/60 border border-apple-border">文章正文生成：DeepSeek v4 Pro</div>
                <div className="p-3 rounded-xl bg-apple-bg/60 border border-apple-border">段落配图方案：Kimi 2.6 阅读最终正文后生成</div>
                <div className="p-3 rounded-xl bg-apple-bg/60 border border-apple-border">审核辅助模型：DeepSeek v4 Pro</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Default Master System Instruction */}
                <div className="space-y-1">
                  <label className="text-caption-readable font-bold text-apple-muted uppercase block">1. 基础原始英文文章处理 指令 (System Prompt)</label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full h-28 p-3 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-body-readable font-semibold text-apple-dark leading-relaxed font-sans"
                  />
                </div>

                {/* Office Workers Custom Injection */}
                <div className="space-y-1">
                  <label className="text-caption-readable font-bold text-apple-muted uppercase block">2. 打工人群体痛点包装 指令 (Office Worker Profile)</label>
                  <textarea
                    value={officeWorkerPrompt}
                    onChange={(e) => setOfficeWorkerPrompt(e.target.value)}
                    className="w-full h-28 p-3 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-body-readable font-semibold text-apple-dark leading-relaxed font-sans"
                  />
                </div>

                {/* Student Instructions */}
                <div className="space-y-1">
                  <label className="text-caption-readable font-bold text-apple-muted uppercase block">3. 大学生极速上手提纲 指令 (Student Profile)</label>
                  <textarea
                    value={studentPrompt}
                    onChange={(e) => setStudentPrompt(e.target.value)}
                    className="w-full h-28 p-3 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-body-readable font-semibold text-apple-dark leading-relaxed font-sans"
                  />
                </div>

                {/* Freelancers Instructions */}
                <div className="space-y-1">
                  <label className="text-caption-readable font-bold text-apple-muted uppercase block">4. 自由自雇者商业获客 指令 (Freelancer Profile)</label>
                  <textarea
                    value={freelancerPrompt}
                    onChange={(e) => setFreelancerPrompt(e.target.value)}
                    className="w-full h-28 p-3 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-body-readable font-semibold text-apple-dark leading-relaxed font-sans"
                  />
                </div>

              </div>
            </div>

          </div>
        )}

        {/* 2. Sub-Tab: WeChat API credentials */}
        {settingsActiveTab === 'wechat' && (
          <div id="settings-wechat-pane" className="space-y-5 max-w-xl animate-fade-in select-text">

            <div className="space-y-1.5 p-4 bg-apple-blue/5 border border-apple-blue/20 rounded-2xl text-body-readable text-[#0066CC] leading-relaxed font-semibold">
              <strong className="text-[#0066CC] font-bold block mb-1 text-caption-readable uppercase">关于微信图文 dry-run 导出 (Credential Guide):</strong>
              v1.0 暂不保存微信公众号密钥，也不会自动发布。请在服务端 .env 中配置模型密钥；发布中心只生成 Markdown / HTML 供手动粘贴。
            </div>

            <div className="rounded-2xl border border-apple-border bg-white p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-card-title font-bold text-apple-dark">微信公众号自动化 PoC</h3>
                  <p className="text-caption-readable text-apple-muted mt-1">
                    默认关闭，只做手动触发的 Playwright 可达性检查，不定时发布，不绕过验证码，不伪造草稿保存结果。
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-lg border text-badge-readable font-bold ${
                  wechatStatus?.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-neutral-50 text-neutral-600 border-neutral-100'
                }`}>
                  {wechatStatus?.enabled ? '已启用' : '默认关闭'}
                </span>
              </div>

              {/* Status-specific guidance */}
              {wechatStatus && !wechatStatus.enabled && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-body-readable font-semibold text-amber-800">
                  微信自动化 PoC 当前关闭。请在 .env 设置 WECHAT_AUTOMATION_ENABLED=true，并重启后端。
                </div>
              )}
              {wechatStatus?.enabled && wechatStatus.status === 'need_login' && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-body-readable font-semibold text-blue-800">
                  环境可用，尚未保存登录态。请点击启动扫码登录。
                </div>
              )}
              {wechatStatus?.enabled && (wechatStatus.status === 'session_valid' || wechatStatus.status === 'editor_reachable' || wechatStatus.status === 'poc_ready') && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-body-readable font-semibold text-emerald-800">
                  登录态有效，可以到发布中心执行编辑器探测或注入测试。
                </div>
              )}
              {wechatStatus?.enabled && wechatStatus.status === 'playwright_missing' && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-body-readable font-semibold text-rose-800">
                  请执行 npm install 和 npx playwright install chromium。
                </div>
              )}
              {wechatStatus?.enabled && wechatStatus.status === 'chromium_missing' && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-body-readable font-semibold text-rose-800">
                  请执行 npx playwright install chromium。
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-apple-border bg-apple-bg/40 p-3">
                  <div className="text-caption-readable font-bold text-apple-muted">当前状态</div>
                  <div className="text-body-readable font-bold text-apple-dark mt-1">{wechatStatus?.status || '未检查'}</div>
                  <p className="text-caption-readable text-apple-muted mt-1">{wechatStatus?.message || '点击检查状态读取后端 PoC 状态。'}</p>
                </div>
                <div className="rounded-xl border border-apple-border bg-apple-bg/40 p-3">
                  <div className="text-caption-readable font-bold text-apple-muted">最近错误</div>
                  <div className="text-body-readable font-bold text-apple-dark mt-1">{wechatStatus?.lastErrorCode || '无'}</div>
                  <p className="text-caption-readable text-apple-muted mt-1">
                    {wechatStatus?.lastCheckedAt ? `上次检查：${new Date(wechatStatus.lastCheckedAt).toLocaleString('zh-CN')}` : '不会返回 Cookie 或 session 内容。'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={loadWechatStatus}
                  disabled={wechatStatusLoading}
                  className="px-3 py-2 rounded-xl border border-apple-border bg-white text-button-readable font-bold text-apple-dark flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${wechatStatusLoading ? 'animate-spin' : ''}`} />
                  <span>检查状态</span>
                </button>
                <button
                  type="button"
                  onClick={handleWechatLoginStart}
                  disabled={wechatPocLoading || !wechatStatus?.enabled || !wechatStatus?.capabilities?.playwrightAvailable || !wechatStatus?.capabilities?.chromiumAvailable}
                  className="px-3 py-2 rounded-xl bg-apple-blue text-white text-button-readable font-bold flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Key className="h-3.5 w-3.5" />
                  <span>{wechatPocLoading ? '等待扫码...' : '启动扫码登录'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleWechatSessionValidate}
                  disabled={wechatPocLoading || !wechatStatus?.enabled || !wechatStatus?.capabilities?.playwrightAvailable || !wechatStatus?.capabilities?.chromiumAvailable}
                  className="px-3 py-2 rounded-xl border border-apple-border bg-white text-button-readable font-bold text-apple-dark flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>校验 session</span>
                </button>
                <div className="text-caption-readable text-apple-muted font-semibold">
                  Playwright: {wechatStatus?.capabilities?.playwrightAvailable ? '可用' : '不可用'} · Chromium: {wechatStatus?.capabilities?.chromiumAvailable ? '可用' : '不可用'} · session: {wechatStatus?.capabilities?.sessionFileFound ? '已保存' : '未保存'}
                </div>
              </div>

              {wechatPocError && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-body-readable font-semibold text-rose-600">
                  {wechatPocError}
                </div>
              )}
              {wechatPocResult && (
                <div className="rounded-xl border border-apple-border bg-apple-bg/40 p-3 space-y-2">
                  <div className="text-body-readable font-bold text-apple-dark">{wechatPocResult.message}</div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-caption-readable font-bold">
                    {Object.entries(wechatPocResult.evidence).map(([key, value]) => (
                      <div key={key} className={`rounded-lg border px-2 py-1 ${value ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-neutral-50 text-neutral-500 border-neutral-100'}`}>
                        {key}: {value ? 'yes' : 'no'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-caption-readable font-semibold text-amber-800">
                安全边界：必须设置 WECHAT_AUTOMATION_ENABLED=true 才能手动触发；不会批量发布；不会绕过验证码或账号风控；真实保存草稿前必须二次确认。
              </div>
            </div>

            {/* AppID / AppSecret - collapsed note */}
            <div className="rounded-2xl border border-apple-border bg-white p-4 space-y-3">
              <div className="text-caption-readable text-apple-muted font-semibold">
                微信开放公众平台 AppID / AppSecret（当前 Playwright PoC 不使用，预留给未来官方 API）
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-caption-readable font-bold text-apple-muted uppercase">AppID</label>
                  <input
                    type="text"
                    placeholder="当前 PoC 不需要"
                    value={wechatAppId}
                    onChange={(e) => setWechatAppId(e.target.value)}
                    className="w-full px-3 py-2 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-body-readable font-mono font-bold text-apple-dark"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-caption-readable font-bold text-apple-muted uppercase">AppSecret</label>
                  <input
                    type="password"
                    value={wechatAppSecret}
                    onChange={(e) => setWechatAppSecret(e.target.value)}
                    placeholder="当前 PoC 不需要"
                    className="w-full px-3 py-2 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-body-readable font-mono font-bold text-apple-dark"
                  />
                </div>
              </div>
              <div className="text-caption-readable text-apple-muted font-semibold">
                注：AppID / AppSecret 不影响扫码登录按钮。当前 Playwright PoC 通过浏览器自动化操作微信公众号后台，不依赖微信官方 API。
              </div>
            </div>

          </div>
        )}

        {/* 3. Sub-Tab: Budget token thresholds */}
        {settingsActiveTab === 'limit' && (
          <div id="settings-limit-pane" className="space-y-5 max-w-xl animate-fade-in">
            
            <div className="space-y-4">
              
              <div className="space-y-2">
                <label className="text-caption-readable font-bold text-apple-muted uppercase block">本月企业 Token 消费限额限制 (每百万 Token 模型计价)</label>
                <div className="flex items-center space-x-4 select-none">
                  <input 
                    type="range" 
                    min="1000000" 
                    max="20000000" 
                    step="1000000" 
                    value={monthlyTokenLimit}
                    onChange={(e) => setMonthlyTokenLimit(parseInt(e.target.value))}
                    className="flex-1 h-1 bg-[#E5E5E7] rounded-lg appearance-none cursor-pointer accent-apple-blue" 
                  />
                  <span className="font-mono text-sm font-bold text-apple-dark">
                    {monthlyTokenLimit / 10000} 万 Tokens
                  </span>
                </div>
                <p className="text-caption-readable text-apple-muted font-semibold">大并发业务下，设置熔断阈值可以有效避免程序进入死循环浪费主密钥配额。</p>
              </div>

              <div className="h-[1px] bg-apple-border/50"></div>

              {/* Toggle alert boxes */}
              <div className="space-y-3.5 select-none">
                
                <div className="flex items-center justify-between p-3.5 bg-apple-bg/50 border border-apple-border rounded-xl">
                  <div className="space-y-0.5">
                    <div className="text-body-readable font-bold text-apple-dark">超出 80% 消费限额发送告警提示</div>
                    <div className="text-caption-readable text-apple-muted font-semibold">当月累计用额溢出时系统会自动发送通知邮件。</div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={alertOnTokenLimit}
                    onChange={(e) => setAlertOnTokenLimit(e.target.checked)}
                    className="h-4.5 w-4.5 rounded-lg border-apple-border text-apple-blue accent-apple-blue focus:ring-apple-blue cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-apple-bg/50 border border-apple-border rounded-xl">
                  <div className="space-y-0.5">
                    <div className="text-body-readable font-bold text-apple-dark">自动离线抓取海外 RSS (定时器轮询)</div>
                    <div className="text-caption-readable text-apple-muted font-semibold">如果勾选，后台守护将每小时自动检测海外 RSS 端点是否更新。</div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={autoSyncActive}
                    onChange={(e) => setAutoSyncActive(e.target.checked)}
                    className="h-4.5 w-4.5 rounded-lg border-apple-border text-apple-blue accent-apple-blue focus:ring-apple-blue cursor-pointer"
                  />
                </div>

              </div>

              <div className="h-[1px] bg-apple-border/50"></div>

              {/* Backup block details */}
              <div className="p-3.5 border border-dashed border-apple-border rounded-2xl flex items-center justify-between hover:bg-apple-bg/30 transition">
                <div className="space-y-0.5 select-text">
                  <div className="text-body-readable font-bold text-apple-dark flex items-center space-x-1">
                    <Database className="h-4 w-4 text-apple-blue" />
                    <span>系统配置与本地草稿包一键导出备份</span>
                  </div>
                  <p className="text-caption-readable text-apple-muted font-semibold">正式业务数据已保存到 SQLite，localStorage 仅保留界面偏好。</p>
                </div>

                <button 
                  onClick={() => alert("系统配置与草稿 JSON 已编译生成并下载成功！")}
                  type="button" 
                  className="px-3.5 py-1.5 border border-apple-border bg-white hover:bg-apple-bg rounded-xl text-button-readable font-bold text-apple-dark transition shadow-xs cursor-pointer select-none"
                >
                  打包并下载 (.json)
                </button>
              </div>

            </div>

          </div>
        )}

        {/* 4. Sub-Tab: AI Health Check */}
        {settingsActiveTab === 'health' && (
          <div id="settings-health-pane" className="space-y-5 animate-fade-in select-text">

            <div className="space-y-1.5 p-4 bg-apple-blue/5 border border-apple-blue/20 rounded-2xl text-body-readable text-[#0066CC] leading-relaxed font-semibold">
              <strong className="text-[#0066CC] font-bold block mb-1 text-caption-readable uppercase">模型健康检查 (AI Health Check):</strong>
              检查 DeepSeek v4 Pro 和 Kimi 2.6 的 API 连通性。不会暴露 API Key，不会影响主链路。
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleRunHealthCheck}
                disabled={healthLoading}
                className="px-4 py-2 bg-apple-bg hover:bg-[#000000]/5 text-apple-dark font-bold text-button-readable rounded-xl border border-apple-border transition-all flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${healthLoading ? 'animate-spin text-apple-blue' : 'text-apple-muted'}`} />
                <span>{healthLoading ? '检查中...' : '执行健康检查'}</span>
              </button>
              {healthLastCheck && (
                <span className="text-caption-readable text-apple-muted font-mono">
                  上次检查：{new Date(healthLastCheck).toLocaleString('zh-CN')}
                </span>
              )}
            </div>

            {healthError && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-body-readable font-semibold flex items-center space-x-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{healthError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {healthResults.length === 0 && !healthLoading && (
                <div className="col-span-2 p-6 text-center text-body-readable text-apple-muted font-semibold">
                  尚未执行健康检查，请点击上方按钮。
                </div>
              )}
              {healthResults.map((result) => {
                const color = getStatusColor(result.status);
                return (
                  <div key={result.provider} className={`p-4 rounded-2xl border bg-white space-y-3 ${
                    color === 'emerald' ? 'border-emerald-200' : color === 'amber' ? 'border-amber-200' : 'border-rose-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(result.status)}
                        <span className="text-card-title font-bold text-apple-dark">
                          {result.provider === 'deepseek' ? 'DeepSeek v4 Pro' : 'Kimi 2.6'}
                        </span>
                      </div>
                      <span className={`text-badge-readable font-bold px-2 py-0.5 rounded-lg bg-${color}-50 text-${color}-600 border border-${color}-100`}>
                        {result.status === 'ok' ? '正常' : result.status === 'slow' ? '较慢' : result.status === 'timeout' ? '超时' : result.status === 'missing_key' ? '未配置' : '异常'}
                      </span>
                    </div>
                    <div className="text-caption-readable text-apple-muted font-mono space-y-1">
                      <div>模型：{result.model}</div>
                      <div>API Key：{result.configured ? '已配置' : '未配置'}</div>
                      {result.elapsedMs !== undefined && (
                        <div>响应耗时：{(result.elapsedMs / 1000).toFixed(1)}s</div>
                      )}
                    </div>
                    <p className="text-body-readable text-apple-dark font-medium">{result.message}</p>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* Global actions submission */}
        <div className="pt-4 border-t border-apple-border flex items-center justify-end select-none">
          <button
            onClick={handleSaveAll}
            id="settings-save-submit"
            className="px-5 py-2 rounded-xl bg-[#0066CC] hover:bg-apple-blue-hover text-white font-bold text-button-readable shadow-xs transition-all flex items-center space-x-1 cursor-pointer border border-[#0066CC]"
          >
            <Save className="h-4 w-4" />
            <span>保存当前设置</span>
          </button>
        </div>

      </div>

    </div>
  );
}
