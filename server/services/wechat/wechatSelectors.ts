export type WechatSelectorTarget =
  | 'qrCode'
  | 'accountHome'
  | 'newDraftEntry'
  | 'titleInput'
  | 'editor'
  | 'saveButton'
  | 'saveSuccess'
  | 'captchaOrRisk'
  | 'wechatWordCount';

export type WechatSelectorCandidate = {
  name: string;
  selector: string;
  description: string;
};

export type WechatSelectorResolution = {
  found: boolean;
  strategy: string | null;
  selector: string | null;
  count: number;
  error: string | null;
};

export const wechatSelectors: Record<WechatSelectorTarget, WechatSelectorCandidate[]> = {
  titleInput: [
    { name: 'title-placeholder', selector: 'textarea[placeholder*="标题"], input[placeholder*="标题"]', description: '标题 placeholder' },
    { name: 'title-id', selector: '#title, #js_title, #appmsg_title', description: '常见标题 id' },
    { name: 'title-class', selector: '.input_title, .js_title, .frm_input[placeholder*="标题"]', description: '常见标题 class' },
    { name: 'title-contenteditable', selector: '[contenteditable="true"][data-placeholder*="标题"]', description: '标题 contenteditable' },
    { name: 'title-aria', selector: '[aria-label*="标题"]', description: '标题 aria label' },
    { name: 'title-form-control', selector: '[class*="title"] textarea, [class*="title"] input', description: '标题区域表单控件' },
  ],
  editor: [
    { name: 'js-editor', selector: '#js_editor, .js_editor, .edui-editor-iframeholder iframe', description: '微信编辑器常见容器' },
    { name: 'article-contenteditable', selector: '[class*="article"] [contenteditable="true"], [class*="editor"] [contenteditable="true"]', description: '编辑区内 contenteditable' },
    { name: 'appmsg-editor', selector: '#js_appmsg_editor [contenteditable="true"], [id*="appmsg"] [contenteditable="true"]', description: '图文编辑器 contenteditable' },
    { name: 'prosemirror', selector: '.ProseMirror, [data-slate-editor="true"]', description: '现代富文本编辑器容器' },
    { name: 'ueditor-iframe', selector: 'iframe[id*="ueditor"], iframe[src*="appmsg"]', description: '旧版 UEditor iframe' },
    { name: 'contenteditable', selector: '[contenteditable="true"]', description: '可编辑正文容器' },
  ],
  saveButton: [
    { name: 'button-save-text', selector: 'button:has-text("保存"), a:has-text("保存")', description: '保存按钮文字' },
    { name: 'draft-text', selector: 'button:has-text("存为草稿"), a:has-text("存为草稿")', description: '存为草稿按钮文字' },
    { name: 'publish-draft-text', selector: 'button:has-text("保存为草稿"), a:has-text("保存为草稿")', description: '保存为草稿按钮文字' },
    { name: 'save-class', selector: '.js_save, .btn_save, [class*="save"]', description: '保存按钮 class' },
    { name: 'submit-primary', selector: '.weui-desktop-btn_primary, button[type="submit"]', description: '主操作按钮' },
  ],
  qrCode: [
    { name: 'login-qrcode', selector: 'img[src*="qrcode"], .login__type__container__scan__qrcode, .qrcode', description: '登录二维码' },
    { name: 'scan-text', selector: 'text=扫码', description: '扫码提示文字' },
    { name: 'qr-canvas', selector: 'canvas', description: '二维码 canvas' },
  ],
  accountHome: [
    { name: 'backend-layout', selector: '.weui-desktop-layout, .weui-desktop-layout__main, #js_container_box', description: '公众号后台布局容器' },
    { name: 'home-text', selector: 'text=首页', description: '后台首页文字' },
    { name: 'new-creation-text', selector: 'text=新的创作', description: '新的创作入口文字' },
    { name: 'material-text', selector: 'text=素材库', description: '素材库文字' },
    { name: 'mp-header', selector: '.weui-desktop-account, .weui-desktop-layout__header, [class*="account"]', description: '公众号后台头部' },
  ],
  newDraftEntry: [
    { name: 'new-creation-text', selector: 'a:has-text("新的创作"), button:has-text("新的创作")', description: '新的创作入口' },
    { name: 'new-article-text', selector: 'a:has-text("写新图文"), button:has-text("写新图文"), a:has-text("新建图文"), button:has-text("新建图文")', description: '新建图文入口' },
    { name: 'draft-material-text', selector: 'a:has-text("草稿箱"), button:has-text("草稿箱"), a:has-text("图文消息"), button:has-text("图文消息")', description: '草稿/图文入口' },
    { name: 'create-class', selector: '.js_new_appmsg, .new_appmsg, [class*="create"] [href*="appmsg"]', description: '常见新建图文 class' },
  ],
  saveSuccess: [
    { name: 'save-success-text', selector: 'text=保存成功', description: '保存成功提示' },
    { name: 'saved-text', selector: 'text=已保存', description: '已保存提示' },
    { name: 'draft-save-success-text', selector: 'text=保存草稿成功', description: '保存草稿成功提示' },
    { name: 'draft-saved-text', selector: 'text=草稿已保存', description: '草稿已保存提示' },
    { name: 'notification-save-success', selector: '[role="alert"]:has-text("保存"), [role="status"]:has-text("保存"), .weui-desktop-tips:has-text("保存"), .weui-desktop-dialog:has-text("保存")', description: 'toast/message/modal 保存提示' },
    { name: 'save-button-state', selector: 'button:has-text("已保存"), a:has-text("已保存"), button[disabled]:has-text("保存")', description: '保存按钮状态变化' },
    { name: 'toast-success', selector: '.weui-desktop-tips_success, .weui-desktop-toast, [class*="success"]:has-text("保存")', description: '成功 toast' },
  ],
  captchaOrRisk: [
    { name: 'captcha-text', selector: 'text=验证码', description: '验证码提示' },
    { name: 'security-text', selector: 'text=安全验证', description: '安全验证提示' },
    { name: 'account-risk-text', selector: 'text=账号风险', description: '账号风险提示' },
    { name: 'security-risk-text', selector: 'text=安全风险', description: '安全风险提示' },
    { name: 'abnormal-login-text', selector: 'text=登录异常', description: '登录异常提示' },
    { name: 'captcha-frame', selector: 'iframe[src*="captcha"], iframe[src*="security"]', description: '安全验证 iframe' },
  ],
  wechatWordCount: [
    { name: 'word-count-text', selector: 'text=/正文字数[：:\\s]*\\d+/', description: '正文字数文本' },
    { name: 'word-count-class', selector: '[class*="word-count"], [class*="wordcount"], [class*="char-count"]', description: '字数统计 class' },
    { name: 'editor-footer', selector: '[class*="editor-footer"], [class*="status-bar"], [class*="toolbar-bottom"]', description: '编辑器底部状态栏' },
  ],
};

export async function firstVisibleLocator(page: any, target: WechatSelectorTarget) {
  const report: Record<string, WechatSelectorResolution> = {};
  for (const candidate of wechatSelectors[target]) {
    try {
      const locator = page.locator(candidate.selector);
      let count = await locator.count();
      if (count === 0) {
        await locator.first().waitFor({ state: 'attached', timeout: 800 }).catch(() => undefined);
        count = await locator.count();
      }
      if (count > 0) {
        report[candidate.name] = { found: true, strategy: candidate.name, selector: candidate.selector, count, error: null };
        return { locator: locator.first(), candidate, report, resolution: report[candidate.name] };
      }
      report[candidate.name] = { found: false, strategy: candidate.name, selector: candidate.selector, count, error: null };
    } catch (error) {
      report[candidate.name] = {
        found: false,
        strategy: candidate.name,
        selector: candidate.selector,
        count: 0,
        error: error instanceof Error ? error.message : 'selector failed',
      };
    }
  }
  return { locator: null, candidate: null, report, resolution: { found: false, strategy: null, selector: null, count: 0, error: null } };
}
