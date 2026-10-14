<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Code2,
  Layers,
  Menu,
  MousePointer2,
  MoveUpRight,
  Play,
  Save,
  Sparkles,
  X,
} from '@lucide/vue'
import BrandMark from '../components/ui/BrandMark.vue'
import StudioPreview from '../components/home/StudioPreview.vue'
gsap.registerPlugin(ScrollTrigger)
const root = ref<HTMLElement>()
const navOpen = ref(false)
const progress = ref(0)
let media: gsap.MatchMedia | undefined
function go(id: string) {
  navOpen.value = false
  document
    .getElementById(id)
    ?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
}
onMounted(() => {
  media = gsap.matchMedia()
  media.add(
    '(prefers-reduced-motion: no-preference)',
    () => {
      gsap.from('.hero-reveal', {
        y: 32,
        opacity: 0,
        stagger: 0.11,
        duration: 1,
        ease: 'power3.out',
      })
      gsap.from('.preview-scene', {
        y: 70,
        opacity: 0,
        rotation: 3,
        duration: 1.3,
        delay: 0.25,
        ease: 'power3.out',
      })
      gsap.to('.preview-scene', {
        y: -55,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 },
      })
      gsap.utils
        .toArray<HTMLElement>('.reveal')
        .forEach((el) =>
          gsap.from(el, {
            y: 45,
            opacity: 0,
            duration: 0.9,
            scrollTrigger: { trigger: el, start: 'top 90%' },
          }),
        )
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: '.motion-section',
          start: 'top 65%',
          end: 'bottom 30%',
          scrub: 0.8,
          onUpdate: (self) => {
            progress.value = Math.round(self.progress * 100)
          },
        },
      })
      timeline
        .fromTo(
          '.motion-object',
          { y: 95, rotation: -25, scale: 0.7 },
          { y: -50, rotation: 45, scale: 1.05, ease: 'none' },
        )
        .fromTo('.motion-line', { scaleX: 0 }, { scaleX: 1, ease: 'none' }, 0)
      gsap.to('.gallery-art', {
        yPercent: -12,
        ease: 'none',
        scrollTrigger: {
          trigger: '.examples-section',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      })
    },
    root.value,
  )
})
onBeforeUnmount(() => media?.revert())
</script>
<template>
  <div ref="root" class="home">
    <a class="skip-link" href="#main" @click.prevent="go('main')">跳到主要内容</a>
    <header class="site-header">
      <BrandMark />
      <nav :class="{ open: navOpen }" aria-label="主要导航">
        <button @click="go('workflow')">创作方式</button
        ><button @click="go('motion')">滚动体验 <span class="nav-dot"></span></button
        ><button @click="go('examples')">灵感画廊</button
        ><a
          href="https://github.com/myissue-studio/vue-website-page-builder"
          target="_blank"
          rel="noopener noreferrer"
          >底座调研 <ArrowUpRight :size="12"
        /></a>
      </nav>
      <RouterLink class="btn dark nav-cta" to="/editor"
        >进入工作室 <ArrowUpRight :size="15" /></RouterLink
      ><button
        class="mobile-menu icon-button"
        aria-label="切换导航"
        :aria-expanded="navOpen"
        @click="navOpen = !navOpen"
      >
        <component :is="navOpen ? X : Menu" :size="22" />
      </button>
    </header>
    <main id="main">
      <section class="hero section-wrap">
        <div class="hero-copy">
          <div class="eyebrow hero-reveal">
            <span class="tiny-dot"></span> A LITTLE SCROLL. A LOT OF POSSIBILITY.
          </div>
          <h1 class="hero-reveal">
            让灵感，<br />随<span class="headline-accent"
              >滚动<svg viewBox="0 0 260 18" preserveAspectRatio="none">
                <path d="M3 13Q110 0 255 9" /></svg></span
            >发生。
          </h1>
          <p class="hero-description hero-reveal">
            把脑海里的画面，变成指尖下的体验。<br />拖拽、设计、预览，让每一屏都有你的表达。
          </p>
          <div class="hero-actions hero-reveal">
            <RouterLink class="btn dark primary-cta" to="/editor"
              >开始自由创作 <ArrowUpRight :size="19" /></RouterLink
            ><button class="watch-link" aria-label="看看滚动的魔法" @click="go('motion')">
              <span><Play :size="12" fill="currentColor" /></span>看看滚动的魔法
            </button>
          </div>
          <div class="hero-meta hero-reveal">
            <span><Check :size="13" />无需注册</span><span><Check :size="13" />本地自动保存</span
            ><span><Check :size="13" />为创作者而生</span>
          </div>
          <div class="hero-index hero-reveal">
            <span>YOUR IDEAS, IN MOTION.</span><span>001 — ∞</span>
          </div>
        </div>
        <div class="preview-scene">
          <div class="scene-grid"></div>
          <div class="scene-caption"><span>THE CANVAS IS YOURS.</span><span>↘</span></div>
          <StudioPreview />
          <div class="floating-tag tag-motion">
            <span class="tag-icon"><Sparkles :size="16" /></span>
            <div>一点滚动，无限可能。<small>SCROLL TO FEEL THE DIFFERENCE</small></div>
          </div>
          <div class="floating-tag tag-built">
            <span class="tiny-dot"></span>从灵感，到真实网页 <ArrowUpRight :size="14" />
          </div>
          <div class="scene-coordinate">X: 128 &nbsp; Y: 064 <span>✳</span></div>
        </div>
      </section>
      <div class="craft-strip section-wrap">
        <span>少一点限制，多一点创造。</span>
        <div><Layers :size="17" />可视化搭建</div>
        <div><Sparkles :size="17" />滚动动效</div>
        <div><Code2 :size="17" />Vue 3 + TypeScript</div>
        <div><Save :size="17" />你的作品，你来掌控</div>
        <button aria-label="探索创作方式" @click="go('workflow')"><ArrowDown :size="18" /></button>
      </div>
      <section id="workflow" class="workflow-section section-wrap">
        <div class="section-top reveal">
          <div>
            <span class="eyebrow">01 / THE CREATIVE PROCESS</span>
            <h2>从一张白纸，<br />到一个<span class="muted">有感觉的网站。</span></h2>
          </div>
          <p>不必先成为开发者。<br />从你已经拥有的想法开始。</p>
        </div>
        <div class="workflow-grid">
          <div class="workflow-visual reveal">
            <div class="visual-topline"><span>YOUR NEXT GREAT IDEA</span><span>✳</span></div>
            <div class="block-stack">
              <div class="stack-block block-back">IMAGINE.</div>
              <div class="stack-block block-middle">CREATE.</div>
              <div class="stack-block block-front">MAKE IT MOVE.<MousePointer2 :size="32" /></div>
            </div>
            <div class="visual-bottomline">
              <span>一点点组合，成为自己的表达。</span><span>↗</span>
            </div>
          </div>
          <div class="workflow-steps">
            <article class="workflow-step reveal">
              <span>01</span>
              <div>
                <h3>拖进来，想法就有了形状。</h3>
                <p>标题、图片、按钮和容器。像搭积木一样组织内容，嵌套布局也很简单。</p>
              </div>
              <Layers :size="20" />
            </article>
            <article class="workflow-step reveal">
              <span>02</span>
              <div>
                <h3>调细节，让它更像你。</h3>
                <p>选择颜色、字体与留白，在真实画布上即时看见变化。每一步都可以撤销。</p>
              </div>
              <MousePointer2 :size="20" />
            </article>
            <article class="workflow-step reveal">
              <span>03</span>
              <div>
                <h3>换个屏幕，体验依然完整。</h3>
                <p>在桌面、平板和手机间切换。保存到本机，把创作的节奏留在自己手里。</p>
              </div>
              <MoveUpRight :size="20" />
            </article>
            <RouterLink class="inline-link reveal" to="/editor"
              >打开画布，亲手试试 <ArrowRight :size="17"
            /></RouterLink>
          </div>
        </div>
      </section>
      <section id="motion" class="motion-section">
        <div class="section-wrap motion-layout">
          <div class="motion-copy reveal">
            <span class="eyebrow">02 / MADE TO MOVE</span>
            <h2>滚动不只是浏览。<br />也是故事的<span>节奏。</span></h2>
            <p>
              向下滚动，看形状随指尖发生变化。<br />用位移、缩放和淡入，让内容在恰好的时刻出现。
            </p>
            <div class="motion-chips">
              <span>ScrollTrigger</span><span>实时预览</span><span>可保存的动画</span>
            </div>
            <RouterLink class="btn light" to="/editor"
              >给你的页面加一点动态 <ArrowUpRight :size="17"
            /></RouterLink>
          </div>
          <div class="motion-playground">
            <div class="motion-grid"></div>
            <div class="motion-object">
              <i v-for="n in 9" :key="n" :style="{ transform: `rotate(${n * 20}deg)` }"></i>
            </div>
            <span class="motion-coord coord-top">TRANSFORM / ROTATE / REVEAL</span
            ><span class="motion-coord coord-bottom"
              >SCROLL PROGRESS <b>{{ progress.toString().padStart(3, '0') }}%</b></span
            >
            <div class="motion-track"><div class="motion-line"></div></div>
            <span class="playground-label"
              ><Sparkles :size="13" /> THIS IS A LIVE SCROLL EXPERIMENT</span
            >
          </div>
        </div>
      </section>
      <section id="examples" class="examples-section section-wrap">
        <div class="section-top reveal">
          <div>
            <span class="eyebrow">03 / A PLACE TO BEGIN</span>
            <h2>下一份灵感，<span class="muted">会是什么？</span></h2>
          </div>
          <p>从容器和文字出发。<br />这些设计方向，等你在画布里实现。</p>
        </div>
        <div class="gallery-grid">
          <RouterLink to="/editor" class="gallery-card gallery-large reveal"
            ><div class="gallery-image landscape-card">
              <img
                class="gallery-art"
                src="/images/landscape.svg"
                alt="原创绿色山丘插画，作为自然主题网站设计灵感"
              />
              <div class="gallery-overlay">
                <span>FIELD NOTES — VOL. 01</span>
                <h3>Stay curious.<br />Go somewhere.</h3>
                <span>A JOURNAL OF THE OUTSIDE.</span>
              </div>
              <span class="gallery-open"><ArrowUpRight :size="22" /></span>
            </div>
            <div class="gallery-caption">
              <span>山野之间 <small>编辑风格 / 设计灵感</small></span
              ><span>01</span>
            </div></RouterLink
          ><RouterLink to="/editor" class="gallery-card reveal"
            ><div class="gallery-image type-card">
              <span>INDEPENDENT THINKING.</span>
              <div class="type-art">Less,<br /><em>but</em><br />better<span>®</span></div>
              <span class="type-card-bottom"
                >A STUDY IN SIMPLICITY <ArrowUpRight :size="25"
              /></span>
            </div>
            <div class="gallery-caption">
              <span>少即是多 <small>个人作品集 / 设计灵感</small></span
              ><span>02</span>
            </div></RouterLink
          >
        </div>
      </section>
      <section class="closing section-wrap reveal">
        <span class="eyebrow">LESS FRICTION. MORE EXPRESSION.</span>
        <div>
          <h2>好想法，<br />值得<span>一张画布。</span></h2>
          <div>
            <RouterLink class="btn dark primary-cta" to="/editor"
              >开始你的第一个页面 <ArrowUpRight :size="19"
            /></RouterLink>
            <p>无需账号。打开，就能开始。</p>
          </div>
        </div>
        <span class="closing-star" aria-hidden="true">✳</span>
      </section>
    </main>
    <footer class="site-footer section-wrap">
      <BrandMark /><span>DESIGNED TO EXPRESS. BUILT TO EXPLORE.</span
      ><button @click="go('main')">回到顶部 <ChevronRight :size="14" /></button
      ><small>© 2026 Scroll Studio</small>
    </footer>
  </div>
</template>
