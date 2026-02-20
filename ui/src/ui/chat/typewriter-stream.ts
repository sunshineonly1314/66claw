/**
 * Gemini/豆包风格：流式回复匀速揭示
 * 将完整流式文本以自然速度逐字显示，模拟真人打字的节奏感
 *
 * 优化特性：
 * - 慢速基础节奏：35字/秒，人眼可感知的逐字效果
 * - 智能断词：不在 markdown 语法标记中间截断，避免渲染抖动
 * - 标点停顿：遇到句号、逗号等自动微停，模拟自然输入节奏
 * - 渲染节流：相同截断位置不重复解析 markdown，降低 CPU 开销
 * - 平滑追赶：积压过多时缓慢加速，而非瞬间跳跃
 * - 完成检测：文本停止增长后适度加速揭示剩余内容
 */
import { html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { directive } from "lit/directive.js";
import { AsyncDirective } from "lit/async-directive.js";
import { toSanitizedMarkdownHtml } from "../markdown";

// ============ 打字机配置参数 ============

/** 基础速度：每秒揭示的字符数（对标 Gemini/豆包的视觉节奏） */
const BASE_CHARS_PER_SECOND = 35;

/** 最大速度：追赶模式下的最高速度 */
const MAX_CHARS_PER_SECOND = 180;

/** 触发追赶的积压阈值（字符数）- 容忍较大缓冲再加速 */
const CATCHUP_THRESHOLD = 200;

/** 最大允许的积压量（超过此值直接跳到较近位置） */
const MAX_BACKLOG = 1500;

/** 积压处理的目标时间（秒）- 积压的文本应在此时间内追上 */
const TARGET_CATCHUP_TIME = 3.0;

/** 速度平滑因子（0-1，越小越平滑，避免突然加速） */
const SPEED_SMOOTHING = 0.08;

/** 完成检测：文本停止增长后的等待时间（毫秒） */
const COMPLETION_DETECT_MS = 500;

/** 完成模式下的速度倍率 */
const COMPLETION_SPEED_MULTIPLIER = 2;

// ============ 标点停顿配置 ============

/** 需要额外停顿的标点符号集合 */
const PAUSE_CHARS_SHORT = new Set("，、,;；");
/** 较长停顿的标点（句末） */
const PAUSE_CHARS_LONG = new Set("。！？…!?");
/** 换行停顿 */
const PAUSE_CHAR_NEWLINE = "\n";

/** 短停顿时间（毫秒）- 逗号等 */
const SHORT_PAUSE_MS = 50;
/** 长停顿时间（毫秒）- 句号等 */
const LONG_PAUSE_MS = 100;
/** 换行停顿时间（毫秒） */
const NEWLINE_PAUSE_MS = 100;

class TypewriterStreamDirective extends AsyncDirective {
  private rafId = 0;
  private revealedLength = 0;
  private streamKey = "";
  private lastTime = 0;
  private fullText = "";
  /** 当前实际使用的速度（用于平滑过渡） */
  private currentSpeed = BASE_CHARS_PER_SECOND;
  /** 记录上次文本长度，用于检测新内容 */
  private lastTextLength = 0;
  /** 上次文本增长的时间戳 */
  private lastGrowthTime = 0;
  /** 是否进入完成模式（文本停止增长，加速揭示剩余内容） */
  private isCompleting = false;
  /** 标点停顿：停顿到此时间戳 */
  private pauseUntil = 0;
  /** 渲染缓存：上次渲染的截断位置 */
  private lastRenderedLength = -1;
  /** 渲染缓存：上次渲染的 HTML */
  private lastRenderedHtml = "";

  override update(
    _part: import("lit/directive").Part,
    [fullText, streamKey]: [string, string],
  ) {
    this.fullText = fullText ?? "";

    // 新的流开始，重置状态
    if (streamKey !== this.streamKey) {
      this.streamKey = streamKey;
      this.revealedLength = 0;
      this.currentSpeed = BASE_CHARS_PER_SECOND;
      this.lastTextLength = 0;
      this.lastGrowthTime = performance.now();
      this.isCompleting = false;
      this.pauseUntil = 0;
      this.lastRenderedLength = -1;
      this.lastRenderedHtml = "";
    }

    if (this.fullText.length === 0) {
      return this.buildHtml();
    }

    // 检测新增文本
    if (this.fullText.length > this.lastTextLength) {
      this.lastGrowthTime = performance.now();
      this.isCompleting = false;
    }
    this.lastTextLength = this.fullText.length;

    // 计算当前积压量
    const backlog = this.fullText.length - this.revealedLength;

    // 如果积压量过大，跳到较近位置（保持打字效果的尾巴）
    if (backlog > MAX_BACKLOG) {
      this.revealedLength = this.fullText.length - CATCHUP_THRESHOLD;
    }

    this.ensureAnimating();
    return this.buildHtml();
  }

  /** 确保 RAF 动画正在运行 */
  private ensureAnimating() {
    if (this.rafId || this.revealedLength >= this.fullText.length) return;

    this.lastTime = performance.now();
    const run = () => {
      const now = performance.now();
      const delta = this.lastTime ? now - this.lastTime : 0;
      this.lastTime = now;

      // 标点停顿：如果在停顿中，跳过推进但继续帧循环
      if (now < this.pauseUntil) {
        if (this.isConnected) {
          this.rafId = requestAnimationFrame(run);
        } else {
          this.rafId = 0;
        }
        return;
      }

      // 检测完成模式：文本停止增长超过阈值
      if (
        !this.isCompleting &&
        now - this.lastGrowthTime > COMPLETION_DETECT_MS
      ) {
        this.isCompleting = true;
      }

      // 记录推进前的位置（用于标点停顿检测）
      const prevLen = Math.floor(this.revealedLength);

      // 计算目标速度
      let targetSpeed = this.calculateTargetSpeed();

      // 完成模式：适度提速以显示剩余文本
      if (this.isCompleting) {
        targetSpeed = Math.max(
          targetSpeed,
          BASE_CHARS_PER_SECOND * COMPLETION_SPEED_MULTIPLIER,
        );
      }

      // 平滑过渡到目标速度
      this.currentSpeed =
        this.currentSpeed +
        (targetSpeed - this.currentSpeed) * SPEED_SMOOTHING;

      // 更新显示位置
      this.revealedLength = Math.min(
        this.fullText.length,
        this.revealedLength + (this.currentSpeed * delta) / 1000,
      );

      // 标点停顿检测：检查新揭示的字符中是否有标点
      const newLen = Math.floor(this.revealedLength);
      if (newLen > prevLen && newLen <= this.fullText.length) {
        // 检查新揭示区间内的最后一个字符
        const lastChar = this.fullText[newLen - 1];
        if (lastChar === PAUSE_CHAR_NEWLINE) {
          this.pauseUntil = now + NEWLINE_PAUSE_MS;
        } else if (PAUSE_CHARS_LONG.has(lastChar)) {
          this.pauseUntil = now + LONG_PAUSE_MS;
        } else if (PAUSE_CHARS_SHORT.has(lastChar)) {
          this.pauseUntil = now + SHORT_PAUSE_MS;
        }
      }

      if (this.isConnected) {
        this.setValue(this.buildHtml());
      }

      if (this.revealedLength < this.fullText.length && this.isConnected) {
        this.rafId = requestAnimationFrame(run);
      } else {
        this.rafId = 0;
      }
    };

    this.rafId = requestAnimationFrame(run);
  }

  /**
   * 计算目标显示速度
   * 根据积压量动态调整，确保流畅且及时的显示
   */
  private calculateTargetSpeed(): number {
    const backlog = this.fullText.length - this.revealedLength;

    // 没有积压或积压很少，使用基础速度
    if (backlog <= CATCHUP_THRESHOLD / 2) {
      return BASE_CHARS_PER_SECOND;
    }

    // 有积压，计算需要的速度以在目标时间内追上
    // 使用二次曲线使加速更平滑
    const excess = backlog - CATCHUP_THRESHOLD / 2;
    const ratio = Math.min(
      excess / (MAX_BACKLOG - CATCHUP_THRESHOLD / 2),
      1,
    );

    // 使用 easeOutQuad 曲线使加速更自然
    const eased = 1 - (1 - ratio) * (1 - ratio);

    // 在基础速度和最大速度之间插值
    const speed =
      BASE_CHARS_PER_SECOND +
      (MAX_CHARS_PER_SECOND - BASE_CHARS_PER_SECOND) * eased;

    // 同时考虑追赶时间约束
    const requiredSpeed = backlog / TARGET_CATCHUP_TIME;

    // 取两者中较大的值，但不超过最大速度
    return Math.min(Math.max(speed, requiredSpeed), MAX_CHARS_PER_SECOND);
  }

  /**
   * 找到安全的截断位置，避免在 markdown 语法标记中间断开
   * 回退到最近的：空格、换行、CJK 字符、标点符号
   */
  private findSafeBreakpoint(pos: number): number {
    const text = this.fullText;
    if (pos >= text.length) return text.length;
    if (pos <= 0) return 0;

    let safe = pos;

    // 向前回退找最近的安全断点（最多回退 20 字符）
    const lookback = Math.min(20, pos);
    for (let i = 0; i < lookback; i++) {
      const idx = pos - i;
      if (idx < 0) break;
      const ch = text[idx];
      // 安全断点：空白、换行、CJK 字符、标点
      if (
        ch === " " || ch === "\t" || ch === "\n" ||
        /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch) ||
        /[，。！？、；：,.!?;:\-）)》」】\]>]/.test(ch)
      ) {
        safe = idx + 1; // 包含这个字符
        break;
      }
    }

    // 额外检查：不要在 ``` 这三个字符中间截断
    if (safe >= 1 && safe <= text.length) {
      // 检查 safe 位置前后是否是 ``` 的一部分
      for (let offset = -2; offset <= 0; offset++) {
        const start = safe + offset;
        if (start >= 0 && start + 3 <= text.length) {
          const tri = text.slice(start, start + 3);
          if (tri === "```" && safe > start && safe < start + 3) {
            // 在 ``` 中间，回退到 ``` 之前
            safe = start;
            break;
          }
        }
      }
    }

    return safe;
  }

  private buildHtml() {
    const rawPos = Math.floor(this.revealedLength);
    const len = this.findSafeBreakpoint(rawPos);

    // 渲染节流：如果截断位置没变化，复用上次的 HTML
    if (len === this.lastRenderedLength && this.lastRenderedHtml) {
      return html`${unsafeHTML(this.lastRenderedHtml)}`;
    }

    const slice = this.fullText.slice(0, len);
    const raw = slice || "\u00A0"; /* non-breaking space so cursor has height */
    const sanitized = toSanitizedMarkdownHtml(raw);

    this.lastRenderedLength = len;
    this.lastRenderedHtml = sanitized;

    return html`${unsafeHTML(sanitized)}`;
  }

  override render(_fullText: string, _streamKey: string) {
    return this.buildHtml();
  }

  override disconnected() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  override reconnected() {
    // 重新连接后恢复动画（如果还有未揭示的文本）
    this.ensureAnimating();
  }
}

export const typewriterStream = directive(TypewriterStreamDirective);
