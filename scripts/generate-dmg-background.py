#!/usr/bin/env python3
"""
Generate DMG background image with Chinese install guide.

Uses macOS built-in Quartz (CoreGraphics) via PyObjC — no pip install needed.
Produces a 500x400 PNG with:
  - Step 1: Security & Privacy instructions
  - Step 2: Drag-to-Applications guide with arrow
  - Layout matches create-dmg.sh positions (app@125,240  apps@375,240)

Usage: python3 scripts/generate-dmg-background.py [output_path]
Default output: assets/dmg-background-small.png
"""
import sys, os

# Output path
OUTPUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "assets", "dmg-background-small.png"
)

W, H = 500, 400

try:
    import Quartz
    from CoreText import (
        CTFontCreateWithName, CTLineDraw,
        CTLineCreateWithAttributedString,
        kCTFontAttributeName, kCTForegroundColorAttributeName,
    )
    from CoreFoundation import (
        CFAttributedStringCreate, kCFAllocatorDefault,
    )
    import CoreGraphics as CG

    USE_QUARTZ = True
except ImportError:
    USE_QUARTZ = False

if not USE_QUARTZ:
    # Fallback: generate a simple SVG and convert with sips
    print("Quartz not available, generating SVG fallback...")

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E8F0F8"/>
      <stop offset="100%" stop-color="#D0DDE8"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="{W}" height="{H}" fill="url(#bg)" rx="8"/>

  <!-- Top banner -->
  <rect width="{W}" height="65" fill="#2D3748" opacity="0.88" rx="8"/>
  <rect y="8" width="{W}" height="57" fill="#2D3748" opacity="0.88"/>

  <!-- Step 1 badge -->
  <circle cx="28" cy="22" r="10" fill="#E67E22"/>
  <text x="28" y="27" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Helvetica">1</text>

  <!-- Step 1 text -->
  <text x="45" y="19" fill="#FDE8D0" font-size="11" font-family="PingFang SC, Helvetica Neue, sans-serif">打开 系统设置 → 隐私与安全性</text>
  <text x="45" y="35" fill="#FBBF24" font-size="12" font-weight="bold" font-family="PingFang SC, Helvetica Neue, sans-serif">→ 点击「仍然打开」</text>

  <!-- Arrow between steps -->
  <text x="230" y="28" fill="#8899AA" font-size="16" font-family="Helvetica">▸</text>

  <!-- Step 2 badge -->
  <circle cx="256" cy="22" r="10" fill="#27AE60"/>
  <text x="256" y="27" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Helvetica">2</text>

  <!-- Step 2 text -->
  <text x="273" y="19" fill="#D1FAE5" font-size="11" font-family="PingFang SC, Helvetica Neue, sans-serif">将左边 App 拖拽到右边</text>
  <text x="273" y="35" fill="#6EE7B7" font-size="12" font-weight="bold" font-family="PingFang SC, Helvetica Neue, sans-serif">Applications 文件夹</text>

  <!-- macOS version note -->
  <text x="45" y="55" fill="#8899AA" font-size="9" font-family="PingFang SC, Helvetica Neue, sans-serif">⚠ macOS 15+ 首次打开需先完成步骤 1（右键打开已不可用）</text>

  <!-- Step 1 detail box -->
  <rect x="15" y="75" width="220" height="72" rx="6" fill="#FFF7ED" stroke="#F59E0B" stroke-width="1" opacity="0.95"/>
  <text x="30" y="93" fill="#92400E" font-size="10" font-weight="bold" font-family="PingFang SC, Helvetica Neue, sans-serif">⚙ 首次打开前：</text>
  <text x="30" y="108" fill="#78350F" font-size="9.5" font-family="PingFang SC, Helvetica Neue, sans-serif">1. 双击 App → 弹出"无法验证"</text>
  <text x="30" y="121" fill="#78350F" font-size="9.5" font-family="PingFang SC, Helvetica Neue, sans-serif">2. 系统设置 → 隐私与安全性</text>
  <text x="30" y="134" fill="#DC2626" font-size="9.5" font-weight="bold" font-family="PingFang SC, Helvetica Neue, sans-serif">3. 点击「仍然打开」→ 输入密码</text>

  <!-- Step 2 detail box -->
  <rect x="265" y="75" width="220" height="72" rx="6" fill="#ECFDF5" stroke="#10B981" stroke-width="1" opacity="0.95"/>
  <text x="280" y="93" fill="#065F46" font-size="10" font-weight="bold" font-family="PingFang SC, Helvetica Neue, sans-serif">📁 安装：</text>
  <text x="280" y="110" fill="#064E3B" font-size="10" font-family="PingFang SC, Helvetica Neue, sans-serif">拖拽 App 图标到右侧</text>
  <text x="280" y="127" fill="#064E3B" font-size="10" font-family="PingFang SC, Helvetica Neue, sans-serif">Applications 文件夹</text>
  <text x="280" y="142" fill="#059669" font-size="9" font-family="PingFang SC, Helvetica Neue, sans-serif">拖完即安装完成 ✓</text>

  <!-- Big drag arrow -->
  <defs>
    <marker id="arrowhead" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto" fill="#E85D26">
      <polygon points="0 0, 12 4, 0 8"/>
    </marker>
  </defs>
  <line x1="170" y1="270" x2="320" y2="270" stroke="#E85D26" stroke-width="4"
        stroke-dasharray="none" marker-end="url(#arrowhead)" opacity="0.9"/>

  <!-- Motion lines -->
  <line x1="180" y1="260" x2="210" y2="260" stroke="#E8A060" stroke-width="1.5" opacity="0.4"/>
  <line x1="200" y1="280" x2="230" y2="280" stroke="#E8A060" stroke-width="1.5" opacity="0.4"/>
  <line x1="220" y1="255" x2="245" y2="255" stroke="#E8A060" stroke-width="1" opacity="0.3"/>
  <line x1="240" y1="285" x2="265" y2="285" stroke="#E8A060" stroke-width="1" opacity="0.3"/>

  <!-- App icon area hint (left, 125,270) -->
  <circle cx="125" cy="270" r="35" fill="#4A90D9" opacity="0.15" stroke="#4A90D9" stroke-width="1" stroke-dasharray="4,3"/>
  <text x="125" y="320" text-anchor="middle" fill="#4A5568" font-size="10" font-family="PingFang SC, Helvetica Neue, sans-serif">App 在此</text>

  <!-- Applications folder hint (right, 375,270) -->
  <rect x="340" y="245" width="70" height="50" rx="5" fill="#27AE60" opacity="0.12" stroke="#27AE60" stroke-width="1" stroke-dasharray="4,3"/>
  <text x="375" y="320" text-anchor="middle" fill="#4A5568" font-size="10" font-family="PingFang SC, Helvetica Neue, sans-serif">Applications</text>

  <!-- Bottom bar -->
  <rect y="{H-30}" width="{W}" height="30" fill="#2D3748" opacity="0.75" rx="0"/>
  <rect y="{H-30}" width="{W}" height="22" fill="#2D3748" opacity="0.75"/>
  <text x="20" y="{H-10}" fill="#A0AEC0" font-size="9" font-family="PingFang SC, Helvetica Neue, sans-serif">安装完成后从「应用程序」或 Launchpad 启动  |  openclawcn.com</text>
</svg>'''

    svg_path = OUTPUT.replace('.png', '.svg')
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg)
    print(f"SVG written: {svg_path}")

    # Try to convert SVG to PNG using macOS tools
    # Method 1: qlmanage (Quick Look)
    import subprocess
    try:
        subprocess.run([
            'qlmanage', '-t', '-s', str(W), '-o', os.path.dirname(OUTPUT), svg_path
        ], capture_output=True, timeout=10)
        ql_output = svg_path + '.png'
        if os.path.exists(ql_output):
            os.rename(ql_output, OUTPUT)
            os.remove(svg_path)
            print(f"Converted to PNG: {OUTPUT}")
            sys.exit(0)
    except Exception:
        pass

    # Method 2: sips (only handles raster, not SVG directly)
    # Method 3: rsvg-convert if available
    try:
        subprocess.run(['rsvg-convert', svg_path, '-o', OUTPUT], capture_output=True, timeout=10)
        if os.path.exists(OUTPUT):
            os.remove(svg_path)
            print(f"Converted to PNG via rsvg-convert: {OUTPUT}")
            sys.exit(0)
    except Exception:
        pass

    # Method 4: Use python3 + cairosvg if pip-installed
    try:
        import cairosvg
        cairosvg.svg2png(file_obj=open(svg_path, 'rb'), write_to=OUTPUT)
        os.remove(svg_path)
        print(f"Converted to PNG via cairosvg: {OUTPUT}")
        sys.exit(0)
    except Exception:
        pass

    # If all conversions fail, keep SVG — create-dmg.sh will show a warning
    print(f"WARNING: Could not convert SVG to PNG. SVG saved at: {svg_path}")
    print("Install rsvg-convert (brew install librsvg) for SVG→PNG conversion")
    sys.exit(0)

# ─── Quartz (CoreGraphics) path — native macOS rendering ───
print(f"Using Quartz (CoreGraphics) to generate {W}x{H} background...")

colorSpace = CG.CGColorSpaceCreateDeviceRGB()
ctx = CG.CGBitmapContextCreate(
    None, W, H, 8, W * 4,
    colorSpace,
    CG.kCGImageAlphaPremultipliedLast
)

# Flip coordinates (CoreGraphics is bottom-up)
CG.CGContextTranslateCTM(ctx, 0, H)
CG.CGContextScaleCTM(ctx, 1, -1)

def set_fill(r, g, b, a=1.0):
    CG.CGContextSetRGBFillColor(ctx, r, g, b, a)

def set_stroke(r, g, b, a=1.0):
    CG.CGContextSetRGBStrokeColor(ctx, r, g, b, a)

def fill_rect_q(x, y, w, h):
    CG.CGContextFillRect(ctx, CG.CGRectMake(x, y, w, h))

def draw_rounded_rect(x, y, w, h, r):
    CG.CGContextBeginPath(ctx)
    CG.CGContextMoveToPoint(ctx, x+r, y)
    CG.CGContextAddLineToPoint(ctx, x+w-r, y)
    CG.CGContextAddArcToPoint(ctx, x+w, y, x+w, y+r, r)
    CG.CGContextAddLineToPoint(ctx, x+w, y+h-r)
    CG.CGContextAddArcToPoint(ctx, x+w, y+h, x+w-r, y+h, r)
    CG.CGContextAddLineToPoint(ctx, x+r, y+h)
    CG.CGContextAddArcToPoint(ctx, x, y+h, x, y+h-r, r)
    CG.CGContextAddLineToPoint(ctx, x, y+r)
    CG.CGContextAddArcToPoint(ctx, x, y, x+r, y, r)
    CG.CGContextClosePath(ctx)

def draw_text(text, x, y, size, r, g, b, bold=False):
    """Draw text using CoreText"""
    weight = "Bold" if bold else "Regular"
    # Try PingFang SC first (best CJK), fall back to system font
    for font_name in ["PingFangSC-" + ("Semibold" if bold else "Regular"),
                      "PingFang SC",
                      ".AppleSystemUIFont"]:
        font = CTFontCreateWithName(font_name, size, None)
        if font:
            break

    color = CG.CGColorCreate(colorSpace, (r, g, b, 1.0))
    attrs = {
        kCTFontAttributeName: font,
        kCTForegroundColorAttributeName: color,
    }
    astr = CFAttributedStringCreate(kCFAllocatorDefault, text, attrs)
    line = CTLineCreateWithAttributedString(astr)

    CG.CGContextSaveGState(ctx)
    # CoreText draws bottom-up, we need to flip for our already-flipped context
    CG.CGContextTranslateCTM(ctx, x, y)
    CG.CGContextScaleCTM(ctx, 1, -1)
    CTLineDraw(line, ctx)
    CG.CGContextRestoreGState(ctx)

def draw_circle(cx, cy, radius):
    CG.CGContextBeginPath(ctx)
    CG.CGContextAddArc(ctx, cx, cy, radius, 0, 3.14159*2, 0)
    CG.CGContextClosePath(ctx)

# ── Background gradient ──
for y in range(H):
    t = y / H
    r = 0.91 + t * (-0.06)
    g = 0.94 + t * (-0.04)
    b = 0.97 + t * (-0.02)
    set_fill(r, g, b)
    fill_rect_q(0, y, W, 1)

# ── Top banner ──
set_fill(0.176, 0.216, 0.282, 0.9)
draw_rounded_rect(0, 0, W, 65, 0)
CG.CGContextFillPath(ctx)

# Step 1 circle
set_fill(0.9, 0.5, 0.13)
draw_circle(28, 22, 10)
CG.CGContextFillPath(ctx)
draw_text("1", 23, 17, 14, 1, 1, 1, bold=True)

# Step 1 text
draw_text("打开 系统设置 → 隐私与安全性", 45, 13, 11, 0.99, 0.91, 0.82)
draw_text("→ 点击「仍然打开」", 45, 29, 12, 0.98, 0.75, 0.15, bold=True)

# Arrow between steps
draw_text("▸", 230, 18, 16, 0.53, 0.6, 0.67)

# Step 2 circle
set_fill(0.15, 0.68, 0.38)
draw_circle(256, 22, 10)
CG.CGContextFillPath(ctx)
draw_text("2", 251, 17, 14, 1, 1, 1, bold=True)

# Step 2 text
draw_text("将左边 App 拖拽到右边", 273, 13, 11, 0.82, 0.98, 0.9)
draw_text("Applications 文件夹", 273, 29, 12, 0.43, 0.91, 0.72, bold=True)

# Warning note
draw_text("⚠ macOS 15+ 首次打开需先完成步骤 1（右键打开已不可用）", 45, 49, 9, 0.53, 0.6, 0.67)

# ── Step 1 detail box ──
set_fill(1, 0.97, 0.93, 0.95)
draw_rounded_rect(15, 75, 220, 72, 6)
CG.CGContextFillPath(ctx)
set_stroke(0.96, 0.62, 0.04)
CG.CGContextSetLineWidth(ctx, 1)
draw_rounded_rect(15, 75, 220, 72, 6)
CG.CGContextStrokePath(ctx)

draw_text("⚙ 首次打开前：", 30, 83, 10, 0.57, 0.25, 0.05, bold=True)
draw_text("1. 双击 App → 弹出"无法验证"", 30, 97, 9.5, 0.47, 0.21, 0.06)
draw_text("2. 系统设置 → 隐私与安全性", 30, 111, 9.5, 0.47, 0.21, 0.06)
draw_text("3. 点击「仍然打开」→ 输入密码", 30, 125, 9.5, 0.86, 0.15, 0.15, bold=True)

# ── Step 2 detail box ──
set_fill(0.93, 0.99, 0.96, 0.95)
draw_rounded_rect(265, 75, 220, 72, 6)
CG.CGContextFillPath(ctx)
set_stroke(0.06, 0.73, 0.51)
draw_rounded_rect(265, 75, 220, 72, 6)
CG.CGContextStrokePath(ctx)

draw_text("📁 安装：", 280, 83, 10, 0.02, 0.37, 0.27, bold=True)
draw_text("拖拽 App 图标到右侧", 280, 99, 10, 0.02, 0.31, 0.23)
draw_text("Applications 文件夹", 280, 115, 10, 0.02, 0.31, 0.23)
draw_text("拖完即安装完成 ✓", 280, 131, 9, 0.02, 0.59, 0.4)

# ── Big drag arrow ──
CG.CGContextSetLineWidth(ctx, 4)
set_stroke(0.91, 0.36, 0.15, 0.9)
CG.CGContextBeginPath(ctx)
CG.CGContextMoveToPoint(ctx, 170, 270)
CG.CGContextAddLineToPoint(ctx, 310, 270)
CG.CGContextStrokePath(ctx)

# Arrowhead
set_fill(0.91, 0.36, 0.15, 0.9)
CG.CGContextBeginPath(ctx)
CG.CGContextMoveToPoint(ctx, 310, 263)
CG.CGContextAddLineToPoint(ctx, 330, 270)
CG.CGContextAddLineToPoint(ctx, 310, 277)
CG.CGContextClosePath(ctx)
CG.CGContextFillPath(ctx)

# Motion lines
CG.CGContextSetLineWidth(ctx, 1.5)
for (x1, y1, x2, y2, alpha) in [
    (180, 260, 210, 260, 0.4),
    (200, 280, 230, 280, 0.4),
    (220, 255, 245, 255, 0.3),
    (240, 285, 265, 285, 0.3),
]:
    set_stroke(0.91, 0.63, 0.38, alpha)
    CG.CGContextBeginPath(ctx)
    CG.CGContextMoveToPoint(ctx, x1, y1)
    CG.CGContextAddLineToPoint(ctx, x2, y2)
    CG.CGContextStrokePath(ctx)

# App icon hint (dashed circle at 125, 270)
set_stroke(0.29, 0.56, 0.85, 0.5)
CG.CGContextSetLineWidth(ctx, 1)
CG.CGContextSetLineDash(ctx, 0, [4, 3], 2)
draw_circle(125, 270, 35)
CG.CGContextStrokePath(ctx)
CG.CGContextSetLineDash(ctx, 0, None, 0)
draw_text("App 在此", 100, 312, 10, 0.29, 0.33, 0.41)

# Applications folder hint (dashed rect at 375, 270)
set_stroke(0.15, 0.68, 0.38, 0.5)
CG.CGContextSetLineDash(ctx, 0, [4, 3], 2)
draw_rounded_rect(340, 245, 70, 50, 5)
CG.CGContextStrokePath(ctx)
CG.CGContextSetLineDash(ctx, 0, None, 0)
draw_text("Applications", 337, 312, 10, 0.29, 0.33, 0.41)

# ── Bottom bar ──
set_fill(0.176, 0.216, 0.282, 0.75)
fill_rect_q(0, H-28, W, 28)
draw_text("安装完成后从「应用程序」或 Launchpad 启动  |  openclawcn.com", 20, H-20, 9, 0.63, 0.68, 0.75)

# ── Save PNG ──
image = CG.CGBitmapContextCreateImage(ctx)
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
url = CG.CFURLCreateFromFileSystemRepresentation(
    None, OUTPUT.encode('utf-8'), len(OUTPUT.encode('utf-8')), False
)
dest = CG.CGImageDestinationCreateWithURL(url, "public.png", 1, None)
CG.CGImageDestinationAddImage(dest, image, None)
CG.CGImageDestinationFinalize(dest)

print(f"Generated: {OUTPUT} ({W}x{H})")
