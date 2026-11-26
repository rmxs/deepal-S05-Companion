"""List static English error messages the backend raises that the UI may show verbatim.

Scans the backend modules with ast for string literals passed to ValueError,
PermissionError, RuntimeError and HomeAssistantError. f-strings are reported
separately as dynamic and skipped. Messages that are already keys in all four
card dictionaries (de, el, es, it) are excluded.

Usage: python scripts/list-backend-messages.py [output.json]
Default output: the scratchpad file given in the project notes.
"""
import ast
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PKG = ROOT / "custom_components" / "deepal_companion"
FILES = ["api.py", "database.py", "notifications.py", "charger_limit.py", "health.py", "preconditioning.py"]
EXCEPTIONS = {"ValueError", "PermissionError", "RuntimeError", "HomeAssistantError"}
LANGS = ["de", "el", "es", "it"]
DEFAULT_OUT = Path(r"C:\Users\Lefteris\AppData\Local\Temp\claude\aef150f4ca32a101\42d95658-520b-478f-8988-6c7381c99a43\scratchpad\backend_messages.json")


def exception_name(func):
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return ""


def scan(path):
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    static, dynamic = [], []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or exception_name(node.func) not in EXCEPTIONS:
            continue
        if not node.args:
            continue
        first = node.args[0]
        where = f"{path.name}:{node.lineno}"
        if isinstance(first, ast.Constant) and isinstance(first.value, str):
            static.append((first.value, where))
        elif isinstance(first, ast.JoinedStr):
            dynamic.append(where)
    return static, dynamic


def lang_keys():
    """Load the four dictionaries the same way the audit does (vm, window global)."""
    script = (
        "const vm=require('vm');const fs=require('fs');const dir=process.argv[1];"
        "const out={};for(const code of ['de','el','es','it']){"
        "const ctx={window:{}};vm.createContext(ctx);"
        "vm.runInContext(fs.readFileSync(dir+'/'+code+'.js','utf8'),ctx);"
        "out[code]=Object.keys(ctx.window.__DEEPAL_COMPANION_LANGS[code].dict);}"
        "process.stdout.write(JSON.stringify(out));"
    )
    raw = subprocess.run(
        ["node", "-e", script, str(PKG / "frontend" / "lang")],
        check=True, capture_output=True, text=True, encoding="utf-8",
    ).stdout
    return json.loads(raw)


def main():
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
    all_static, all_dynamic = [], []
    for name in FILES:
        s, d = scan(PKG / name)
        all_static.extend(s)
        all_dynamic.extend(d)
    keys = lang_keys()
    in_all = set.intersection(*(set(keys[code]) for code in LANGS))
    unique = sorted({text for text, _ in all_static if text not in in_all})
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(unique, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"static literal calls: {len(all_static)}")
    print(f"unique static messages: {len({t for t, _ in all_static})}")
    print(f"already translated in all four languages (excluded): {len({t for t, _ in all_static if t in in_all})}")
    print(f"written: {len(unique)} messages -> {out_path}")
    print(f"dynamic, skipped (f-strings): {len(all_dynamic)}")
    for where in all_dynamic:
        print(f"  dynamic, skipped: {where}")
    print("examples:")
    for text in unique[:5]:
        print(f"  {text}")


if __name__ == "__main__":
    main()
