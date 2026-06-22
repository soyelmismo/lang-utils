"""Update CSS files to use CSS variables from themes.css instead of hardcoded colors."""
import re
import sys

# Mapping of hardcoded colors → CSS variables
COLOR_MAP = [
    # Backgrounds
    (r'#0f0f23', 'var(--lu-bg)'),
    (r'#1a1a2e', 'var(--lu-bg-panel)'),
    (r'#16213e', 'var(--lu-border)'),
    (r'#0f3460', 'var(--lu-border-strong)'),
    # Text
    (r'#e0e0e0', 'var(--lu-text)'),
    (r'#eee\b', 'var(--lu-text)'),
    (r'#aaa\b', 'var(--lu-text-muted)'),
    (r'#888\b', 'var(--lu-text-muted)'),
    (r'#666\b', 'var(--lu-text-muted)'),
    (r'#555\b', 'var(--lu-text-muted)'),
    (r'#ccc\b', 'var(--lu-text)'),
    (r'#333\b', 'var(--lu-border)'),
    # Accent
    (r'#e94560', 'var(--lu-accent)'),
    (r'#c73650', 'var(--lu-accent-hover)'),
    # States
    (r'#4ade80', 'var(--lu-success)'),
    (r'#facc15', 'var(--lu-warning)'),
    (r'#f87171', 'var(--lu-danger)'),
    # RGBA accents
    (r'rgba\(233,\s*69,\s*96', 'rgba(233, 69, 96'),  # leave rgba alone for now
]

def update_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    for old, new in COLOR_MAP:
        if old.startswith('rgba'):
            continue
        content = re.sub(re.escape(old), new, content, flags=re.IGNORECASE)
    # Also: replace font-family with var(--lu-font)
    content = re.sub(
        r"font-family:\s*-apple-system,\s*BlinkMacSystemFont,\s*'Segoe UI',\s*Roboto,\s*sans-serif;",
        'font-family: var(--lu-font);',
        content
    )
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  ✓ {path}")

for f in sys.argv[1:]:
    update_file(f)
