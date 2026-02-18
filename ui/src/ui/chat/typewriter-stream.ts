/**
 * 千问风格：流式回复匀速揭示
 * 将完整流式文本以恒定速度逐字显示，避免一口气全部出现
 *
 * 优化特性：
 * - 自适应速度：根据待显示文本量动态调整速度
 * - 追赶机制：当积压文本过多时加速追赶
 * - 完成检测：当文本停止增长时加速揭示剩余内容
 * - 最大延迟限制：确保新文本在合理时间内显示完毕
 */
import { html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { directive } from "lit/directive.js";
import { AsyncDirective } from "lit/async-directive.js";
import { toSanitizedMarkdownHtml } from "../markdown";

// ============ 打字机配置参数 ============

/** 基础速度：每秒揭示的字符数 */
const BASE_CHARS_PER_SECOND = 120;

/** 最大速度：追赶模式下的最高速度 */
const MAX_CHARS_PER_SECOND = 600;

/** 触发追赶的积压阈值（字符数） */
const CATCHUP_THRESHOLD = 50;

/** 最大允许的积压量（超过此值直接跳到较近位置） */
const MAX_BACKLOG = 400;

/** 积压处理的目标时间（秒）- 积压的文本应在此时间内追上 */
const TARGET_CATCHUP_TIME = 1.0;

/** 速度平滑因子（0-1，越小越平滑） */
const SPEED_SMOOTHING = 0.2;

/** 完成检测：文本停止增长后的等待时间（毫秒） */
const COMPLETION_DETECT_MS = 200;

/** 完成模式下的速度倍率 */
const COMPLETION_SPEED_MULTIPLIER = 3;

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
    }

    if (this.fullText.length === 0) {
      return this.render();
    }

    // 检测新增文本
    if (this.fullText.length > this.lastTextLength) {
      this.lastGrowthTime = performance.now();
      this.isCompleting = false;
    }
    this.lastTextLength = this.fullText.length;

    // 计算当前积压量
    const backlog = this.fullText.length - this.revealedLength;

    // 如果积压量过大，直接跳到较近位置（保持一定的打字效果）
    if (backlog > MAX_BACKLOG) {
      this.revealedLength = this.fullText.length - CATCHUP_THRESHOLD;
    }

    this.ensureAnimating();
    return this.render();
  }

  /** 确保 RAF 动画正在运行 */
  private ensureAnimating() {
    if (this.rafId || this.revealedLength >= this.fullText.length) return;

    this.lastTime = performance.now();
    const run = () => {
      const now = performance.now();
      const delta = this.lastTime ? now - this.lastTime : 0;
      this.lastTime = now;

      // 检测完成模式：文本停止增长超过阈值
      if (
        !this.isCompleting &&
        now - this.lastGrowthTime > COMPLETION_DETECT_MS
      ) {
        this.isCompleting = true;
      }

      // 计算目标速度
      let targetSpeed = this.calculateTargetSpeed();

      // 完成模式：大幅提速以快速显示剩余文本
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

      if (this.isConnected) {
        this.setValue(this.render());
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

  private render() {
    const len = Math.floor(this.revealedLength);
    const slice = this.fullText.slice(0, len);
    const raw = slice || "\u00A0"; /* non-breaking space so cursor has height */
    const sanitized = toSanitizedMarkdownHtml(raw);
    return html`${unsafeHTML(sanitized)}`;
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
