#!/usr/bin/env python3
"""Replace remaining hardcoded colors in CSS files with theme CSS variables.

This is a one-shot migration script. It processes the three page-specific CSS
files (popup, options, chatbot) and rewrites hardcoded hex colors to the
matching CSS variable from themes.css.

The mapping is intentionally explicit (no regex word boundaries) to avoid
the bugs of the previous attempt where short hex codes like #aaa were left
untouched.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Mapping: literal hex → CSS variable.
# Order matters: longer/more-specific colors first so #16213e doesn't get
# shadowed by a partial match.
COLOR_MAP: list[tuple[str, str]] = [
    # Backgrounds
    ("#0f0f23", "var(--lu-bg)"),
    ("#1a1a2e", "var(--lu-bg-panel)"),
    ("#16213e", "var(--lu-border)"),
    ("#0f3460", "var(--lu-border-strong)"),
    # Accent + states
    ("#e94560", "var(--lu-accent)"),
    ("#c73650", "var(--lu-accent-hover)"),
    ("#4ade80", "var(--lu-success)"),
    ("#facc15", "var(--lu-warning)"),
    ("#f87171", "var(--lu-danger)"),
    # Neutral text colors (only when used as standalone color, not in rgba)
    ("#e0e0e0", "var(--lu-text)"),
    ("#eeeeee", "var(--lu-text)"),
    ("#eee", "var(--lu-text)"),
    ("#cccccc", "var(--lu-text)"),
    ("#ccc", "var(--lu-text)"),
    ("#aaaaaa", "var(--lu-text-muted)"),
    ("#aaa", "var(--lu-text-muted)"),
    ("#888888", "var(--lu-text-muted)"),
    ("#888", "var(--lu-text-muted)"),
    ("#666666", "var(--lu-text-muted)"),
    ("#666", "var(--lu-text-muted)"),
    ("#555555", "var(--lu-text-muted)"),
    ("#555", "var(--lu-text-muted)"),
    ("#333333", "var(--lu-border)"),
    ("#333", "var(--lu-border)"),
    # White stays as #fff in most places (buttons text, etc.) — leave as-is.
]

# Match a hex color that is NOT preceded by a letter/digit (so we don't break
# url(#foo) or similar). Match #rgb or #rrggbb.
HEX_RE = re.compile(r"(?<![A-Za-z0-9])(#[0-9a-fA-F]{3,6})\b")


def replace_in_text(content: str) -> str:
    """Replace all known hex colors with their CSS variable equivalent."""

    def repl(match: re.Match[str]) -> str:
        hex_value = match.group(1)
        # Case-insensitive lookup
        for hex_lit, var in COLOR_MAP:
            if hex_value.lower() == hex_lit.lower():
                return var
        # Unknown color — leave as-is
        return hex_value

    return HEX_RE.sub(repl, content)


def replace_font_family(content: str) -> str:
    """Replace the long font-family stack with var(--lu-font)."""
    return re.sub(
        r"font-family:\s*-apple-system,\s*BlinkMacSystemFont,\s*'Segoe UI',\s*Roboto,\s*sans-serif;",
        "font-family: var(--lu-font);",
        content,
    )


def process_file(path: Path) -> tuple[int, int]:
    """Process one CSS file. Returns (replacements_made, total_hex_found)."""
    original = path.read_text(encoding="utf-8")
    new_content = replace_in_text(original)
    new_content = replace_font_family(new_content)
    if new_content != original:
        path.write_text(new_content, encoding="utf-8")
    # Count remaining hex colors
    remaining = len(HEX_RE.findall(new_content))
    return (original != new_content), remaining


def main() -> int:
    if not sys.argv[1:]:
        print("Usage: fix-css-colors.py <file.css> [file.css ...]")
        return 1

    total_replaced = 0
    total_remaining = 0
    for arg in sys.argv[1:]:
        path = Path(arg)
        if not path.exists():
            print(f"  ✗ {path} (not found)")
            continue
        changed, remaining = process_file(path)
        status = "✓ updated" if changed else "= no change"
        print(f"  {status}: {path}  ({remaining} hex colors remain)")
        if changed:
            total_replaced += 1
        total_remaining += remaining

    print(f"\nFiles changed: {total_replaced}")
    print(f"Remaining hex colors (intentional): {total_remaining}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
