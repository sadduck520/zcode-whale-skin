/* ZCode 鲸鱼娘皮肤 · 运行时自适应层
   Ctrl+Alt+1 深海女仆工坊 / Ctrl+Alt+2 虎鲸链路 / Ctrl+Alt+0 默认
   localStorage 键 zcode.skin = "maid" | "orca" | "" */
(function () {
  if (window.__zcodeSkinLoaded) return;
  window.__zcodeSkinLoaded = true;

  var KEY = "zcode.skin";
  var NAMES = { maid: "皮肤：深海女仆工坊", orca: "皮肤：虎鲸链路", "": "皮肤：默认" };
  var state = {
    on: false,
    skin: "",
    overlay: null,
    touched: [], // [el, originalStyleAttr]
    observer: null,
    timer: null,
    interval: null,
  };

  function enabled() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "maid" || v === "orca" ? v : "";
    } catch (e) {
      return "";
    }
  }

  function applyAttr() {
    if (state.on && state.skin) document.documentElement.setAttribute("data-zskin", state.skin);
    else document.documentElement.removeAttribute("data-zskin");
  }

  /* ---------- toast ---------- */
  var toastEl = null;
  function toast(msg) {
    if (!document.body) return;
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.style.cssText =
        "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);" +
        "z-index:2147483647;padding:6px 14px;border-radius:999px;" +
        "background:rgba(16,32,77,.9);color:#f2ecd9;pointer-events:none;" +
        "font:12px/1.6 system-ui,'Segoe UI','Microsoft YaHei',sans-serif;" +
        "border:1px solid rgba(197,164,104,.5);transition:opacity .25s;opacity:0";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = "1";
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      toastEl.style.opacity = "0";
    }, 1600);
  }

  /* ---------- 舞台层：铺满全窗，底色为主题背景色；立绘由 ::before/::after 承载，
     用 --zskin-clip 裁剪到对话区（CSS 侧） ---------- */
  function ensureStage() {
    if (state.overlay || !document.body) return;
    var d = document.createElement("div");
    d.setAttribute("data-zskin-stage", "");
    if (document.body.firstChild) document.body.insertBefore(d, document.body.firstChild);
    else document.body.appendChild(d);
    state.overlay = d;
  }
  function removeStage() {
    if (state.overlay && state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
    state.overlay = null;
  }

  /* ---------- 收集清理目标 ----------
   A) 输入框（textarea/contenteditable）的所有"高个子"祖先
   B) #root 下所有"整页大小"的背景层
   关键：React 重渲染会抹掉内联覆盖（每次 pass 重设），React 复用节点时
   还会改自己的样式——所以绝不能快照/还原整个 style 属性，只记录并只动
   background-color / background-image 两个属性，离开时精确还原这两个。 */
  function collectTargets() {
    var targets = [];
    var push = function (el) {
      if (targets.indexOf(el) < 0 && el.getAttribute) targets.push(el);
    };
    var ta = document.querySelector("textarea, [contenteditable=true]");
    if (ta) {
      var el = ta.parentElement;
      while (el && el !== document.body) {
        if (el.getBoundingClientRect().height > window.innerHeight * 0.5) push(el);
        el = el.parentElement;
      }
    }
    var rootEl = document.getElementById("root");
    if (rootEl) {
      var vw = window.innerWidth, vh = window.innerHeight;
      var els = rootEl.querySelectorAll("div,main,section,aside,header");
      for (var i = 0; i < els.length; i++) {
        var r = els[i].getBoundingClientRect();
        if (r.width > vw * 0.55 && r.height > vh * 0.55) push(els[i]);
      }
      push(rootEl);
    }
    return targets;
  }
  function recordOriginal(el) {
    return [
      el.style.getPropertyValue("background-color"),
      el.style.getPropertyPriority("background-color"),
      el.style.getPropertyValue("background-image"),
      el.style.getPropertyPriority("background-image"),
    ];
  }
  function restoreOriginal(el, rec) {
    if (rec[0]) el.style.setProperty("background-color", rec[0], rec[1]);
    else el.style.removeProperty("background-color");
    if (rec[2]) el.style.setProperty("background-image", rec[2], rec[3]);
    else el.style.removeProperty("background-image");
  }
  function applyPass() {
    var targets = collectTargets();
    /* 离开目标集的容器：只精确移除我们设置的两个属性 */
    state.touched = state.touched.filter(function (t) {
      if (targets.indexOf(t[0]) >= 0 && t[0].isConnected) return true;
      if (t[0].isConnected) restoreOriginal(t[0], t[1]);
      return false;
    });
    targets.forEach(function (el) {
      var rec = null;
      for (var i = 0; i < state.touched.length; i++) {
        if (state.touched[i][0] === el) { rec = state.touched[i][1]; break; }
      }
      if (!rec) {
        rec = recordOriginal(el);
        state.touched.push([el, rec]);
      }
      /* 无条件重设——React 抹一次我们补一次 */
      el.style.setProperty("background-color", "transparent", "important");
      el.style.setProperty("background-image", "none", "important");
    });
  }

  /* ---------- 立绘裁剪：探测侧栏右边缘 ---------- */
  function findSidebarRight() {
    var probes = ["新建任务", "搜索", "新任务", "New Task"];
    for (var p = 0; p < probes.length; p++) {
      var els = document.querySelectorAll("button, a, div[role=button]");
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if ((el.textContent || "").trim().indexOf(probes[p]) !== 0) continue;
        var r = el.getBoundingClientRect();
        if (r.width <= 0 || r.left > window.innerWidth * 0.5) continue;
        var side = el.parentElement;
        while (side && side !== document.body) {
          var sr = side.getBoundingClientRect();
          if (sr.height > window.innerHeight * 0.8 && sr.width < window.innerWidth * 0.6) {
            return sr.right;
          }
          side = side.parentElement;
        }
        return r.right;
      }
    }
    return null;
  }
  function clipPass() {
    if (!state.overlay) return;
    var left = findSidebarRight();
    if (left === null || left < 0 || left > window.innerWidth * 0.6) left = 0;
    state.clip = Math.round(left) + "px";
    /* 立绘图层（::before/::after）的左右边界 = 对话区；女仆锚定区内边缘 */
    state.overlay.style.setProperty("--zskin-inset-l", Math.round(left) + "px");
    state.overlay.style.setProperty("--zskin-inset-r", "0px");
  }

  /* ---------- 恢复 ---------- */
  function restoreAll() {
    state.touched.forEach(function (t) {
      if (t[0].isConnected) restoreOriginal(t[0], t[1]);
    });
    state.touched = [];
  }

  /* ---------- 调度 ---------- */
  function runPasses() {
    if (!state.on) return;
    try {
      ensureStage();
      applyPass();
      clipPass();
    } catch (e) {}
  }
  function schedule() {
    clearTimeout(state.timer);
    state.timer = setTimeout(runPasses, 300);
  }

  function turnOn() {
    state.on = true;
    state.skin = enabled();
    applyAttr();
    runPasses();
    window.addEventListener("resize", runPasses);
    if (!state.observer && window.MutationObserver) {
      state.observer = new MutationObserver(schedule);
      state.observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    }
    /* 兜底定时器：无论观察器是否漏事件，挂载后最多 2 秒立绘必然出现 */
    if (!state.interval) state.interval = setInterval(runPasses, 2000);
  }
  function turnOff() {
    state.on = false;
    if (state.observer) { state.observer.disconnect(); state.observer = null; }
    window.removeEventListener("resize", runPasses);
    if (state.interval) { clearInterval(state.interval); state.interval = null; }
    clearTimeout(state.timer);
    restoreAll();
    removeStage();
    applyAttr();
  }

  /* ---------- 快捷键 ---------- */
  window.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey) {
      var map = { 1: "maid", 2: "orca", 0: "" };
      var v = Object.prototype.hasOwnProperty.call(map, e.key) ? map[e.key] : null;
      if (v === null) return;
      try { localStorage.setItem(KEY, v); } catch (err) {}
      turnOff();
      if (v) turnOn();
      toast(NAMES[v]);
    }
  });

  /* ---------- 启动 ---------- */
  function boot() {
    if (enabled()) turnOn();
    /* SPA 异步挂载，前几秒多试几次 */
    [800, 2000, 4000].forEach(function (t) { setTimeout(function () { if (state.on) runPasses(); }, t); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
