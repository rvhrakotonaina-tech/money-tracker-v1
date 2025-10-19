(function(){
  const COOKIE_NAME = 'lang';
  const COOKIE_DAYS = 365;
  const PARAM = 'lang';
  const DEFAULT_LANG = 'en';
  let messages = {};
  let current = DEFAULT_LANG;

  function getCookie(name){
    const m = document.cookie.match('(?:^|; )'+name+'=([^;]*)');
    return m ? decodeURIComponent(m[1]) : '';
  }
  function setCookie(name, value, days){
    const d = new Date();
    d.setTime(d.getTime() + days*24*60*60*1000);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/`;
  }
  function getParam(name){
    const u = new URL(window.location.href);
    return u.searchParams.get(name) || '';
  }
  function setParam(name, value){
    const u = new URL(window.location.href);
    u.searchParams.set(name, value);
    history.replaceState({}, '', u.toString());
  }

  function interpolate(str, params){
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : ''));
  }

  function t(key, params){
    const msg = messages[key];
    if (!msg) return key;
    return interpolate(msg, params);
  }

  async function loadLang(lang){
    try {
      const res = await fetch(`./locales/${lang}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error('load');
      messages = await res.json();
      current = lang;
      document.documentElement.setAttribute('lang', lang);
      document.title = messages.app_title || document.title;
    } catch (e) {
      if (lang !== DEFAULT_LANG) return loadLang(DEFAULT_LANG);
    }
  }

  function applyTranslations(){
    // text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    // attributes
    document.querySelectorAll('[data-i18n-attr-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-attr-placeholder');
      el.setAttribute('placeholder', t(key));
    });
    document.querySelectorAll('[data-i18n-attr-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-attr-title');
      el.setAttribute('title', t(key));
    });
    // update language switcher active state
    const sw = document.getElementById('langSwitch');
    if (sw){
      sw.querySelectorAll('button[data-lang]').forEach(btn => {
        const isActive = btn.getAttribute('data-lang') === current;
        btn.classList.toggle('bg-slate-900', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('bg-white', !isActive);
      });
    }
  }

  async function setLang(lang){
    await loadLang(lang);
    setParam(PARAM, lang);
    setCookie(COOKIE_NAME, lang, COOKIE_DAYS);
    applyTranslations();
    // notify app code to re-render dynamic strings if needed
    document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
  }

  async function init(){
    const fromParam = (getParam(PARAM) || '').toLowerCase();
    const fromCookie = (getCookie(COOKIE_NAME) || '').toLowerCase();
    const lang = (fromParam === 'en' || fromParam === 'fr') ? fromParam : ((fromCookie === 'en' || fromCookie === 'fr') ? fromCookie : DEFAULT_LANG);
    await loadLang(lang);
    applyTranslations();

    // wire switcher
    const sw = document.getElementById('langSwitch');
    if (sw){
      sw.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-lang]');
        if (!btn) return;
        const l = btn.getAttribute('data-lang');
        if (l && l !== current) setLang(l);
      });
    }

    // expose
    window.i18n = { t, setLang, get lang(){ return current; } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
