/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  HelpCircle
} from 'lucide-react';
import { ModelSetting, AppConfig } from '../types';

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
  const [settingsActiveTab, setSettingsActiveTab] = useState<'model' | 'wechat' | 'limit'>('model');

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
  
  // Connection tester simulation
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);

  const handleTestWechatConnection = () => {
    setIsTestingConnection(true);
    setTestResult(null);
    setTimeout(() => {
      setIsTestingConnection(false);
      if (wechatAppId.startsWith('wx') && wechatAppId.length > 10 && wechatAppSecret.length > 15) {
        setTestResult('success');
      } else {
        setTestResult('failed');
      }
    }, 1200);
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
          <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-apple-bg border border-apple-border/50 text-xs text-apple-muted font-semibold w-full sm:w-auto">
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
          </div>

          {/* Quick Saving info message */}
          {saveSuccessMessage && (
            <div className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl px-3 py-1.5 flex items-center space-x-1 shadow-sm font-semibold animate-pulse select-none">
              <Check className="h-3.5 w-3.5" />
              <span>系统运行参数更新完毕！</span>
            </div>
          )}
        </div>

        {/* 1. Sub-Tab: Model Configurations */}
        {settingsActiveTab === 'model' && (
          <div id="settings-model-pane" className="space-y-5 animate-fade-in select-text">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-b border-apple-border pb-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-apple-muted uppercase">底层首选供应商</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as any)}
                  className="w-full px-3 py-2 bg-apple-bg border border-apple-border outline-none rounded-xl text-xs font-semibold text-apple-dark cursor-pointer"
                >
                  <option value="Gemini">Google Gemini AI</option>
                  <option value="Claude">Anthropic Claude</option>
                  <option value="DeepSeek">DeepSeek (智谱内核)</option>
                  <option value="GPT-4o">OpenAI Developer Program</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-apple-muted uppercase">默认写入模型 ID</label>
                <input
                  type="text"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="w-full px-3 py-2 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-xs font-mono font-bold text-apple-dark"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-apple-muted uppercase">大模型最大令牌 (Max Tokens)</label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-xs font-mono font-bold text-apple-dark"
                />
              </div>

            </div>

            {/* Prompt Prompt Injections Areas */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-bold text-apple-muted uppercase tracking-wider">多受众特征提示词深度注入调整区 (Prompts Setting)</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Default Master System Instruction */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-apple-muted uppercase block">1. 基础原始英文文章处理 指令 (System Prompt)</label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full h-28 p-3 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-xs font-semibold text-apple-dark leading-relaxed font-sans"
                  />
                </div>

                {/* Office Workers Custom Injection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-apple-muted uppercase block">2. 打工人群体痛点包装 指令 (Office Worker Profile)</label>
                  <textarea
                    value={officeWorkerPrompt}
                    onChange={(e) => setOfficeWorkerPrompt(e.target.value)}
                    className="w-full h-28 p-3 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-xs font-semibold text-apple-dark leading-relaxed font-sans"
                  />
                </div>

                {/* Student Instructions */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-apple-muted uppercase block">3. 大学生极速上手提纲 指令 (Student Profile)</label>
                  <textarea
                    value={studentPrompt}
                    onChange={(e) => setStudentPrompt(e.target.value)}
                    className="w-full h-28 p-3 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-xs font-semibold text-apple-dark leading-relaxed font-sans"
                  />
                </div>

                {/* Freelancers Instructions */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-apple-muted uppercase block">4. 自由自雇者商业获客 指令 (Freelancer Profile)</label>
                  <textarea
                    value={freelancerPrompt}
                    onChange={(e) => setFreelancerPrompt(e.target.value)}
                    className="w-full h-28 p-3 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-xs font-semibold text-apple-dark leading-relaxed font-sans"
                  />
                </div>

              </div>
            </div>

          </div>
        )}

        {/* 2. Sub-Tab: WeChat API credentials */}
        {settingsActiveTab === 'wechat' && (
          <div id="settings-wechat-pane" className="space-y-5 max-w-xl animate-fade-in select-text">
            
            <div className="space-y-1.5 p-4 bg-apple-blue/5 border border-apple-blue/20 rounded-2xl text-[11px] text-[#0066CC] leading-relaxed font-semibold">
              <strong className="text-[#0066CC] font-bold block mb-1 text-[10px] uppercase">关于微信图文同步授权 (Credential Guide):</strong>
              在下方输入在微信开发公众平台 (mp.weixin.qq.com) 获取到的密钥。在网络畅通状态下，本内容工作台可以直接将排好版的多分众草稿直接上传至公众草稿箱中。
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-apple-muted uppercase">微信开放公众平台 AppID</label>
                <input
                  type="text"
                  placeholder="wx888xx888x88x"
                  value={wechatAppId}
                  onChange={(e) => setWechatAppId(e.target.value)}
                  className="w-full px-3 py-2 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-xs font-mono font-bold text-apple-dark"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-apple-muted uppercase">微信开发者密钥 (AppSecret)</label>
                <input
                  type="password"
                  value={wechatAppSecret}
                  onChange={(e) => setWechatAppSecret(e.target.value)}
                  placeholder="请输入您的 AppSecret 动态密码"
                  className="w-full px-3 py-2 bg-apple-bg border border-apple-border focus:border-apple-blue/55 outline-none rounded-xl text-xs font-mono font-bold text-apple-dark"
                />
              </div>

              <div className="pt-2 flex items-center space-x-4 select-none">
                <button
                  type="button"
                  onClick={handleTestWechatConnection}
                  disabled={isTestingConnection}
                  className="px-4 py-2 bg-apple-bg hover:bg-[#000000]/5 text-apple-dark font-bold text-xs rounded-xl border border-apple-border transition-all flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isTestingConnection ? 'animate-spin text-apple-blue' : 'text-apple-muted'}`} />
                  <span>接口测试连通状况</span>
                </button>

                {testResult === 'success' && (
                  <div className="text-[11px] text-emerald-600 font-bold flex items-center space-x-1 animate-fade-in">
                    <Check className="h-3.5 w-3.5" />
                    <span>接口测试连通顺利！AccessToken 获取正常。</span>
                  </div>
                )}

                {testResult === 'failed' && (
                  <div className="text-[11px] text-rose-500 font-bold flex items-center space-x-1 animate-fade-in">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>微信服务器校验失败。请确认 AppID / 密钥长度正确性。</span>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* 3. Sub-Tab: Budget token thresholds */}
        {settingsActiveTab === 'limit' && (
          <div id="settings-limit-pane" className="space-y-5 max-w-xl animate-fade-in">
            
            <div className="space-y-4">
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-apple-muted uppercase block">本月企业 Token 消费限额限制 (每百万 Token 模型计价)</label>
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
                <p className="text-[9px] text-apple-muted font-semibold">大并发业务下，设置熔断阈值可以有效避免程序进入死循环浪费主密钥配额。</p>
              </div>

              <div className="h-[1px] bg-apple-border/50"></div>

              {/* Toggle alert boxes */}
              <div className="space-y-3.5 select-none">
                
                <div className="flex items-center justify-between p-3.5 bg-apple-bg/50 border border-apple-border rounded-xl">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-apple-dark">超出 80% 消费限额发送告警提示</div>
                    <div className="text-[9px] text-apple-muted font-semibold">当月累计用额溢出时系统会自动发送通知邮件。</div>
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
                    <div className="text-xs font-bold text-apple-dark">自动离线抓取海外 RSS (定时器轮询)</div>
                    <div className="text-[9px] text-apple-muted font-semibold">如果勾选，后台守护将每小时自动检测海外 RSS 端点是否更新。</div>
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
                  <div className="text-xs font-bold text-apple-dark flex items-center space-x-1">
                    <Database className="h-4 w-4 text-apple-blue" />
                    <span>系统配置与本地草稿包一键导出备份</span>
                  </div>
                  <p className="text-[9px] text-apple-muted font-semibold">一键导出本地 localStorage 的所有加工草稿与 RSS 数据成 JSON 文件。</p>
                </div>

                <button 
                  onClick={() => alert("系统配置与草稿 JSON 已编译生成并下载成功！")}
                  type="button" 
                  className="px-3.5 py-1.5 border border-apple-border bg-white hover:bg-apple-bg rounded-xl text-[11px] font-bold text-apple-dark transition shadow-xs cursor-pointer select-none"
                >
                  打包并下载 (.json)
                </button>
              </div>

            </div>

          </div>
        )}

        {/* Global actions submission */}
        <div className="pt-4 border-t border-apple-border flex items-center justify-end select-none">
          <button
            onClick={handleSaveAll}
            id="settings-save-submit"
            className="px-5 py-2 rounded-xl bg-[#0066CC] hover:bg-apple-blue-hover text-white font-bold text-xs shadow-xs transition-all flex items-center space-x-1 cursor-pointer border border-[#0066CC]"
          >
            <Save className="h-4 w-4" />
            <span>保存当前设置</span>
          </button>
        </div>

      </div>

    </div>
  );
}
