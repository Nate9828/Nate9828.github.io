// =========================================================================
    // 0. OFFLINE PIXI.JS 2D CANVAS SHIM (Seamless fallback if CDN is blocked)
    // =========================================================================
    // When online, real PixiJS v7 from cdnjs runs. If opened offline or inside
    // an isolated sandbox without internet, this lightweight Canvas2D shim
    // executes the exact same PIXI.Application / Container / Graphics / Text API!
    (function ensurePixi() {
      if (typeof window.PIXI !== 'undefined') return;

      class PointShim {
        constructor(x = 0, y = 0) { this.x = x; this.y = y; }
        set(x, y = x) { this.x = x; this.y = y; }
      }

      class DisplayObjectShim {
        constructor() {
          this.x = 0;
          this.y = 0;
          this.alpha = 1;
          this.visible = true;
          this.zIndex = 0;
          this.scale = new PointShim(1, 1);
          this.anchor = new PointShim(0, 0);
          this.parent = null;
        }
        destroy() {}
      }

      class ContainerShim extends DisplayObjectShim {
        constructor() {
          super();
          this.children = [];
          this.sortableChildren = false;
        }
        addChild(...items) {
          for (const it of items) {
            if (it.parent) it.parent.removeChild(it);
            it.parent = this;
            this.children.push(it);
          }
          return items[0];
        }
        removeChild(it) {
          const idx = this.children.indexOf(it);
          if (idx >= 0) {
            this.children.splice(idx, 1);
            it.parent = null;
          }
        }
        removeChildren() {
          for (const c of this.children) c.parent = null;
          this.children = [];
        }
        sortChildren() {
          this.children.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        }
        _render(ctx) {
          if (!this.visible || this.alpha <= 0) return;
          if (this.sortableChildren) this.sortChildren();
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.scale(this.scale.x, this.scale.y);
          ctx.globalAlpha *= this.alpha;
          for (const child of this.children) {
            if (child._render) child._render(ctx);
          }
          ctx.restore();
        }
      }

      function hexToRgba(hex, alpha = 1) {
        const n = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
        const r = (n >> 16) & 255;
        const g = (n >> 8) & 255;
        const b = n & 255;
        return `rgba(${r},${g},${b},${alpha})`;
      }

      class GraphicsShim extends ContainerShim {
        constructor() {
          super();
          this._cmds = [];
        }
        clear() {
          this._cmds = [];
          return this;
        }
        beginFill(color = 0xffffff, alpha = 1) {
          this._cmds.push({ t: 'beginFill', style: hexToRgba(color, alpha) });
          return this;
        }
        endFill() {
          this._cmds.push({ t: 'endFill' });
          return this;
        }
        lineStyle(width = 0, color = 0x000000, alpha = 1) {
          this._cmds.push({ t: 'lineStyle', width, style: hexToRgba(color, alpha) });
          return this;
        }
        drawPolygon(pts) {
          const arr = Array.isArray(pts) ? pts.slice() : Array.from(arguments);
          this._cmds.push({ t: 'poly', pts: arr });
          return this;
        }
        drawRect(x, y, w, h) {
          this._cmds.push({ t: 'rect', x, y, w, h });
          return this;
        }
        drawRoundedRect(x, y, w, h, r) {
          this._cmds.push({ t: 'rrect', x, y, w, h, r });
          return this;
        }
        drawCircle(x, y, r) {
          this._cmds.push({ t: 'circle', x, y, r });
          return this;
        }
        drawEllipse(x, y, rx, ry) {
          this._cmds.push({ t: 'ellipse', x, y, rx, ry });
          return this;
        }
        moveTo(x, y) {
          this._cmds.push({ t: 'moveTo', x, y });
          return this;
        }
        lineTo(x, y) {
          this._cmds.push({ t: 'lineTo', x, y });
          return this;
        }
        quadraticCurveTo(cx, cy, x, y) {
          this._cmds.push({ t: 'quad', cx, cy, x, y });
          return this;
        }
        _render(ctx) {
          if (!this.visible || this.alpha <= 0) return;
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.scale(this.scale.x, this.scale.y);
          ctx.globalAlpha *= this.alpha;

          let fillStyle = null;
          let strokeWidth = 0;
          let strokeStyle = null;
          let pathOpen = false;

          const flushShape = () => {
            if (fillStyle) ctx.fill();
            if (strokeWidth > 0 && strokeStyle) ctx.stroke();
          };

          for (const c of this._cmds) {
            if (c.t === 'beginFill') {
              fillStyle = c.style;
              ctx.fillStyle = fillStyle;
              ctx.beginPath();
              pathOpen = true;
            } else if (c.t === 'endFill') {
              if (pathOpen) {
                flushShape();
                pathOpen = false;
              }
              fillStyle = null;
            } else if (c.t === 'lineStyle') {
              strokeWidth = c.width;
              strokeStyle = c.style;
              ctx.lineWidth = strokeWidth;
              ctx.strokeStyle = strokeStyle;
              if (strokeWidth > 0 && !pathOpen) {
                ctx.beginPath();
                pathOpen = true;
              }
            } else if (c.t === 'poly') {
              ctx.beginPath();
              const p = c.pts;
              if (p.length >= 2) {
                ctx.moveTo(p[0], p[1]);
                for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
                ctx.closePath();
              }
              flushShape();
            } else if (c.t === 'rect') {
              ctx.beginPath();
              ctx.rect(c.x, c.y, c.w, c.h);
              flushShape();
            } else if (c.t === 'rrect') {
              ctx.beginPath();
              if (ctx.roundRect) ctx.roundRect(c.x, c.y, c.w, c.h, c.r);
              else ctx.rect(c.x, c.y, c.w, c.h);
              flushShape();
            } else if (c.t === 'circle') {
              ctx.beginPath();
              ctx.arc(c.x, c.y, Math.max(0.1, c.r), 0, Math.PI * 2);
              flushShape();
            } else if (c.t === 'ellipse') {
              ctx.beginPath();
              ctx.ellipse(c.x, c.y, Math.max(0.1, c.rx), Math.max(0.1, c.ry), 0, 0, Math.PI * 2);
              flushShape();
            } else if (c.t === 'moveTo') {
              if (!pathOpen) { ctx.beginPath(); pathOpen = true; }
              ctx.moveTo(c.x, c.y);
            } else if (c.t === 'lineTo') {
              ctx.lineTo(c.x, c.y);
              if (!fillStyle && strokeWidth > 0) ctx.stroke();
            } else if (c.t === 'quad') {
              ctx.quadraticCurveTo(c.cx, c.cy, c.x, c.y);
              if (!fillStyle && strokeWidth > 0) ctx.stroke();
            }
          }

          for (const child of this.children) {
            if (child._render) child._render(ctx);
          }
          ctx.restore();
        }
      }

      class TextStyleShim {
        constructor(opts = {}) { Object.assign(this, opts); }
      }

      class TextShim extends ContainerShim {
        constructor(text = '', style = {}) {
          super();
          this.text = text;
          this.style = style;
        }
        _render(ctx) {
          if (!this.visible || this.alpha <= 0) return;
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.scale(this.scale.x, this.scale.y);
          ctx.globalAlpha *= this.alpha;
          const sz = this.style.fontSize || 12;
          const wt = this.style.fontWeight || 'bold';
          const fam = this.style.fontFamily || 'sans-serif';
          ctx.font = `${wt} ${sz}px ${fam}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (this.style.strokeThickness) {
            ctx.lineWidth = this.style.strokeThickness;
            ctx.strokeStyle = typeof this.style.stroke === 'number' ? hexToRgba(this.style.stroke, 1) : (this.style.stroke || '#000');
            ctx.strokeText(this.text, 0, 0);
          }
          ctx.fillStyle = typeof this.style.fill === 'number' ? hexToRgba(this.style.fill, 1) : (this.style.fill || '#fff');
          ctx.fillText(this.text, 0, 0);
          ctx.restore();
        }
      }

      class ApplicationShim {
        constructor(opts = {}) {
          this.width = opts.width || 900;
          this.height = opts.height || 650;
          this.bgColor = opts.backgroundColor !== undefined ? opts.backgroundColor : 0x152c38;
          this.view = document.createElement('canvas');
          this.view.width = this.width;
          this.view.height = this.height;
          this.ctx = this.view.getContext('2d');
          this.stage = new ContainerShim();
          this.renderer = {
            width: this.width,
            height: this.height,
            resize: (w, h) => {
              this.width = w;
              this.height = h;
              this.renderer.width = w;
              this.renderer.height = h;
              this.view.width = w;
              this.view.height = h;
            }
          };
          this._cbs = [];
          this.ticker = {
            add: (fn) => this._cbs.push(fn)
          };
          let last = performance.now();
          const loop = (now) => {
            const dt = Math.min(3, (now - last) / 16.6667);
            last = now;
            for (const fn of this._cbs) fn(dt);
            this.ctx.fillStyle = hexToRgba(this.bgColor, 1);
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.stage._render(this.ctx);
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
        }
      }

      window.PIXI = {
        Application: ApplicationShim,
        Container: ContainerShim,
        Graphics: GraphicsShim,
        Text: TextShim,
        TextStyle: TextStyleShim
      };
    })();

