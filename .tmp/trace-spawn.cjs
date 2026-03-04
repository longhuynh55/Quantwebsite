console.error('[trace-spawn] loaded');
const childProcess = require("node:child_process");

function wrap(name) {
  const original = childProcess[name];
  if (typeof original !== "function") return;
  childProcess[name] = function patched(file, args, options) {
    try {
      const safeArgs = Array.isArray(args) ? args : [];
      const opts = options && typeof options === 'object' ? options : undefined;
      console.error(`[trace-spawn] ${name}`, { file, args: safeArgs, cwd: opts && opts.cwd ? opts.cwd : undefined, shell: opts && opts.shell ? opts.shell : undefined });
    } catch {}
    return original.apply(this, arguments);
  };
}

wrap("spawn");
wrap("spawnSync");
wrap("execFile");
wrap("execFileSync");
