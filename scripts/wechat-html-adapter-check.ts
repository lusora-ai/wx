import { adaptHtmlForWechat } from '../server/services/wechat/wechatHtmlAdapter';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const result = adaptHtmlForWechat({
  html: '<h1>标题</h1><script>alert(1)</script><iframe src="x"></iframe><p>正文<strong>重点</strong></p>',
  privateDomainCta: '关注小顺，获取后续内容。',
});

assert(!/script/i.test(result.html), 'script tag should be removed');
assert(!/iframe/i.test(result.html), 'iframe tag should be removed');
assert(result.html.includes('关注小顺'), 'private domain CTA should be appended');
assert(result.textFallback.includes('正文'), 'text fallback should keep readable text');

console.log(JSON.stringify({
  ok: true,
  warnings: result.warnings,
  htmlLength: result.html.length,
  textLength: result.textFallback.length,
}, null, 2));
