<script setup lang="ts">
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Code2,
  Image,
  Layers,
  Monitor,
  MousePointer2,
  Plus,
  Smartphone,
  Sparkles,
  Type,
} from '@lucide/vue'
</script>
<template>
  <RouterLink to="/editor" class="studio-preview" aria-label="打开 Scroll Studio 编辑器">
    <div class="mock-toolbar">
      <span class="mock-logo">s.</span><span>Untitled experience <ChevronDown :size="11" /></span
      ><span class="mock-saved"><Check :size="10" /> All changes saved</span
      ><span class="mock-publish">打开编辑器 <ArrowUpRight :size="10" /></span>
    </div>
    <div class="mock-body">
      <div class="mock-sidebar">
        <Plus :size="16" /><Layers :size="16" /><Type :size="16" /><Image :size="16" /><Sparkles
          :size="16"
        />
      </div>
      <div class="mock-canvas">
        <div class="mock-canvas-tools">
          <span>Desktop — 1120</span>
          <div><Monitor :size="11" /><Smartphone :size="11" /></div>
          <span>75%</span>
        </div>
        <div class="mock-page">
          <div class="mock-page-nav">
            <strong>FORM & FIELD</strong><span>Studio &nbsp;&nbsp; Work &nbsp;&nbsp; About ↗</span>
          </div>
          <div class="mock-page-copy">
            <span>INDEPENDENT DESIGN PRACTICE</span>
            <h3>Make space<br />for <em>something</em><br />unexpected.</h3>
            <p>A little curiosity. A different perspective.<br />A new way to see the everyday.</p>
            <span class="mock-cta">Explore our world ↗</span>
          </div>
          <div class="mock-art">
            <div class="art-orbit orbit-one"></div>
            <div class="art-orbit orbit-two"></div>
            <div class="art-orbit orbit-three"></div>
            <div class="art-orbit orbit-four"></div>
            <span>OBJECT NO. 001<br />A STUDY IN MOTION</span>
          </div>
          <div class="mock-selection"><span>Heading</span><i></i><i></i><i></i><i></i></div>
          <div class="mock-cursor">
            <MousePointer2 :size="19" fill="currentColor" /><span>You</span>
          </div>
          <div class="mock-page-bottom">SCROLL TO EXPLORE <span>↓</span></div>
        </div>
      </div>
      <div class="mock-properties">
        <span>Design <span>Motion</span></span
        ><strong>Heading</strong><small>TYPOGRAPHY</small>
        <div>Georgia <ChevronDown :size="9" /></div>
        <div>Size <b>64</b></div>
        <div>Weight <b>Regular</b></div>
        <small>APPEARANCE</small>
        <div><i></i> #26352B</div>
        <small>SCROLL ANIMATION</small>
        <div class="mock-motion"><Sparkles :size="10" /> Fade & rise <Check :size="10" /></div>
        <div>Duration <b>0.8s</b></div>
        <div class="mini-curve">
          <svg viewBox="0 0 110 50">
            <path d="M3 47C45 47 28 3 107 3" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </div>
      </div>
    </div>
    <div class="mock-bottom">
      <Code2 :size="11" /><span>Built with Vue. Made for your ideas.</span><span>100%</span>
    </div>
  </RouterLink>
</template>
